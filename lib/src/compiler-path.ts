// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';
import * as p from 'path';
import {isErrnoException} from './utils';

/** The full command for the embedded compiler executable. */
export const compilerCommand = (() => {
  // find for development
  for (const path of ['vendor', '../../../lib/src/vendor']) {
    const executable = p.resolve(
      __dirname,
      path,
      `dart-sass/sass${process.platform === 'win32' ? '.bat' : ''}`
    );

    if (fs.existsSync(executable)) return [executable];
  }

  try {
    return [
      require.resolve(
        `sass-embedded-${process.platform}-${process.arch}/` +
          'dart-sass/src/dart' +
          (process.platform === 'win32' ? '.exe' : '')
      ),
      require.resolve(
        `sass-embedded-${process.platform}-${process.arch}/` +
          'dart-sass/src/sass.snapshot'
      ),
    ];
  } catch (ignored) {
    // ignored
  }

  try {
    return [
      require.resolve(
        `sass-embedded-${process.platform}-${process.arch}/` +
          'dart-sass/sass' +
          (process.platform === 'win32' ? '.bat' : '')
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
      `sass-embedded-${process.platform}-${process.arch} is installed in ` +
      'node_modules.'
  );
})();
