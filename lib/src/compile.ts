// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {initAsyncCompiler} from './compiler/async';
import {OptionsWithLegacy, StringOptionsWithLegacy} from './compiler/utils';
import {initCompiler} from './compiler/sync';
import {CompileResult} from './vendor/sass';

export {NodePackageImporter} from './importer-registry';

export function compile(
  path: string,
  options?: OptionsWithLegacy<'sync'>,
): CompileResult {
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
  const compiler = await initAsyncCompiler();
  try {
    return await compiler.compileStringAsync(source, options);
  } finally {
    await compiler.dispose();
  }
}
