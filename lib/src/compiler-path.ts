// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';
import * as p from 'path';

const {platform, arch} = process;

const PACKAGES: {[key: string]: string} = {
  'linux arm64': '@sass-embedded/linux-arm64',
  'linux ia32': '@sass-embedded/linux-ia32',
  'linux x64': '@sass-embedded/linux-x64',
  'darwin arm64': '@sass-embedded/macos-arm64',
  'darwin x64': '@sass-embedded/macos-x64',
  'win32 ia32': '@sass-embedded/windows-ia32',
  'win32 x64': '@sass-embedded/windows-x64',
};

/** The path to the embedded compiler executable. */
export const compilerPath = (() => {
  try {
    const executable = require.resolve(
      `${
        PACKAGES[`${platform} ${arch}`]
      }/dart-sass-embedded/dart-sass-embedded${
        platform === 'win32' ? '.bat' : ''
      }`
    );

    if (fs.existsSync(executable)) return executable;
  } catch (e) {
    // ignore
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
    "Embedded Dart Sass couldn't find the embedded compiler executable."
  );
})();
