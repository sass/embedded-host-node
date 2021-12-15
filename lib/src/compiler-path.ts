// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';
import * as p from 'path';

/** The path to the embedded compiler executable. */
export const compilerPath = (() => {
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
    "Embedded Dart Sass couldn't find the embedded compiler executable."
  );
})();
