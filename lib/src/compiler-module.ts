// Copyright 2025 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from 'path';
import {getElfInterpreter} from './elf';

/**
 * Detect if the given binary is linked with musl libc by checking if
 * the interpreter basename starts with "ld-musl-"
 */
function isLinuxMusl(path: string): boolean {
  try {
    const interpreter = getElfInterpreter(path);
    return p.basename(interpreter).startsWith('ld-musl-');
  } catch (error) {
    console.warn(
      `Warning: Failed to detect linux-musl, fallback to linux-gnu: ${error.message}`,
    );
    return false;
  }
}

/** The module name for the embedded compiler executable. */
export const compilerModule = (() => {
  const platform =
    process.platform === 'linux' && isLinuxMusl(process.execPath)
      ? 'linux-musl'
      : (process.platform as string);

  const arch = process.arch;

  return `sass-embedded-${platform}-${arch}`;
})();
