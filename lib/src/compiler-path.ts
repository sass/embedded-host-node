// Copyright 2021 Google LLC. Use of this source code is governed by an
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

/** The full command for the embedded compiler executable. */
export const compilerCommand = (() => {
  try {
    return [
      require.resolve(
        `${compilerModule}/dart-sass/src/dart` +
          (process.platform === 'win32' ? '.exe' : ''),
      ),
      require.resolve(`${compilerModule}/dart-sass/src/sass.snapshot`),
    ];
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }
  }

  try {
    return [
      require.resolve(
        `${compilerModule}/dart-sass/sass` +
          (process.platform === 'win32' ? '.bat' : ''),
      ),
    ];
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }
  }

  try {
    return [
      process.execPath,
      p.join(p.dirname(require.resolve('sass')), 'sass.js'),
    ];
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }
  }

  throw new Error(
    "Embedded Dart Sass couldn't find the embedded compiler executable. " +
      `Please make sure the optional dependency ${compilerModule} or sass is ` +
      'installed in node_modules.',
  );
})();
