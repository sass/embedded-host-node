// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {initAsyncCompiler} from './compiler/async';
import {OptionsWithLegacy, StringOptionsWithLegacy} from './compiler/utils';
import {initCompiler} from './compiler/sync';
import {CompileResult, SourceMapIncludeSources} from './vendor/sass';
import {
  DeprecationOptions,
  deprecations,
  warnForHostSideDeprecation,
} from './deprecations';

export {NodePackageImporter} from './importer-registry';

export function compile(
  path: string,
  options?: OptionsWithLegacy<'sync'>,
): CompileResult {
  _warnForSourceMapIncludeSourcesBoolean(
    options?.sourceMapIncludeSources,
    options?.legacy,
    options,
  );
  const compiler = initCompiler();
  try {
    return compiler.compile(path, options);
  } finally {
    compiler.dispose();
  }
}

export function compileString(
  source: string,
  options?: StringOptionsWithLegacy<'sync'>,
): CompileResult {
  _warnForSourceMapIncludeSourcesBoolean(
    options?.sourceMapIncludeSources,
    options?.legacy,
    options,
  );
  const compiler = initCompiler();
  try {
    return compiler.compileString(source, options);
  } finally {
    compiler.dispose();
  }
}

export async function compileAsync(
  path: string,
  options?: OptionsWithLegacy<'async'>,
): Promise<CompileResult> {
  _warnForSourceMapIncludeSourcesBoolean(
    options?.sourceMapIncludeSources,
    options?.legacy,
    options,
  );
  const compiler = await initAsyncCompiler();
  try {
    return await compiler.compileAsync(path, options);
  } finally {
    await compiler.dispose();
  }
}

export async function compileStringAsync(
  source: string,
  options?: StringOptionsWithLegacy<'async'>,
): Promise<CompileResult> {
  _warnForSourceMapIncludeSourcesBoolean(
    options?.sourceMapIncludeSources,
    options?.legacy,
    options,
  );
  const compiler = await initAsyncCompiler();
  try {
    return await compiler.compileStringAsync(source, options);
  } finally {
    await compiler.dispose();
  }
}

function _warnForSourceMapIncludeSourcesBoolean(
  sourceMapIncludeSources?: SourceMapIncludeSources | boolean,
  legacy?: boolean,
  options?: DeprecationOptions,
): void {
  if (
    legacy !== true &&
    (sourceMapIncludeSources === true || sourceMapIncludeSources === false)
  ) {
    const suggestion = sourceMapIncludeSources ? 'always' : 'never';
    warnForHostSideDeprecation(
      'Passing a boolean value for Options.sourceMapIncludeSources is' +
        'deprecated and will be removed in Dart Sass 2.0.0.\n' +
        `Please use '${suggestion}' instead of ${sourceMapIncludeSources}.\n\n` +
        'More info: https://sass-lang.com/d/source-map-include-sources-boolean',
      deprecations['source-map-include-sources-boolean'],
      options,
    );
  }
}
