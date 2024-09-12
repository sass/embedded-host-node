// Copyright 2024 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from 'path';
import * as supportsColor from 'supports-color';
import {create} from '@bufbuild/protobuf';

import {Deprecation, deprecations, getDeprecationIds} from '../deprecations';
import {deprotofySourceSpan} from '../deprotofy-span';
import {Dispatcher, DispatcherHandlers} from '../dispatcher';
import {Exception} from '../exception';
import {ImporterRegistry} from '../importer-registry';
import {
  legacyImporterProtocol,
  removeLegacyImporter,
  removeLegacyImporterFromSpan,
} from '../legacy/utils';
import {Logger} from '../logger';
import {MessageTransformer} from '../message-transformer';
import * as utils from '../utils';
import * as proto from '../vendor/embedded_sass_pb';
import {SourceSpan} from '../vendor/sass';
import {CompileResult} from '../vendor/sass/compile';
import {Options, StringOptions} from '../vendor/sass/options';

/**
 * Allow the legacy API to pass in an option signaling to the modern API that
 * it's being run in legacy mode.
 *
 * This is not intended for API users to pass in, and may be broken without
 * warning in the future.
 */
export type OptionsWithLegacy<sync extends 'sync' | 'async'> = Options<sync> & {
  legacy?: boolean;
};

/**
 * Allow the legacy API to pass in an option signaling to the modern API that
 * it's being run in legacy mode.
 *
 * This is not intended for API users to pass in, and may be broken without
 * warning in the future.
 */
export type StringOptionsWithLegacy<sync extends 'sync' | 'async'> =
  StringOptions<sync> & {legacy?: boolean};

/**
 * Creates a dispatcher that dispatches messages from the given `stdout` stream.
 */
export function createDispatcher<sync extends 'sync' | 'async'>(
  compilationId: number,
  messageTransformer: MessageTransformer,
  handlers: DispatcherHandlers<sync>
): Dispatcher<sync> {
  return new Dispatcher<sync>(
    compilationId,
    messageTransformer.outboundMessages$,
    message => messageTransformer.writeInboundMessage(message),
    handlers
  );
}

// Creates a compilation request for the given `options` without adding any
// input-specific options.
function newCompileRequest(
  importers: ImporterRegistry<'sync' | 'async'>,
  options?: Options<'sync' | 'async'>
): proto.InboundMessage_CompileRequest {
  const request = create(proto.InboundMessage_CompileRequestSchema, {
    importers: importers.importers,
    globalFunctions: Object.keys(options?.functions ?? {}),
    sourceMap: !!options?.sourceMap,
    sourceMapIncludeSources: !!options?.sourceMapIncludeSources,
    alertColor: options?.alertColor ?? !!supportsColor.stdout,
    alertAscii: !!options?.alertAscii,
    quietDeps: !!options?.quietDeps,
    verbose: !!options?.verbose,
    charset: !!(options?.charset ?? true),
    silent: options?.logger === Logger.silent,
    fatalDeprecation: getDeprecationIds(options?.fatalDeprecations ?? []),
    silenceDeprecation: getDeprecationIds(options?.silenceDeprecations ?? []),
    futureDeprecation: getDeprecationIds(options?.futureDeprecations ?? []),
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
export function newCompilePathRequest(
  path: string,
  importers: ImporterRegistry<'sync' | 'async'>,
  options?: Options<'sync' | 'async'>
): proto.InboundMessage_CompileRequest {
  const absPath = p.resolve(path);
  const request = newCompileRequest(importers, options);
  request.input = {case: 'path', value: absPath};
  return request;
}

// Creates a request for compiling a string.
export function newCompileStringRequest(
  source: string,
  importers: ImporterRegistry<'sync' | 'async'>,
  options?: StringOptions<'sync' | 'async'>
): proto.InboundMessage_CompileRequest {
  const input = create(proto.InboundMessage_CompileRequest_StringInputSchema, {
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
    input.importer = create(
      proto.InboundMessage_CompileRequest_ImporterSchema,
      {
        importer: {case: 'path', value: p.resolve('.')},
      }
    );
  } else {
    // When importer is not set on the host, the compiler will set a
    // FileSystemImporter if `url` is set to a file: url or a NoOpImporter.
  }

  const request = newCompileRequest(importers, options);
  request.input = {case: 'string', value: input};
  return request;
}

/** Type guard to check that `id` is a valid deprecation ID. */
function validDeprecationId(
  id: string | number | symbol | undefined
): id is keyof typeof deprecations {
  return !!id && id in deprecations;
}

/** Handles a log event according to `options`. */
export function handleLogEvent(
  options: OptionsWithLegacy<'sync' | 'async'> | undefined,
  event: proto.OutboundMessage_LogEvent
): void {
  let span = event.span ? deprotofySourceSpan(event.span) : null;
  if (span && options?.legacy) span = removeLegacyImporterFromSpan(span);
  let message = event.message;
  if (options?.legacy) message = removeLegacyImporter(message);
  let formatted = event.formatted;
  if (options?.legacy) formatted = removeLegacyImporter(formatted);
  const deprecationType = validDeprecationId(event.deprecationType)
    ? deprecations[event.deprecationType]
    : null;

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
      const params: (
        | {
            deprecation: true;
            deprecationType: Deprecation;
          }
        | {deprecation: false}
      ) & {
        span?: SourceSpan;
        stack?: string;
      } = deprecationType
        ? {deprecation: true, deprecationType: deprecationType}
        : {deprecation: false};
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
export function handleCompileResponse(
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
