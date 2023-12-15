// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';
import * as p from 'path';
import {isErrnoException} from './utils';

const isLinuxMusl = function () {
  return fs.readFileSync(process.execPath).includes('/ld-musl-');
};

/** The full command for the embedded compiler executable. */
export const compilerCommand = (() => {
  let platform = process.platform as string;
  let arch = process.arch;

  if (platform === 'linux' && isLinuxMusl()) {
    platform = 'linux-musl';
  }

  // https://github.com/sass/embedded-host-node/issues/263
  // Use windows-x64 emulation on windows-arm64
  //
  // TODO: Make sure to remove "arm64" from "npm/win32-x64/package.json" when
  // this logic is removed once we have true windows-arm64 support.
  if (platform === 'win32' && arch === 'arm64') {
    arch = 'x64';
  }

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
  } catch (ignored) {
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
