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
import {
  initCompiler,
  OptionsWithLegacy,
  StringOptionsWithLegacy,
} from './sync-compiler';
import {deprotofySourceSpan} from './deprotofy-span';
import {
  removeLegacyImporter,
  removeLegacyImporterFromSpan,
  legacyImporterProtocol,
} from './legacy/utils';

export function compile(
  path: string,
  options?: OptionsWithLegacy<'sync'>
): CompileResult {
  const compiler = initCompiler();
  const result = compiler.compile(path, options);
  compiler.dispose();
  return result;
}

export function compileString(
  source: string,
  options?: StringOptionsWithLegacy<'sync'>
): CompileResult {
  const compiler = initCompiler();
  const result = compiler.compileString(source, options);
  compiler.dispose();
  return result;
}

export function compileAsync(
  path: string,
  options?: OptionsWithLegacy<'async'>
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
  options?: StringOptionsWithLegacy<'async'>
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
  options?: OptionsWithLegacy<'async'> & {legacy?: boolean}
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

/** Handles a log event according to `options`. */
function handleLogEvent(
  options: OptionsWithLegacy<'sync' | 'async'> | undefined,
  event: proto.OutboundMessage_LogEvent
): void {
  let span = event.span ? deprotofySourceSpan(event.span) : null;
  if (span && options?.legacy) span = removeLegacyImporterFromSpan(span);
  let message = event.message;
  if (options?.legacy) message = removeLegacyImporter(message);
  let formatted = event.formatted;
  if (options?.legacy) formatted = removeLegacyImporter(formatted);

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
      const params: {deprecation: boolean; span?: SourceSpan; stack?: string} =
        {
          deprecation: event.type === proto.LogEventType.DEPRECATION_WARNING,
        };
      if (span) params.span = span;

      const stack = event.stackTrace;
      if (stack) {
        params.stack = options?.legacy ? removeLegacyImporter(stack) : stack;
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
function handleCompileResponse(
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
