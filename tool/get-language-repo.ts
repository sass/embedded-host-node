// Copyright 2022 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from 'path';
import * as shell from 'shelljs';

import * as utils from './utils';

/**
 * Downloads the Sass language repo and buids the Embedded Sass protocol
 * definition.
 *
 * Can check out and build the source from a Git `ref` or build from the source
 * at `path`. By default, checks out the latest revision from GitHub.
 */
export async function getLanguageRepo(
  outPath: string,
  options?: {ref: string} | {path: string},
): Promise<void> {
  if (!options || 'ref' in options) {
    utils.fetchRepo({
      repo: 'sass',
      outPath: utils.BUILD_PATH,
      ref: options?.ref ?? 'main',
    });
  } else {
    await utils.cleanDir('build/sass');
    await utils.link(options.path, 'build/sass');
  }

  // Workaround for https://github.com/shelljs/shelljs/issues/198
  // This file is a symlink which gets messed up by `shell.cp` (called from
  // `utils.link`) on Windows.
  if (process.platform === 'win32') shell.rm('build/sass/spec/README.md');

  await utils.link('build/sass/js-api-doc', p.join(outPath, 'sass'));

  buildEmbeddedProtocol();
}

// Builds the embedded proto into a TS file.
function buildEmbeddedProtocol(): void {
  const version = shell.exec('npx buf --version', {silent: true}).stdout.trim();
  console.log(`Building TS with buf ${version}.`);
  shell.exec('npx buf generate');
}
