// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';
import * as p from 'path';
import {pathToFileURL, URL} from 'url';

import {Exception} from '../exception';
import {
  compile,
  compileAsync,
  compileString,
  compileStringAsync,
} from '../compile';
import {
  fileUrlToPathCrossPlatform,
  isNullOrUndefined,
  pathToUrlString,
  withoutExtension,
  SyncBoolean,
} from '../utils';
import {
  CompileResult,
  CustomFunction,
  LegacyException,
  LegacyOptions,
  LegacyPluginThis,
  LegacyResult,
  LegacySharedOptions,
  LegacyStringOptions,
  Options,
  StringOptions,
} from '../vendor/sass';
import {wrapFunction} from './value/wrap';
import {endOfLoadProtocol, LegacyImporterWrapper} from './importer';
import {
  legacyImporterProtocol,
  pathToLegacyFileUrl,
  removeLegacyImporter,
  removeLegacyImporterFromSpan,
} from './utils';

export function render(
  options: LegacyOptions<'async'>,
  callback: (error?: LegacyException, result?: LegacyResult) => void
): void {
  try {
    options = adjustOptions(options);

    const start = Date.now();
    const compileSass = isStringOptions(options)
      ? compileStringAsync(options.data, convertStringOptions(options, false))
      : compileAsync(options.file, convertOptions(options, false));

    compileSass.then(
      result => callback(undefined, newLegacyResult(options, start, result)),
      error => callback(newLegacyException(error))
    );
  } catch (error) {
    if (error instanceof Error) callback(newLegacyException(error));
    throw error;
  }
}

export function renderSync(options: LegacyOptions<'sync'>): LegacyResult {
  const start = Date.now();
  try {
    options = adjustOptions(options);
    const result = isStringOptions(options)
      ? compileString(options.data, convertStringOptions(options, true))
      : compile(options.file, convertOptions(options, true));
    return newLegacyResult(options, start, result);
  } catch (error: unknown) {
    throw newLegacyException(error as Error);
  }
}

// Does some initial adjustments of `options` to make it easier to pass to the
// new API.
function adjustOptions<sync extends 'sync' | 'async'>(
  options: LegacyOptions<sync>
): LegacyOptions<sync> {
  if (!('file' in options && options.file) && !('data' in options)) {
    throw new Error('Either options.data or options.file must be set.');
  }

  // In legacy API, the current working directory is always attempted before
  // any load path.
  options.includePaths = [process.cwd(), ...(options.includePaths ?? [])];

  if (
    !isStringOptions(options) &&
    // The `indentedSyntax` option takes precedence over the file extension in the
    // legacy API, but the new API doesn't have a `syntax` option for a file path.
    // Instead, we eagerly load the entrypoint into memory and treat it like a
    // string source.
    ((options as unknown as LegacyStringOptions<sync>).indentedSyntax !==
      undefined ||
      options.importer)
  ) {
    return {
      ...options,
      data: fs.readFileSync(options.file, 'utf8'),
      indentedSyntax: !!(options as unknown as LegacyStringOptions<sync>)
        .indentedSyntax,
    };
  } else {
    return options;
  }
}

// Returns whether `options` is a `LegacyStringOptions`.
function isStringOptions<sync extends 'sync' | 'async'>(
  options: LegacyOptions<sync>
): options is LegacyStringOptions<sync> {
  return 'data' in options;
}

// Converts `LegacyOptions` into new API `Options`.
function convertOptions<sync extends 'sync' | 'async'>(
  options: LegacyOptions<sync>,
  sync: SyncBoolean<sync>
): Options<sync> & {legacy: true} {
  if (
    'outputStyle' in options &&
    options.outputStyle !== 'compressed' &&
    options.outputStyle !== 'expanded'
  ) {
    throw new Error(`Unknown output style: "${options.outputStyle}"`);
  }

  const self = pluginThis(options);
  const functions: Record<string, CustomFunction<sync>> = {};
  for (let [signature, callback] of Object.entries(options.functions ?? {})) {
    // The legacy API allows signatures without parentheses but the modern API
    // does not.
    if (!signature.includes('(')) signature += '()';

    functions[signature.trimLeft()] = wrapFunction(self, callback, sync);
  }

  const importers =
    options.importer &&
    (!(options.importer instanceof Array) || options.importer.length > 0)
      ? [
          new LegacyImporterWrapper(
            self,
            options.importer instanceof Array
              ? options.importer
              : [options.importer],
            options.includePaths ?? [],
            options.file ?? 'stdin',
            sync
          ),
        ]
      : undefined;

  return {
    functions,
    importers,
    sourceMap: wasSourceMapRequested(options),
    sourceMapIncludeSources: options.sourceMapContents,
    loadPaths: importers ? undefined : options.includePaths,
    style: options.outputStyle as 'compressed' | 'expanded' | undefined,
    quietDeps: options.quietDeps,
    verbose: options.verbose,
    charset: options.charset,
    logger: options.logger,
    legacy: true,
  };
}

// Converts `LegacyStringOptions` into new API `StringOptions`.
function convertStringOptions<sync extends 'sync' | 'async'>(
  options: LegacyStringOptions<sync>,
  sync: SyncBoolean<sync>
): StringOptions<sync> & {legacy: true} {
  const modernOptions = convertOptions(options, sync);

  return {
    ...modernOptions,
    url: options.file
      ? options.importer
        ? pathToLegacyFileUrl(options.file)
        : pathToFileURL(options.file)
      : new URL(legacyImporterProtocol),
    importer: modernOptions.importers ? modernOptions.importers[0] : undefined,
    syntax: options.indentedSyntax ? 'indented' : 'scss',
  };
}

// Determines whether a sourceMap was requested by the call to `render()`.
function wasSourceMapRequested(
  options: LegacySharedOptions<'sync' | 'async'>
): boolean {
  return (
    typeof options.sourceMap === 'string' ||
    (options.sourceMap === true && !!options.outFile)
  );
}

// Creates the `this` value that's used for callbacks.
function pluginThis(
  options: LegacyOptions<'sync' | 'async'>
): LegacyPluginThis {
  const pluginThis: LegacyPluginThis = {
    options: {
      context: undefined as unknown as LegacyPluginThis,
      file: options.file,
      data: options.data,
      includePaths: (options.includePaths ?? []).join(p.delimiter),
      precision: 10,
      style: 1,
      indentType: 0,
      indentWidth: 2,
      linefeed: '\n',
      result: {
        stats: {
          start: Date.now(),
          entry: options.file ?? 'data',
        },
      },
    },
  };
  pluginThis.options.context = pluginThis;
  return pluginThis;
}

// Transforms the compilation result into an object that mimics the Node Sass
// API format.
function newLegacyResult(
  options: LegacyOptions<'sync' | 'async'>,
  start: number,
  result: CompileResult
): LegacyResult {
  const end = Date.now();

  let css = result.css;
  let sourceMapBytes: Buffer | undefined;
  if (result.sourceMap) {
    const sourceMap = result.sourceMap;
    sourceMap.sourceRoot = options.sourceMapRoot ?? '';

    const sourceMapPath =
      typeof options.sourceMap === 'string'
        ? (options.sourceMap as string)
        : options.outFile + '.map';
    const sourceMapDir = p.dirname(sourceMapPath);

    if (options.outFile) {
      sourceMap.file = pathToUrlString(
        p.relative(sourceMapDir, options.outFile)
      );
    } else if (options.file) {
      sourceMap.file = pathToUrlString(withoutExtension(options.file) + '.css');
    } else {
      sourceMap.file = 'stdin.css';
    }

    sourceMap.sources = sourceMap.sources
      .filter(source => !source.startsWith(endOfLoadProtocol))
      .map(source => {
        source = removeLegacyImporter(source);
        if (source.startsWith('file://')) {
          return pathToUrlString(
            p.relative(sourceMapDir, fileUrlToPathCrossPlatform(source))
          );
        } else if (source.startsWith('data:')) {
          return 'stdin';
        } else {
          return source;
        }
      });

    sourceMapBytes = Buffer.from(JSON.stringify(sourceMap));

    if (!options.omitSourceMapUrl) {
      let url;
      if (options.sourceMapEmbed) {
        url = `data:application/json;base64,${sourceMapBytes.toString(
          'base64'
        )}`;
      } else if (options.outFile) {
        url = pathToUrlString(
          p.relative(p.dirname(options.outFile), sourceMapPath)
        );
      } else {
        url = pathToUrlString(sourceMapPath);
      }
      css += `\n\n/*# sourceMappingURL=${url} */`;
    }
  }

  return {
    css: Buffer.from(css),
    map: sourceMapBytes,
    stats: {
      entry: options.file ?? 'data',
      start,
      end,
      duration: end - start,
      includedFiles: result.loadedUrls
        .filter(url => url.protocol !== endOfLoadProtocol)
        .map(url => {
          if (url.protocol === legacyImporterProtocol) {
            return decodeURI(url.pathname);
          }

          const urlString = removeLegacyImporter(url.toString());
          return urlString.startsWith('file:')
            ? fileUrlToPathCrossPlatform(urlString)
            : urlString;
        }),
    },
  };
}

// Decorates an Error with additional fields so that it behaves like a Node Sass
// error.
function newLegacyException(error: Error): LegacyException {
  if (!(error instanceof Exception)) {
    return Object.assign(error, {
      formatted: error.toString(),
      status: 3,
    });
  }

  const span = error.span ? removeLegacyImporterFromSpan(error.span) : null;
  let file: string;
  if (!span?.url) {
    file = 'stdin';
  } else if (span.url.protocol === 'file:') {
    // We have to cast to Node's URL type here because the specified type is the
    // standard URL type which is slightly less featureful. `fileURLToPath()`
    // does work with standard URL objects in practice, but we know that we
    // generate Node URLs here regardless.
    file = fileUrlToPathCrossPlatform(span.url as URL);
  } else {
    file = span.url.toString();
  }

  const errorString = removeLegacyImporter(error.toString());
  return Object.assign(new Error(), {
    status: 1,
    message: errorString.replace(/^Error: /, ''),
    formatted: errorString,
    toString: () => errorString,
    stack: error.stack ? removeLegacyImporter(error.stack) : undefined,
    line: isNullOrUndefined(error.span?.start.line)
      ? undefined
      : error.span!.start.line + 1,
    column: isNullOrUndefined(error.span?.start.column)
      ? undefined
      : error.span!.start.column + 1,
    file,
  });
}
