// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {spawn} from 'child_process';
import {Observable} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

import {
  OptionsWithLegacy,
  StringOptionsWithLegacy,
  createDispatcher,
  handleCompileResponse,
  handleLogEvent,
  newCompilePathRequest,
  newCompileStringRequest,
} from './compiler';
import {compilerCommand} from './compiler-path';
import {FunctionRegistry} from './function-registry';
import {ImporterRegistry} from './importer-registry';
import * as utils from './utils';
import * as proto from './vendor/embedded_sass_pb';
import {CompileResult} from './vendor/sass';
import {PacketTransformer} from './packet-transformer';
import {MessageTransformer} from './message-transformer';

/**
 * Flag allowing the constructor passed by `initAsyncCompiler` so we can
 * differentiate and throw an error if the `AsyncCompiler` is constructed via
 * `new AsyncCompiler`.
 */
const initFlag = Symbol();

/**
 * An asynchronous wrapper for the embedded Sass compiler
 */
export class AsyncCompiler {
  /** The underlying process that's being wrapped. */
  private readonly process = spawn(
    compilerCommand[0],
    [...compilerCommand.slice(1), '--embedded'],
    {windowsHide: true}
  );

  /** The next compilation ID */
  private compilationId = 1;

  /** Whether the underlying compiler has already exited. */
  private disposed = false;

  /** Reusable message transformer for all compilations.  */
  private messageTransformer: MessageTransformer;

  /** A list of pending compilations */
  private compilations = new Set<Promise<CompileResult>>();

  /** The child process's exit event. */
  private readonly exit$ = new Promise<number | null>(resolve => {
    this.process.on('exit', code => resolve(code));
  });

  /** The buffers emitted by the child process's stdout. */
  private readonly stdout$ = new Observable<Buffer>(observer => {
    this.process.stdout.on('data', buffer => observer.next(buffer));
  }).pipe(takeUntil(this.exit$));

  /** The buffers emitted by the child process's stderr. */
  private readonly stderr$ = new Observable<Buffer>(observer => {
    this.process.stderr.on('data', buffer => observer.next(buffer));
  }).pipe(takeUntil(this.exit$));

  /** Writes `buffer` to the child process's stdin. */
  private writeStdin(buffer: Buffer): void {
    this.process.stdin.write(buffer);
  }

  /** Adds a compilation to the pending set and removes it when it's done. */
  private addCompilation(compilation: Promise<CompileResult>): void {
    this.compilations.add(compilation);
    compilation
      .catch(() => {})
      .finally(() => {
        this.compilations.delete(compilation);
        if (this.compilations.size === 0) this.compilationId = 1;
      });
  }

  /** Guards against using a disposed compiler. */
  private throwIfDisposed(): void {
    if (this.disposed) {
      throw utils.compilerError('Async compiler has already been disposed.');
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
    options?: OptionsWithLegacy<'async'> & {legacy?: boolean}
  ): Promise<CompileResult> {
    const functions = new FunctionRegistry(options?.functions);

    const dispatcher = createDispatcher<'async'>(
      this.compilationId++,
      this.messageTransformer,
      {
        handleImportRequest: request => importers.import(request),
        handleFileImportRequest: request => importers.fileImport(request),
        handleCanonicalizeRequest: request => importers.canonicalize(request),
        handleFunctionCallRequest: request => functions.call(request),
      }
    );

    dispatcher.logEvents$.subscribe(event => handleLogEvent(options, event));

    return handleCompileResponse(
      await new Promise<proto.OutboundMessage_CompileResponse>(
        (resolve, reject) =>
          dispatcher.sendCompileRequest(request, (err, response) => {
            if (err) {
              reject(err);
            } else {
              resolve(response!);
            }
          })
      )
    );
  }

  /** Initialize resources shared across compilations. */
  constructor(flag: Symbol | undefined) {
    if (flag !== initFlag) {
      throw utils.compilerError(
        'AsyncCompiler can not be directly constructed. Please use `sass.initAsyncCompiler()` instead.'
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

  compileAsync(
    path: string,
    options?: OptionsWithLegacy<'async'>
  ): Promise<CompileResult> {
    this.throwIfDisposed();
    const importers = new ImporterRegistry(options);
    const compilation = this.compileRequestAsync(
      newCompilePathRequest(path, importers, options),
      importers,
      options
    );
    this.addCompilation(compilation);
    return compilation;
  }

  compileStringAsync(
    source: string,
    options?: StringOptionsWithLegacy<'async'>
  ): Promise<CompileResult> {
    this.throwIfDisposed();
    const importers = new ImporterRegistry(options);
    const compilation = this.compileRequestAsync(
      newCompileStringRequest(source, importers, options),
      importers,
      options
    );
    this.addCompilation(compilation);
    return compilation;
  }

  async dispose() {
    this.disposed = true;
    await Promise.all(this.compilations);
    this.process.stdin.end();
    await this.exit$;
  }
}

export async function initAsyncCompiler(): Promise<AsyncCompiler> {
  return new AsyncCompiler(initFlag);
}
