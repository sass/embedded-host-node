// Copyright 2024 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as child_process from 'child_process';

import {Observable, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

import * as path from 'path';
import {
  OptionsWithLegacy,
  StringOptionsWithLegacy,
  handleCompileResponse,
  handleLogEvent,
  newCompilePathRequest,
  newCompileStringRequest,
  promiseWithResolvers,
} from './utils';
import {compilerCommand} from '../compiler-path';
import {activeDeprecationOptions} from '../deprecations';
import {FunctionRegistry} from '../function-registry';
import {ImporterRegistry} from '../importer-registry';
import {MessageTransformer} from '../message-transformer';
import {PacketTransformer} from '../packet-transformer';
import * as utils from '../utils';
import * as proto from '../vendor/embedded_sass_pb';
import {CompileResult} from '../vendor/sass';
import {dispatchCompilation} from '../dispatch-compilation';

/**
 * Flag allowing the constructor passed by `initAsyncCompiler` so we can
 * differentiate and throw an error if the `AsyncCompiler` is constructed via
 * `new AsyncCompiler`.
 */
const initFlag = Symbol();

/** An asynchronous wrapper for the embedded Sass compiler */
export class AsyncCompiler {
  /** The underlying process that's being wrapped. */
  private readonly process = (() => {
    let command = compilerCommand[0];
    let args = [...compilerCommand.slice(1), '--embedded'];
    const options: child_process.SpawnOptions = {
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

    return child_process.spawn(command, args, options);
  })();

  /** The next compilation ID. */
  private compilationId = 1;

  /** A map from compilation IDs to objects relating to active compilations. */
  private readonly compilations = new Map<number, ActiveCompilation>();

  /** Whether the underlying compiler has already exited. */
  private disposed = false;

  /**
   * An error that has occurred when no compilations were running. This will be
   * thrown next time a user calls a method.
   */
  private outOfBandError: unknown;

  /** Reusable message transformer for all compilations.  */
  private readonly messageTransformer: MessageTransformer;

  /** The child process's exit event. */
  private readonly exit$ = new Promise<number | null>(resolve => {
    this.process.on('exit', code => resolve(code));
  });

  /** The buffers emitted by the child process's stdout. */
  private readonly stdout$ = new Observable<Buffer>(observer => {
    this.process.stdout!.on('data', buffer => observer.next(buffer));
  }).pipe(takeUntil(this.exit$));

  /** The buffers emitted by the child process's stderr. */
  private readonly stderr$ = new Observable<Buffer>(observer => {
    this.process.stderr!.on('data', buffer => observer.next(buffer));
  }).pipe(takeUntil(this.exit$));

  /** Writes `buffer` to the child process's stdin. */
  private writeStdin(buffer: Buffer): void {
    this.process.stdin!.write(buffer);
  }

  /** Guards against using a disposed compiler. */
  private throwIfDisposed(): void {
    if (this.disposed) {
      if (this.outOfBandError !== undefined) {
        this.outOfBandError = undefined;
        throw this.outOfBandError;
      } else {
        throw utils.compilerError('Async compiler has already been disposed');
      }
    }
  }

  /**
   * Sends a compile request to the child process and returns a Promise that
   * resolves with the CompileResult. Rejects the promise if there were any
   * protocol or compilation errors.
   */
  private async compileRequestAsync(
    request: proto.InboundMessage_CompileRequest,
    importers: ImporterRegistry<'async'>,
    options?: OptionsWithLegacy<'async'> & {legacy?: boolean},
  ): Promise<CompileResult> {
    const optionsKey = Symbol();
    activeDeprecationOptions.set(optionsKey, options ?? {});
    try {
      const functions = new FunctionRegistry(options?.functions);

      const compilationId = this.compilationId++;
      const outboundMessages$ = new Subject<proto.OutboundMessage>();

      // Avoid `new Promise()` here because `dispatcher.sendCompilerequest` can
      // run its callback synchronously, so `compilation` needs to be assigned
      // and in `this.compilations` before we call it.
      const {
        promise: compilation,
        resolve,
        reject,
      } = promiseWithResolvers<proto.OutboundMessage_CompileResponse>();
      this.compilations.set(compilationId, {
        outboundMessages$,
        result: compilation,
        reject,
      });

      dispatchCompilation<'async'>(
        compilationId,
        request,
        outboundMessages$,
        message => this.messageTransformer.writeInboundMessage(message),
        {
          handleImportRequest: request => importers.import(request),
          handleFileImportRequest: request => importers.fileImport(request),
          handleCanonicalizeRequest: request => importers.canonicalize(request),
          handleFunctionCallRequest: request => functions.call(request),
          handleLogEvent: event => handleLogEvent(options, event),
        },
        (err, response) => {
          this.compilations.delete(compilationId);
          // Reset the compilation ID when the compiler goes idle (no active
          // compilations) to avoid overflowing it.
          // https://github.com/sass/embedded-host-node/pull/261#discussion_r1429266794
          if (this.compilations.size === 0) this.compilationId = 1;
          if (err) {
            reject(err);
          } else {
            resolve(response!);
          }
        },
      );

      return handleCompileResponse(await compilation);
    } finally {
      activeDeprecationOptions.delete(optionsKey);
    }
  }

  /** Initialize resources shared across compilations. */
  constructor(flag: symbol | undefined) {
    if (flag !== initFlag) {
      throw utils.compilerError(
        'AsyncCompiler can not be directly constructed. ' +
          'Please use `sass.initAsyncCompiler()` instead',
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
    this.messageTransformer.outboundMessages$.subscribe({
      next: ([compilationId, message]) => {
        const compilation = this.compilations.get(compilationId);
        if (!compilation) {
          this.handleOutOfBandError(
            utils.compilerError(
              'Compiler sent a message for non-existent or completed ' +
                `compilation with ID ${compilationId}.`,
            ),
          );
        } else {
          compilation.outboundMessages$.next(message);
        }
      },
      error: error => this.handleOutOfBandError(error),
      complete: () => {
        for (const compilation of this.compilations.values()) {
          compilation.outboundMessages$.complete();
        }
      },
    });
  }

  compileAsync(
    path: string,
    options?: OptionsWithLegacy<'async'>,
  ): Promise<CompileResult> {
    this.throwIfDisposed();
    const importers = new ImporterRegistry(options);
    return this.compileRequestAsync(
      newCompilePathRequest(path, importers, options),
      importers,
      options,
    );
  }

  compileStringAsync(
    source: string,
    options?: StringOptionsWithLegacy<'async'>,
  ): Promise<CompileResult> {
    this.throwIfDisposed();
    const importers = new ImporterRegistry(options);
    return this.compileRequestAsync(
      newCompileStringRequest(source, importers, options),
      importers,
      options,
    );
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    // TODO: Call `.map()` directly on the iterator once we use a more recent ES
    // version.
    await Promise.all(
      [...this.compilations.values()].map(compilation => compilation.result),
    );
    this.process.stdin!.end();
    await this.exit$;
  }

  /**
   * Handles an error that isn't part of any specific compilation.
   *
   * If there are compilaitons running, this ends them with this error.
   * Otherwise, it saves the error for the next time the user calls a method.
   * Either way, it disposes the dispatcher.
   */
  private handleOutOfBandError(error: unknown): void {
    if (this.disposed) return;
    this.disposed = true;
    this.process.kill();
    if (this.compilations.size > 0) {
      for (const compilation of this.compilations.values()) {
        compilation.reject(error);
      }
      this.compilations.clear();
    } else {
      this.outOfBandError = error;
    }
  }
}

/** Objects related to an ongoing compilation. */
interface ActiveCompilation {
  /**
   * The subject used to send messages from the compiler to this compilation's
   * dispatcher.
   */
  readonly outboundMessages$: Subject<proto.OutboundMessage>;

  /** The promise that will complete once this compilation has finished. */
  readonly result: Promise<proto.OutboundMessage_CompileResponse>;

  /**
   * A function that rejects this compilation's promise if it's not already
   * complete. Only used when handling unexpected errors outside the normal flow
   * of compilation.
   */
  readonly reject: (error: unknown) => void;
}

export async function initAsyncCompiler(): Promise<AsyncCompiler> {
  return new AsyncCompiler(initFlag);
}
