// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from 'path';
import {Observable} from 'rxjs';
import * as supportsColor from 'supports-color';

import * as proto from './vendor/embedded_sass_pb';
import * as utils from './utils';
import {AsyncEmbeddedCompiler} from './async-compiler';
import {CompileResult, Options, SourceSpan, StringOptions} from './vendor/sass';
import {Dispatcher, DispatcherHandlers} from './dispatcher';
import {Exception} from './exception';
import {FunctionRegistry} from './function-registry';
import {ImporterRegistry} from './importer-registry';
import {MessageTransformer} from './message-transformer';
import {PacketTransformer} from './packet-transformer';
import {SyncEmbeddedCompiler} from './sync-compiler';
import {deprotofySourceSpan} from './deprotofy-span';
import {legacyImporterProtocol} from './legacy/importer';

export function compile(
  path: string,
  options?: Options<'sync'>
): CompileResult {
  const importers = new ImporterRegistry(options);
  return compileRequestSync(
    newCompilePathRequest(path, importers, options),
    importers,
    options
  );
}

export function compileString(
  source: string,
  options?: StringOptions<'sync'>
): CompileResult {
  const importers = new ImporterRegistry(options);
  return compileRequestSync(
    newCompileStringRequest(source, importers, options),
    importers,
    options
  );
}

export function compileAsync(
  path: string,
  options?: Options<'async'>
): Promise<CompileResult> {
  const importers = new ImporterRegistry(options);
  return compileRequestAsync(
    newCompilePathRequest(path, importers, options),
    importers,
    options
  );
}

export function compileStringAsync(
  source: string,
  options?: StringOptions<'async'>
): Promise<CompileResult> {
  const importers = new ImporterRegistry(options);
  return compileRequestAsync(
    newCompileStringRequest(source, importers, options),
    importers,
    options
  );
}

// Creates a request for compiling a file.
function newCompilePathRequest(
  path: string,
  importers: ImporterRegistry<'sync' | 'async'>,
  options?: Options<'sync' | 'async'>
): proto.InboundMessage_CompileRequest {
  const request = newCompileRequest(importers, options);
  request.input = {case: 'path', value: path};
  return request;
}

// Creates a request for compiling a string.
function newCompileStringRequest(
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

  const request = newCompileRequest(importers, options);
  request.input = {case: 'string', value: input};
  return request;
}

// Creates a compilation request for the given `options` without adding any
// input-specific options.
function newCompileRequest(
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

// Spins up a compiler, then sends it a compile request. Returns a promise that
// resolves with the CompileResult. Throws if there were any protocol or
// compilation errors. Shuts down the compiler after compilation.
async function compileRequestAsync(
  request: proto.InboundMessage_CompileRequest,
  importers: ImporterRegistry<'async'>,
  options?: Options<'async'>
): Promise<CompileResult> {
  const functions = new FunctionRegistry(options?.functions);
  const embeddedCompiler = new AsyncEmbeddedCompiler();
  embeddedCompiler.stderr$.subscribe(data => process.stderr.write(data));

  try {
    const dispatcher = createDispatcher<'async'>(
      embeddedCompiler.stdout$,
      buffer => {
        embeddedCompiler.writeStdin(buffer);
      },
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
  } finally {
    embeddedCompiler.close();
    await embeddedCompiler.exit$;
  }
}

// Spins up a compiler, then sends it a compile request. Returns a promise that
// resolves with the CompileResult. Throws if there were any protocol or
// compilation errors. Shuts down the compiler after compilation.
function compileRequestSync(
  request: proto.InboundMessage_CompileRequest,
  importers: ImporterRegistry<'sync'>,
  options?: Options<'sync'>
): CompileResult {
  const functions = new FunctionRegistry(options?.functions);
  const embeddedCompiler = new SyncEmbeddedCompiler();
  embeddedCompiler.stderr$.subscribe(data => process.stderr.write(data));

  try {
    const dispatcher = createDispatcher<'sync'>(
      embeddedCompiler.stdout$,
      buffer => {
        embeddedCompiler.writeStdin(buffer);
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
      if (!embeddedCompiler.yield()) {
        throw utils.compilerError('Embedded compiler exited unexpectedly.');
      }

      if (error) throw error;
      if (response) return handleCompileResponse(response);
    }
  } finally {
    embeddedCompiler.close();
    embeddedCompiler.yieldUntilExit();
  }
}

/**
 * Creates a dispatcher that dispatches messages from the given `stdout` stream.
 */
function createDispatcher<sync extends 'sync' | 'async'>(
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
    messageTransformer.outboundMessages$,
    message => messageTransformer.writeInboundMessage(message),
    handlers
  );
}

/** Handles a log event according to `options`. */
function handleLogEvent(
  options: Options<'sync' | 'async'> | undefined,
  event: proto.OutboundMessage_LogEvent
): void {
  if (event.type === proto.LogEventType.DEBUG) {
    if (options?.logger?.debug) {
      options.logger.debug(event.message, {
        span: deprotofySourceSpan(event.span!),
      });
    } else {
      console.error(event.formatted);
    }
  } else {
    if (options?.logger?.warn) {
      const params: {deprecation: boolean; span?: SourceSpan; stack?: string} =
        {
          deprecation: event.type === proto.LogEventType.DEPRECATION_WARNING,
        };

      const spanProto = event.span;
      if (spanProto) params.span = deprotofySourceSpan(spanProto);

      const stack = event.stackTrace;
      if (stack) params.stack = stack;

      options.logger.warn(event.message, params);
    } else {
      console.error(event.formatted);
    }
  }
}

/**
 * Converts a `CompileResponse` into a `CompileResult`.
 *
 * Throws a `SassException` if the compilation failed.
 */
function handleCompileResponse(
  response: proto.OutboundMessage_CompileResponse
): CompileResult {
  if (response.result.case === 'success') {
    const success = response.result.value;
    const result: CompileResult = {
      css: success.css,
      loadedUrls: success.loadedUrls.map(url => new URL(url)),
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
