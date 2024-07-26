// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';
import * as p from 'path';
import {getElfInterpreter} from './elf';
import {isErrnoException} from './utils';

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
      `Warning: Failed to detect linux-musl, fallback to linux-gnu: ${error.message}`
    );
    return false;
  }
}

/** The full command for the embedded compiler executable. */
export const compilerCommand = (() => {
  const platform =
    process.platform === 'linux' && isLinuxMusl(process.execPath)
      ? 'linux-musl'
      : (process.platform as string);

  const arch = process.arch;

  // find for development
  for (const path of ['vendor', '../../../lib/src/vendor']) {
    const executable = p.resolve(
      __dirname,
      path,
      `dart-sass/sass${platform === 'win32' ? '.bat' : ''}`
    );

    if (fs.existsSync(executable)) return [executable];
  }

  try {
    return [
      require.resolve(
        `sass-embedded-${platform}-${arch}/dart-sass/src/dart` +
          (platform === 'win32' ? '.exe' : '')
      ),
      require.resolve(
        `sass-embedded-${platform}-${arch}/dart-sass/src/sass.snapshot`
      ),
    ];
  } catch (_ignored) {
    // ignored
  }

  try {
    return [
      require.resolve(
        `sass-embedded-${platform}-${arch}/dart-sass/sass` +
          (platform === 'win32' ? '.bat' : '')
      ),
    ];
  } catch (e: unknown) {
    if (!(isErrnoException(e) && e.code === 'MODULE_NOT_FOUND')) {
      throw e;
    }
  }

  throw new Error(
    "Embedded Dart Sass couldn't find the embedded compiler executable. " +
      'Please make sure the optional dependency ' +
      `sass-embedded-${platform}-${arch} is installed in ` +
      'node_modules.'
  );
})();
