// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Subject} from 'rxjs';

import {
  OptionsWithLegacy,
  createDispatcher,
  handleCompileResponse,
  handleLogEvent,
  newCompilePathRequest,
  newCompileStringRequest,
} from './compiler';
import {compilerCommand} from './compiler-path';
import {FunctionRegistry} from './function-registry';
import {ImporterRegistry} from './importer-registry';
import {SyncProcess} from './sync-process';
import * as utils from './utils';
import * as proto from './vendor/embedded_sass_pb';
import {CompileResult} from './vendor/sass/compile';
import {Options} from './vendor/sass/options';

/**
 * A synchronous wrapper for the embedded Sass compiler
 */
export class Compiler {
  /** The underlying process that's being wrapped. */
  private readonly process = new SyncProcess(
    compilerCommand[0],
    [...compilerCommand.slice(1), '--embedded'],
    {windowsHide: true}
  );

  /** The buffers emitted by the child process's stdout. */
  private readonly stdout$ = new Subject<Buffer>();

  /** The buffers emitted by the child process's stderr. */
  private readonly stderr$ = new Subject<Buffer>();

  /** Whether the underlying compiler has already exited. */
  private disposed = false;

  /** Writes `buffer` to the child process's stdin. */
  private writeStdin(buffer: Buffer): void {
    this.process.stdin.write(buffer);
  }

  private yield(): boolean {
    const event = this.process.yield();
    switch (event.type) {
      case 'stdout':
        this.stdout$.next(event.data);
        return true;

      case 'stderr':
        this.stderr$.next(event.data);
        return true;

      case 'exit':
        this.disposed = true;
        return false;
    }
  }

  /** Blocks until the underlying process exits. */
  private yieldUntilExit(): void {
    while (!this.disposed) {
      this.yield();
    }
  }

  // Spins up a compiler, then sends it a compile request. Returns a promise that
  // resolves with the CompileResult. Throws if there were any protocol or
  // compilation errors. Shuts down the compiler after compilation.
  private compileRequestSync(
    request: proto.InboundMessage_CompileRequest,
    importers: ImporterRegistry<'sync'>,
    options?: OptionsWithLegacy<'sync'>
  ): CompileResult {
    const functions = new FunctionRegistry(options?.functions);
    this.stderr$.subscribe(data => process.stderr.write(data));

    try {
      const dispatcher = createDispatcher<'sync'>(
        this.stdout$,
        buffer => {
          this.writeStdin(buffer);
        },
        {
          handleImportRequest: request => importers.import(request),
          handleFileImportRequest: request => importers.fileImport(request),
          handleCanonicalizeRequest: request => importers.canonicalize(request),
          handleFunctionCallRequest: request => functions.call(request),
        }
      );

      dispatcher.logEvents$.subscribe(event => handleLogEvent(options, event));

      let error: unknown;
      let response: proto.OutboundMessage_CompileResponse | undefined;
      dispatcher.sendCompileRequest(request, (error_, response_) => {
        if (error_) {
          error = error_;
        } else {
          response = response_;
        }
      });

      for (;;) {
        if (!this.yield()) {
          throw utils.compilerError('Embedded compiler exited unexpectedly.');
        }

        if (error) throw error;
        if (response) return handleCompileResponse(response);
      }
    } finally {
      this.dispose();
      this.yieldUntilExit();
    }
  }

  private throwIfDisposed(): void {
    if (this.disposed) {
      throw utils.compilerError('Sync compiler has already exited.');
    }
  }

  compile(path: string, options?: Options<'sync'>): CompileResult {
    this.throwIfDisposed();
    const importers = new ImporterRegistry(options);
    return this.compileRequestSync(
      newCompilePathRequest(path, importers, options),
      importers,
      options
    );
  }

  compileString(source: string, options?: Options<'sync'>): CompileResult {
    this.throwIfDisposed();
    const importers = new ImporterRegistry(options);
    return this.compileRequestSync(
      newCompileStringRequest(source, importers, options),
      importers,
      options
    );
  }

  /** Kills the child process, cleaning up all associated Observables. */
  dispose() {
    this.process.stdin.end();
  }
}

export function initCompiler(): Compiler {
  return new Compiler();
}
