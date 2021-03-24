// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {promises as fs} from 'fs';
import * as shell from 'shelljs';

import {getEmbeddedProtocol} from './utils';

shell.config.fatal = true;

(async () => {
  try {
    await getEmbeddedProtocol({outPath: 'lib/src/vendor', release: true});

    console.log('Transpiling TS into dist.');
    shell.exec('tsc');

    // .gitignore needs to exist in dist for `npm publish` to correctly exclude
    // files from the published tarball.
    console.log('Copying .gitignore to dist.');
    await fs.copyFile('.gitignore', 'dist/.gitignore');

    console.log('Ready for publishing to npm.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
