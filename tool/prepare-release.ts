// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {promises as fs} from 'fs';
import * as shell from 'shelljs';

import * as pkg from '../package.json';
import {getEmbeddedProtocol, getJSApi} from './utils';

shell.config.fatal = true;

(async () => {
  try {
    await sanityCheckBeforeRelease();

    await getEmbeddedProtocol('lib/src/vendor');

    await getJSApi('lib/src/vendor');

    console.log('Transpiling TS into dist.');
    shell.exec('tsc');

    console.log('Copying JS API types to dist.');
    shell.cp('-R', 'lib/src/vendor/sass', 'dist/types');
    await fs.unlink('dist/types/README.md');

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

// Quick sanity checks to make sure the release we are preparing is a suitable
// candidate for release.
async function sanityCheckBeforeRelease() {
  console.log('Running sanity checks before releasing.');
  const releaseVersion = pkg.version;

  const ref = process.env['GITHUB_REF'];
  if (ref !== `refs/tags/${releaseVersion}`) {
    throw Error(
      `GITHUB_REF ${ref} is different than the package.json version ${releaseVersion}.`
    );
  }

  for (const [dep, version] of Object.entries(pkg.optionalDependencies)) {
    if (version !== releaseVersion) {
      throw Error(
        `optional dependency ${dep}'s version doesn't match ${releaseVersion}.`
      );
    }
  }

  if (releaseVersion.indexOf('-dev') > 0) {
    throw Error(`${releaseVersion} is a dev release.`);
  }

  const versionHeader = new RegExp(`^## ${releaseVersion}$`, 'm');
  const changelog = await fs.readFile('CHANGELOG.md', 'utf8');
  if (!changelog.match(versionHeader)) {
    throw Error(`There's no CHANGELOG entry for ${releaseVersion}.`);
  }
}
