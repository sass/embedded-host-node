// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import { Observable, Subject } from 'rxjs';

import * as p from 'path';
import * as supportsColor from 'supports-color';
import { compilerCommand } from './compiler-path';
import { deprotofySourceSpan } from './deprotofy-span';
import { Dispatcher, DispatcherHandlers } from './dispatcher';
import { Exception } from './exception';
import { FunctionRegistry } from './function-registry';
import { ImporterRegistry } from './importer-registry';
import { legacyImporterProtocol } from './legacy/utils';
import { MessageTransformer } from './message-transformer';
import { PacketTransformer } from './packet-transformer';
import { SyncProcess } from './sync-process';
import * as utils from './utils';
import * as proto from './vendor/embedded_sass_pb';
import { SourceSpan } from './vendor/sass';
import { CompileResult } from './vendor/sass/compile';
import { Options, StringOptions } from './vendor/sass/options';

/// Allow the legacy API to pass in an option signaling to the modern API that
/// it's being run in legacy mode.
///
/// This is not intended for API users to pass in, and may be broken without
/// warning in the future.
export type OptionsWithLegacy<sync extends 'sync' | 'async'> = Options<sync> & {
  legacy?: boolean;
};

/// Allow the legacy API to pass in an option signaling to the modern API that
/// it's being run in legacy mode.
///
/// This is not intended for API users to pass in, and may be broken without
/// warning in the future.
export type StringOptionsWithLegacy<sync extends 'sync' | 'async'> =
  StringOptions<sync> & {legacy?: boolean};

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
  private exited = false;

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
        this.exited = true;
        return false;
    }
  }

  /** Blocks until the underlying process exits. */
  private yieldUntilExit(): void {
    while (!this.exited) {
      this.yield();
    }
  }

  /**
   * Creates a dispatcher that dispatches messages from the given `stdout` stream.
   */
  private createDispatcher<sync extends 'sync' | 'async'>(
    stdout: Observable<Buffer>,
    writeStdin: (buffer: Buffer) => void,
    handlers: DispatcherHandlers<sync>
  ): Dispatcher<sync> {
    const packetTransformer = new PacketTransformer(stdout, writeStdin);

    const messageTransformer = new MessageTransformer(
      packetTransformer.outboundProtobufs$,
      packet => packetTransformer.writeInboundProtobuf(packet)
    );

    return new Dispatcher<sync>(
      // Since we only use one compilation per process, we can get away with
      // hardcoding a compilation ID. Once we support multiple concurrent
      // compilations with the same process, we'll need to ensure each one uses a
      // unique ID.
      1,
      messageTransformer.outboundMessages$,
      message => messageTransformer.writeInboundMessage(message),
      handlers
    );
  }

  // Creates a compilation request for the given `options` without adding any
  // input-specific options.
  private newCompileRequest(
    importers: ImporterRegistry<'sync' | 'async'>,
    options?: Options<'sync' | 'async'>
  ): proto.InboundMessage_CompileRequest {
    const request = new proto.InboundMessage_CompileRequest({
      importers: importers.importers,
      globalFunctions: Object.keys(options?.functions ?? {}),
      sourceMap: !!options?.sourceMap,
      sourceMapIncludeSources: !!options?.sourceMapIncludeSources,
      alertColor: options?.alertColor ?? !!supportsColor.stdout,
      alertAscii: !!options?.alertAscii,
      quietDeps: !!options?.quietDeps,
      verbose: !!options?.verbose,
      charset: !!(options?.charset ?? true),
    });

    switch (options?.style ?? 'expanded') {
      case 'expanded':
        request.style = proto.OutputStyle.EXPANDED;
        break;

      case 'compressed':
        request.style = proto.OutputStyle.COMPRESSED;
        break;

      default:
        throw new Error(`Unknown options.style: "${options?.style}"`);
    }

    return request;
  }

  // Creates a request for compiling a file.
  private newCompilePathRequest(
    path: string,
    importers: ImporterRegistry<'sync' | 'async'>,
    options?: Options<'sync' | 'async'>
  ): proto.InboundMessage_CompileRequest {
    const request = this.newCompileRequest(importers, options);
    request.input = {case: 'path', value: path};
    return request;
  }

  // Creates a request for compiling a string.
  private newCompileStringRequest(
    source: string,
    importers: ImporterRegistry<'sync' | 'async'>,
    options?: StringOptions<'sync' | 'async'>
  ): proto.InboundMessage_CompileRequest {
    const input = new proto.InboundMessage_CompileRequest_StringInput({
      source,
      syntax: utils.protofySyntax(options?.syntax ?? 'scss'),
    });

    const url = options?.url?.toString();
    if (url && url !== legacyImporterProtocol) {
      input.url = url;
    }

    if (options && 'importer' in options && options.importer) {
      input.importer = importers.register(options.importer);
    } else if (url === legacyImporterProtocol) {
      input.importer = new proto.InboundMessage_CompileRequest_Importer({
        importer: {case: 'path', value: p.resolve('.')},
      });
    } else {
      // When importer is not set on the host, the compiler will set a
      // FileSystemImporter if `url` is set to a file: url or a NoOpImporter.
    }

    const request = this.newCompileRequest(importers, options);
    request.input = {case: 'string', value: input};
    return request;
  }

  /** Handles a log event according to `options`. */
  private handleLogEvent(
    options: OptionsWithLegacy<'sync' | 'async'> | undefined,
    event: proto.OutboundMessage_LogEvent
  ): void {
    let span = event.span ? deprotofySourceSpan(event.span) : null;
    let message = event.message;
    let formatted = event.formatted;

    if (event.type === proto.LogEventType.DEBUG) {
      if (options?.logger?.debug) {
        options.logger.debug(message, {
          span: span!,
        });
      } else {
        console.error(formatted);
      }
    } else {
      if (options?.logger?.warn) {
        const params: {
          deprecation: boolean;
          span?: SourceSpan;
          stack?: string;
        } = {
          deprecation: event.type === proto.LogEventType.DEPRECATION_WARNING,
        };
        if (span) params.span = span;

        const stack = event.stackTrace;
        if (stack) {
          params.stack = stack;
        }

        options.logger.warn(message, params);
      } else {
        console.error(formatted);
      }
    }
  }

  /**
   * Converts a `CompileResponse` into a `CompileResult`.
   *
   * Throws a `SassException` if the compilation failed.
   */
  private handleCompileResponse(
    response: proto.OutboundMessage_CompileResponse
  ): CompileResult {
    if (response.result.case === 'success') {
      const success = response.result.value;
      const result: CompileResult = {
        css: success.css,
        loadedUrls: response.loadedUrls.map(url => new URL(url)),
      };

      const sourceMap = success.sourceMap;
      if (sourceMap) result.sourceMap = JSON.parse(sourceMap);
      return result;
    } else if (response.result.case === 'failure') {
      throw new Exception(response.result.value);
    } else {
      throw utils.compilerError('Compiler sent empty CompileResponse.');
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
      const dispatcher = this.createDispatcher<'sync'>(
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

      dispatcher.logEvents$.subscribe(event =>
        this.handleLogEvent(options, event)
      );

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
        if (response) return this.handleCompileResponse(response);
      }
    } finally {
      this.dispose();
      this.yieldUntilExit();
    }
  }

  private throwIfClosed(): void {
    if (this.exited) {
      throw utils.compilerError('Sync compiler has already exited.');
    }
  }

  compile(path: string, options?: Options<'sync'>): CompileResult {
    this.throwIfClosed();
    const importers = new ImporterRegistry(options);
    return this.compileRequestSync(
      this.newCompilePathRequest(path, importers, options),
      importers,
      options
    );
  }

  compileString(source: string, options?: Options<'sync'>): CompileResult {
    this.throwIfClosed();
    const importers = new ImporterRegistry(options);
    return this.compileRequestSync(
      this.newCompileStringRequest(source, importers, options),
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
