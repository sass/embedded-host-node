// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from 'path';
import {RawSourceMap} from 'source-map';
import {fileURLToPath, pathToFileURL} from 'url';

import {compile, compileString} from '../compile';
import {SassException} from '../exception/exception';
import {isEmpty} from '../utils';

/**
 * Options that are passed to render().
 *
 * This attempts to match the Node Sass render options as closely as possible
 * (see: https://github.com/sass/node-sass#options).
 */
export interface RenderOptions {
  file?: string;
  data?: string;
  omitSourceMapUrl?: boolean;
  outFile?: string | null;
  sourceMap?: boolean | string;
  // TODO(awjin): https://github.com/sass/embedded-protocol/issues/46
  // sourceMapContents?: boolean;
  sourceMapEmbed?: boolean;
  sourceMapRoot?: string;
  // TODO(awjin): https://github.com/sass/embedded-host-node/issues/13
  // importer
  // includePaths
  // indentedSyntax
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
  message: string;
  status: number;
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
export async function render(
  options: RenderOptions,
  callback: (error?: RenderError, result?: RenderResult) => void
): Promise<void> {
  const file = options.file ? p.resolve(options.file) : undefined;
  if (file === undefined && options.data === undefined) {
    callback(
      newRenderError(Error('Either options.data or options.file must be set.'))
    );
    return;
  }

  let sourceMap;
  const getSourceMap = wasSourceMapRequested(options)
    ? (map: RawSourceMap) => (sourceMap = map)
    : undefined;

  try {
    const start = Date.now();
    const css = options.data
      ? await compileString({
          source: options.data,
          sourceMap: getSourceMap,
          url: isEmpty(options.file) ? 'stdin' : pathToFileURL(options.file!),
        })
      : await compile({path: file!, sourceMap: getSourceMap});
    callback(undefined, newRenderResult(options, start, css, sourceMap));
  } catch (error) {
    callback(newRenderError(error));
  }
}

// Determines whether a sourceMap was requested by the call to render().
function wasSourceMapRequested(options: RenderOptions): boolean {
  return (
    typeof options.sourceMap === 'string' ||
    (options.sourceMap === true && !isEmpty(options.outFile))
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
  let sourceMapBytes;

  if (wasSourceMapRequested(options)) {
    sourceMap = sourceMap!;
    sourceMap.sourceRoot = options.sourceMapRoot ?? '';

    const sourceMapPath =
      typeof options.sourceMap === 'string'
        ? (options.sourceMap as string)
        : options.outFile + '.map';
    const sourceMapDir = p.dirname(sourceMapPath);

    if (isEmpty(options.outFile)) {
      if (isEmpty(options.file)) {
        sourceMap.file = 'stdin.css';
      } else {
        const extension = p.extname(options.file!);
        sourceMap.file =
          extension === ''
            ? `${options.file}.css`
            : options.file!.replace(new RegExp(`${extension}$`), '.css');
      }
    } else {
      sourceMap.file = p.relative(sourceMapDir, options.outFile!);
    }

    sourceMap.sources = sourceMap.sources.map(source => {
      if (source === 'stdin') return source;
      return p.relative(sourceMapDir, fileURLToPath(source));
    });

    sourceMapBytes = Buffer.from(JSON.stringify(sourceMap));

    if (!options.omitSourceMapUrl) {
      let url;
      if (options.sourceMapEmbed) {
        url = `data:application/json;base64,${sourceMapBytes.toString(
          'base64'
        )}`;
      } else if (isEmpty(options.outFile)) {
        url = sourceMapPath;
      } else {
        url = p.relative(p.dirname(options.outFile!), sourceMapPath);
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

  let file = error.span?.url;
  if (!isEmpty(file) && file !== 'stdin') {
    file = fileURLToPath(file!);
  }

  return Object.assign(new Error(), {
    status: 1,
    message: error.toString().replace(/^Error: /, ''),
    stack: error.stack,
    line:
      error.span?.start.line === undefined
        ? undefined
        : error.span.start.line + 1,
    column:
      error.span?.start.column === undefined
        ? undefined
        : error.span.start.column + 1,
    file,
    formatted: error.toString(),
    toString: () => error.toString(),
  });
}
