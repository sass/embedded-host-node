// Copyright 2022 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from 'path';
import * as shell from 'shelljs';

import * as utils from './utils';
import {spawnSync} from 'child_process';

/**
 * Downloads the Sass language repo and buids the Embedded Sass protocol
 * definition.
 *
 * Can check out and build the source from a Git `ref` or build from the source
 * at `path`. By default, checks out the latest revision from GitHub.
 */
export async function getLanguageRepo(
  outPath: string,
  options?: {ref: string} | {path: string}
): Promise<void> {
  if (!options || 'ref' in options) {
    utils.fetchRepo({
      repo: 'sass',
      outPath: utils.BUILD_PATH,
      ref: options?.ref ?? 'main',
    });
  } else {
    const before = spawnSync('ls', ['-l', 'language\\spec']);
    const beforeCat = spawnSync('cat', ['language\\spec\\README.md']);
    console.log(
      '========================BEFORE==================================',
      before.error,
      before.stdout?.toString() ?? '',
      before.stderr?.toString() ?? '',
      '================================================================',
      beforeCat.stdout?.toString ?? '',
      '================================================================'
    );
    await utils.cleanDir('build/sass');
    await utils.link(options.path, 'build/sass');
    const after = spawnSync('ls', ['-l', 'build\\sass\\spec']);
    const afterCat = spawnSync('cat', ['build\\sass\\spec\\README.md']);
    console.log(
      '========================AFTER===================================',
      after.error,
      after.stdout?.toString() ?? '',
      after.stderr?.toString() ?? '',
      '================================================================',
      afterCat.stdout?.toString ?? '',
      '================================================================'
    );
  }

  await utils.link('build/sass/js-api-doc', p.join(outPath, 'sass'));

  buildEmbeddedProtocol();
}

// Builds the embedded proto into a TS file.
function buildEmbeddedProtocol(): void {
  const version = shell.exec('npx buf --version', {silent: true}).stdout.trim();
  console.log(`Building TS with buf ${version}.`);
  shell.exec('npx buf generate');
}
