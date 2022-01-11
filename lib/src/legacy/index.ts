// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';
import * as p from 'path';
import {URL, fileURLToPath, pathToFileURL} from 'url';

import {Exception} from '../exception';
import {
  compile,
  compileAsync,
  compileString,
  compileStringAsync,
} from '../compile';
import {
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

// Does some initial adjustments of `options` to make it easier to convert pass
// to the new API.
function adjustOptions<sync extends 'sync' | 'async'>(
  options: LegacyOptions<sync>
): LegacyOptions<sync> {
  if (!('file' in options && options.file) && !('data' in options)) {
    throw new Error('Either options.data or options.file must be set.');
  }

  // The `indentedSyntax` option takes precedence over the file extension in the
  // legacy API, but the new API doesn't have a `syntax` option for a file path.
  // Instead, we eagerly load the entrypoint into memory and treat it like a
  // string source.
  if (
    !isStringOptions(options) &&
    (options as unknown as LegacyStringOptions<sync>).indentedSyntax !==
      undefined
  ) {
    return {
      ...options,
      data: fs.readFileSync(options.file, 'utf8'),
      indentedSyntax: (options as unknown as LegacyStringOptions<sync>)
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

// Converts `LegacySharedOptions` into new API `Options`.
function convertOptions<sync extends 'sync' | 'async'>(
  options: LegacySharedOptions<sync>,
  sync: SyncBoolean<sync>
): Options<sync> {
  if (
    'outputStyle' in options &&
    options.outputStyle !== 'compressed' &&
    options.outputStyle !== 'expanded'
  ) {
    throw new Error(`Unknown output style: "${options.outputStyle}"`);
  }

  const functions: Record<string, CustomFunction<sync>> = {};
  for (const [signature, callback] of Object.entries(options.functions ?? {})) {
    // TODO(nweiz): Provide a real context parameter.
    functions[signature] = wrapFunction({} as LegacyPluginThis, callback, sync);
  }

  return {
    functions,
    sourceMap: wasSourceMapRequested(options),
    loadPaths: options.includePaths,
    style: options.outputStyle as 'compressed' | 'expanded' | undefined,
    quietDeps: options.quietDeps,
    verbose: options.verbose,
    logger: options.logger,
  };
}

// Converts `LegacyStringOptions` into new API `StringOptions`.
function convertStringOptions<sync extends 'sync' | 'async'>(
  options: LegacyStringOptions<sync>,
  sync: SyncBoolean<sync>
): StringOptions<sync> {
  return {
    ...convertOptions(options, sync),
    url: options.file ? pathToFileURL(options.file) : undefined,
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

    sourceMap.sources = sourceMap.sources.map(source => {
      if (source.startsWith('file://')) {
        return pathToUrlString(p.relative(sourceMapDir, fileURLToPath(source)));
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
      includedFiles: result.loadedUrls.map(url =>
        url.protocol === 'file:' ? fileURLToPath(url as URL) : url.toString()
      ),
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

  const file = error.span?.url
    ? // We have to cast to Node's URL type here because the specified type is the
      // standard URL type which is slightly less featureful. `fileURLToPath()`
      // does work with standard URL objects in practice, but we know that we
      // generate Node URLs here regardless.
      fileURLToPath(error.span?.url as URL)
    : 'stdin';

  return Object.assign(new Error(), {
    status: 1,
    message: error.toString().replace(/^Error: /, ''),
    formatted: error.toString(),
    toString: () => error.toString(),
    stack: error.stack,
    line: isNullOrUndefined(error.span?.start.line)
      ? undefined
      : error.span!.start.line + 1,
    column: isNullOrUndefined(error.span?.start.column)
      ? undefined
      : error.span!.start.column + 1,
    file,
  });
}
