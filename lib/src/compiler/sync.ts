// Copyright 2024 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Subject} from 'rxjs';

import * as path from 'path';
import {
  OptionsWithLegacy,
  createDispatcher,
  handleCompileResponse,
  handleLogEvent,
  newCompilePathRequest,
  newCompileStringRequest,
} from './utils';
import {compilerCommand} from '../compiler-path';
import {activeDeprecationOptions} from '../deprecations';
import {Dispatcher} from '../dispatcher';
import {FunctionRegistry} from '../function-registry';
import {ImporterRegistry} from '../importer-registry';
import {MessageTransformer} from '../message-transformer';
import {PacketTransformer} from '../packet-transformer';
import {SyncProcess} from '../sync-process';
import * as utils from '../utils';
import * as proto from '../vendor/embedded_sass_pb';
import {CompileResult} from '../vendor/sass/compile';
import {Options} from '../vendor/sass/options';

/**
 * Flag allowing the constructor passed by `initCompiler` so we can
 * differentiate and throw an error if the `Compiler` is constructed via `new
 * Compiler`.
 */
const initFlag = Symbol();

/** A synchronous wrapper for the embedded Sass compiler */
export class Compiler {
  /** The underlying process that's being wrapped. */
  private readonly process = new SyncProcess(
    compilerCommand[0],
    [...compilerCommand.slice(1), '--embedded'],
    {
      // Use the command's cwd so the compiler survives the removal of the
      // current working directory.
      // https://github.com/sass/embedded-host-node/pull/261#discussion_r1438712923
      cwd: path.dirname(compilerCommand[0]),
      // Node blocks launching .bat and .cmd without a shell due to CVE-2024-27980
      shell: ['.bat', '.cmd'].includes(
        path.extname(compilerCommand[0]).toLowerCase()
      ),
      windowsHide: true,
    }
  );

  /** The next compilation ID. */
  private compilationId = 1;

  /** A list of active dispatchers. */
  private readonly dispatchers: Set<Dispatcher<'sync'>> = new Set();

  /** The buffers emitted by the child process's stdout. */
  private readonly stdout$ = new Subject<Buffer>();

  /** The buffers emitted by the child process's stderr. */
  private readonly stderr$ = new Subject<Buffer>();

  /** Whether the underlying compiler has already exited. */
  private disposed = false;

  /** Reusable message transformer for all compilations.  */
  private readonly messageTransformer: MessageTransformer;

  /** Writes `buffer` to the child process's stdin. */
  private writeStdin(buffer: Buffer): void {
    this.process.stdin.write(buffer);
  }

  /** Yields the next event from the underlying process. */
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

  /**
   * Sends a compile request to the child process and returns the CompileResult.
   * Throws if there were any protocol or compilation errors.
   */
  private compileRequestSync(
    request: proto.InboundMessage_CompileRequest,
    importers: ImporterRegistry<'sync'>,
    options?: OptionsWithLegacy<'sync'>
  ): CompileResult {
    const optionsKey = Symbol();
    activeDeprecationOptions.set(optionsKey, options ?? {});
    try {
      const functions = new FunctionRegistry(options?.functions);

      const dispatcher = createDispatcher<'sync'>(
        this.compilationId++,
        this.messageTransformer,
        {
          handleImportRequest: request => importers.import(request),
          handleFileImportRequest: request => importers.fileImport(request),
          handleCanonicalizeRequest: request => importers.canonicalize(request),
          handleFunctionCallRequest: request => functions.call(request),
        }
      );
      this.dispatchers.add(dispatcher);

      dispatcher.logEvents$.subscribe(event => handleLogEvent(options, event));

      let error: unknown;
      let response: proto.OutboundMessage_CompileResponse | undefined;
      dispatcher.sendCompileRequest(request, (error_, response_) => {
        this.dispatchers.delete(dispatcher);
        // Reset the compilation ID when the compiler goes idle (no active
        // dispatchers) to avoid overflowing it.
        // https://github.com/sass/embedded-host-node/pull/261#discussion_r1429266794
        if (this.dispatchers.size === 0) this.compilationId = 1;
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
      activeDeprecationOptions.delete(optionsKey);
    }
  }

  /** Guards against using a disposed compiler. */
  private throwIfDisposed(): void {
    if (this.disposed) {
      throw utils.compilerError('Sync compiler has already been disposed.');
    }
  }

  /** Initialize resources shared across compilations. */
  constructor(flag: Symbol | undefined) {
    if (flag !== initFlag) {
      throw utils.compilerError(
        'Compiler can not be directly constructed. ' +
          'Please use `sass.initAsyncCompiler()` instead.'
      );
    }
    this.stderr$.subscribe(data => process.stderr.write(data));
    const packetTransformer = new PacketTransformer(this.stdout$, buffer => {
      this.writeStdin(buffer);
    });
    this.messageTransformer = new MessageTransformer(
      packetTransformer.outboundProtobufs$,
      packet => packetTransformer.writeInboundProtobuf(packet)
    );
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

  dispose(): void {
    this.process.stdin.end();
    this.yieldUntilExit();
  }
}

export function initCompiler(): Compiler {
  return new Compiler(initFlag);
}
