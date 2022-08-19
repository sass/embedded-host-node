// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';
import * as p from 'path';
import {isErrnoException} from './utils';

/** The path to the embedded compiler executable. */
export const compilerPath = (() => {
  try {
    return require.resolve(
      `sass-embedded-${process.platform}-${process.arch}/` + 
        'dart-sass-embedded/dart-sass-embedded' + (
        process.platform === 'win32' ? '.bat' : ''
      )
    );
  } catch (e: unknown) {
    if (!(isErrnoException(e) && e.code === 'MODULE_NOT_FOUND')) {
      throw e;
    }
  }

  // find for development
  for (const path of ['vendor', '../../../lib/src/vendor']) {
    const executable = p.resolve(
      __dirname,
      path,
      `dart-sass-embedded/dart-sass-embedded${
        process.platform === 'win32' ? '.bat' : ''
      }`
    );

    if (fs.existsSync(executable)) return executable;
  }

  throw new Error(
    "Embedded Dart Sass couldn't find the embedded compiler executable. " +
      'Please make sure the optional dependency ' +
      'sass-embedded-${process.platform}-${process.arch} is installed in ' +
      'node_modules.'
  );
})();
