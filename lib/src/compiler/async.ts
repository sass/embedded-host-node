// Copyright 2024 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as child_process from 'child_process';

import {Observable} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

import * as path from 'path';
import {
  OptionsWithLegacy,
  StringOptionsWithLegacy,
  createDispatcher,
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

  /** A list of active compilations. */
  private readonly compilations: Set<
    Promise<proto.OutboundMessage_CompileResponse>
  > = new Set();

  /** Whether the underlying compiler has already exited. */
  private disposed = false;

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
    options?: OptionsWithLegacy<'async'> & {legacy?: boolean},
  ): Promise<CompileResult> {
    const optionsKey = Symbol();
    activeDeprecationOptions.set(optionsKey, options ?? {});
    try {
      const functions = new FunctionRegistry(options?.functions);

      const dispatcher = createDispatcher<'async'>(
        this.compilationId++,
        this.messageTransformer,
        {
          handleImportRequest: request => importers.import(request),
          handleFileImportRequest: request => importers.fileImport(request),
          handleCanonicalizeRequest: request => importers.canonicalize(request),
          handleFunctionCallRequest: request => functions.call(request),
        },
      );
      dispatcher.logEvents$.subscribe(event => handleLogEvent(options, event));

      // Avoid `new Promise()` here because `dispatcher.sendCompilerequest` can
      // run its callback synchronously, so `compilation` needs to be assigned
      // and in `this.compilations` before we call it.
      const {
        promise: compilation,
        resolve,
        reject,
      } = promiseWithResolvers<proto.OutboundMessage_CompileResponse>();
      this.compilations.add(compilation);

      dispatcher.sendCompileRequest(request, (err, response) => {
        this.compilations.delete(compilation);
        // Reset the compilation ID when the compiler goes idle (no active
        // compilations) to avoid overflowing it.
        // https://github.com/sass/embedded-host-node/pull/261#discussion_r1429266794
        if (this.compilations.size === 0) this.compilationId = 1;
        if (err) {
          reject(err);
        } else {
          resolve(response!);
        }
      });

      return handleCompileResponse(await compilation);
    } finally {
      activeDeprecationOptions.delete(optionsKey);
    }
  }

  /** Initialize resources shared across compilations. */
  constructor(flag: Symbol | undefined) {
    if (flag !== initFlag) {
      throw utils.compilerError(
        'AsyncCompiler can not be directly constructed. ' +
          'Please use `sass.initAsyncCompiler()` instead.',
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
    await Promise.all(this.compilations);
    this.process.stdin!.end();
    await this.exit$;
  }
}

export async function initAsyncCompiler(): Promise<AsyncCompiler> {
  return new AsyncCompiler(initFlag);
}
