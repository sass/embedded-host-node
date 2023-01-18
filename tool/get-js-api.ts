// Copyright 2022 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from 'path';

import * as utils from './utils';

/**
 * Checks out JS API type definitions from the Sass language repo.
 *
 * Can check out a Git `ref` or link to the source at `path`. By default, checks
 * out the latest revision from GitHub.
 */
export async function getJSApi(
  outPath: string,
  options?: {ref: string} | {path: string}
): Promise<void> {
  const repo = 'sass';

  let source: string;
  if (!options || 'ref' in options) {
    utils.fetchRepo({
      repo,
      outPath: utils.BUILD_PATH,
      ref: options?.ref ?? 'main',
    });
    source = p.join(utils.BUILD_PATH, repo);
  } else {
    source = options.path;
  }

  await utils.link(p.join(source, 'js-api-doc'), p.join(outPath, repo));
}
