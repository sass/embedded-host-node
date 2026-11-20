// Copyright 2024 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as path from 'path';

import {Subject, filter, map} from 'rxjs';
import * as sync_child_process from 'sync-child-process';

import {
  OptionsWithLegacy,
  handleCompileResponse,
  handleLogEvent,
  newCompilePathRequest,
  newCompileStringRequest,
} from './utils';
import {compilerCommand} from '../compiler-path';
import {activeDeprecationOptions} from '../deprecations';
import {FunctionRegistry} from '../function-registry';
import {ImporterRegistry} from '../importer-registry';
import {MessageTransformer} from '../message-transformer';
import {PacketTransformer} from '../packet-transformer';
import * as utils from '../utils';
import * as proto from '../vendor/embedded_sass_pb';
import {CompileResult} from '../vendor/sass/compile';
import {Options} from '../vendor/sass/options';
import {dispatchCompilation} from '../dispatch-compilation';

/**
 * Flag allowing the constructor passed by `initCompiler` so we can
 * differentiate and throw an error if the `Compiler` is constructed via `new
 * Compiler`.
 */
const initFlag = Symbol();

/** A synchronous wrapper for the embedded Sass compiler */
export class Compiler {
  /** The underlying process that's being wrapped. */
  private readonly process = (() => {
    let command = compilerCommand[0];
    let args = [...compilerCommand.slice(1), '--embedded'];
    const options: sync_child_process.Options = {
      // Use the command's cwd so the compiler survives the removal of the
      // current working directory.
      // https://github.com/sass/embedded-host-node/pull/261#discussion_r1438712923
      cwd: path.dirname(compilerCommand[0]),
      windowsHide: true,
    };

    // Node forbids launching .bat and .cmd without a shell due to CVE-2024-27980,
    // and DEP0190 forbids passing an argument list *with* shell: true. To work
    // around this, we have to manually concatenate the arguments.
    if (['.bat', '.cmd'].includes(path.extname(command).toLowerCase())) {
      command = `${command} ${args!.join(' ')}`;
      args = [];
      options.shell = true;
    }

    return new sync_child_process.SyncChildProcess(command, args, options);
  })();

  /** The next compilation ID. */
  private compilationId = 1;

  /** The set of IDs for active compilations. */
  private readonly activeCompilationIds = new Set<number>();

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
    const result = this.process.next();
    if (result.done) {
      this.disposed = true;
      return false;
    }
    const event = result.value;
    switch (event.type) {
      case 'stdout':
        this.stdout$.next(event.data);
        return true;

      case 'stderr':
        this.stderr$.next(event.data);
        return true;
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
    options?: OptionsWithLegacy<'sync'>,
  ): CompileResult {
    const optionsKey = Symbol();
    activeDeprecationOptions.set(optionsKey, options ?? {});
    try {
      const functions = new FunctionRegistry(options?.functions);
      const compilationId = this.compilationId++;
      this.activeCompilationIds.add(compilationId);

      let error: unknown;
      let response: proto.OutboundMessage_CompileResponse | undefined;
      dispatchCompilation<'sync'>(
        compilationId,
        request,
        this.messageTransformer.outboundMessages$.pipe(
          // Almost universally, there will only be one compilation running
          // since it's synchronously blocking everything else. However, it's
          // possible in principle for a request callback to start another
          // compilation on the same compiler, so we should filter for the right
          // ID just in case.
          filter(([messageCompilationId, _]) => {
            if (!this.activeCompilationIds.has(messageCompilationId)) {
              throw utils.compilerError(
                'Compiler sent a message for non-existent or completed ' +
                  `compilation with ID ${compilationId}.`,
              );
            }
            return messageCompilationId === compilationId;
          }),
          map(([_, message]) => message),
        ),
        message => this.messageTransformer.writeInboundMessage(message),
        {
          handleImportRequest: request => importers.import(request),
          handleFileImportRequest: request => importers.fileImport(request),
          handleCanonicalizeRequest: request => importers.canonicalize(request),
          handleFunctionCallRequest: request => functions.call(request),
          handleLogEvent: event => handleLogEvent(options, event),
        },
        (error_, response_) => {
          this.activeCompilationIds.delete(compilationId);
          // Reset the compilation ID when the compiler goes idle (no active
          // dispatchers) to avoid overflowing it.
          // https://github.com/sass/embedded-host-node/pull/261#discussion_r1429266794
          if (this.activeCompilationIds.size === 0) this.compilationId = 1;
          if (error_) {
            error = error_;
          } else {
            response = response_;
          }
        },
      );

      for (;;) {
        if (!this.yield()) {
          throw utils.compilerError('Embedded compiler exited unexpectedly');
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
      throw utils.compilerError('Sync compiler has already been disposed');
    }
  }

  /** Initialize resources shared across compilations. */
  constructor(flag: symbol | undefined) {
    if (flag !== initFlag) {
      throw utils.compilerError(
        'Compiler can not be directly constructed. ' +
          'Please use `sass.initCompiler()` instead',
      );
    }
    this.stderr$.subscribe(data => process.stderr.write(data));
    const packetTransformer = new PacketTransformer(this.stdout$, buffer => {
      this.writeStdin(buffer);
    });
    this.messageTransformer = new MessageTransformer(
      packetTransformer.outboundProtobufs$,
      packet => packetTransformer.writeInboundProtobuf(packet),
    );
  }

  compile(path: string, options?: Options<'sync'>): CompileResult {
    this.throwIfDisposed();
    const importers = new ImporterRegistry(options);
    return this.compileRequestSync(
      newCompilePathRequest(path, importers, options),
      importers,
      options,
    );
  }

  compileString(source: string, options?: Options<'sync'>): CompileResult {
    this.throwIfDisposed();
    const importers = new ImporterRegistry(options);
    return this.compileRequestSync(
      newCompileStringRequest(source, importers, options),
      importers,
      options,
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
