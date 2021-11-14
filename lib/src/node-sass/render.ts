// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from 'path';
import {RawSourceMap} from 'source-map-js';
import {fileURLToPath, pathToFileURL} from 'url';

import {compile, compileString} from '../compile';
import {SassException} from '../exception/exception';
import {isNullOrUndefined, pathToUrlString, withoutExtension} from '../utils';

/**
 * Options that are passed to render().
 *
 * This attempts to match the Node Sass render options as closely as possible
 * (see: https://github.com/sass/node-sass#options).
 */
export type RenderOptions = (FileOptions | StringOptions) & SharedOptions;

interface FileOptions extends SharedOptions {
  file: string;
}

interface StringOptions extends SharedOptions {
  data: string;
  file?: string;
  indentedSyntax?: boolean;
}

interface SharedOptions {
  omitSourceMapUrl?: boolean;
  outFile?: string | null;
  sourceMap?: boolean | string;
  // TODO(awjin): https://github.com/sass/embedded-protocol/issues/46
  // sourceMapContents?: boolean;
  sourceMapEmbed?: boolean;
  sourceMapRoot?: string;
  // TODO(awjin): https://github.com/sass/embedded-host-node/issues/13
  // importer
  includePaths?: string[];
  // functions
  // outputStyle
}

/**
 * The result returned by render().
 *
 * This attempts to match the Node Sass result object as closely as possible
 * (see: https://github.com/sass/node-sass#result-object).
 */
export interface RenderResult {
  css: Buffer;
  map?: Buffer;
  stats: {
    start: number;
    end: number;
    duration: number;
    entry: string;
    // TODO(awjin): https://github.com/sass/embedded-protocol/issues/46
    // includedFiles?: string[];
  };
}

/**
 * An error thrown by render().
 *
 * This attempts to match the Node Sass error object as closely as possible
 * (see: https://github.com/sass/node-sass#error-object).
 */
export interface RenderError extends Error {
  status: number;
  message: string;
  formatted?: string;
  line?: number;
  column?: number;
  file?: string;
}

/**
 * Converts Sass to CSS.
 *
 * This attempts to match the Node Sass `render()` API as closely as possible
 * (see: https://github.com/sass/node-sass#usage).
 */
export function render(
  options: RenderOptions,
  callback: (error?: RenderError, result?: RenderResult) => void
): void {
  const fileRequest = options as FileOptions;
  const stringRequest = options as StringOptions;

  if (!fileRequest.file && isNullOrUndefined(stringRequest.data)) {
    callback(
      newRenderError(Error('Either options.data or options.file must be set.'))
    );
    return;
  }

  let sourceMap: RawSourceMap | undefined;
  const getSourceMap = wasSourceMapRequested(options)
    ? (map: RawSourceMap) => (sourceMap = map)
    : undefined;

  const start = Date.now();
  const compileSass = stringRequest.data
    ? compileString({
        source: stringRequest.data,
        sourceMap: getSourceMap,
        url: stringRequest.file ? pathToFileURL(stringRequest.file) : 'stdin',
        syntax: stringRequest.indentedSyntax ? 'indented' : 'scss',
        includePaths: stringRequest.includePaths ?? [],
      })
    : compile({
        path: fileRequest.file,
        sourceMap: getSourceMap,
        includePaths: fileRequest.includePaths ?? [],
      });

  compileSass.then(
    css => callback(undefined, newRenderResult(options, start, css, sourceMap)),
    error => callback(newRenderError(error))
  );
}

// Determines whether a sourceMap was requested by the call to render().
function wasSourceMapRequested(options: RenderOptions): boolean {
  return (
    typeof options.sourceMap === 'string' ||
    (options.sourceMap === true && !!options.outFile)
  );
}

// Transforms the compilation result into an object that mimics the Node Sass
// API format.
function newRenderResult(
  options: RenderOptions,
  start: number,
  css: string,
  sourceMap?: RawSourceMap
): RenderResult {
  const end = Date.now();
  let sourceMapBytes: Buffer | undefined;

  if (sourceMap) {
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
      sourceMap.file = pathToUrlString(
        p.relative(sourceMapDir, withoutExtension(options.file) + '.css')
      );
    } else {
      sourceMap.file = 'stdin.css';
    }

    sourceMap.sources = sourceMap.sources.map(source => {
      if (source.startsWith('file://')) {
        return pathToUrlString(p.relative(sourceMapDir, fileURLToPath(source)));
      }
      return source;
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
    },
  };
}

// Decorates an Error with additional fields so that it behaves like a Node Sass
// error.
function newRenderError(error: Error | SassException): RenderError {
  if (!(error instanceof SassException)) {
    return Object.assign(error, {
      status: 3,
    });
  }

  let file = error.span?.url || undefined;
  if (file && file !== 'stdin') {
    file = fileURLToPath(file);
  }

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
