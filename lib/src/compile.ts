// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {initAsyncCompiler} from './compiler/async';
import {initCompiler} from './compiler/sync';
import {CompileResult, Options, StringOptions} from './vendor/sass';

export {NodePackageImporter} from './importer-registry';

export function compile(
  path: string,
  options?: Options<'sync'>,
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
  options?: StringOptions<'sync'>,
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
  options?: Options<'async'>,
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
  options?: StringOptions<'async'>,
): Promise<CompileResult> {
  const compiler = await initAsyncCompiler();
  try {
    return await compiler.compileStringAsync(source, options);
  } finally {
    await compiler.dispose();
  }
}
