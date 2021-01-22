// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {promises as fs} from 'fs';
import {resolve} from 'path';

const root = 'sandbox';

/**
 * Runs `test` within a sandbox directory. Handles all buildup and teardown.
 */
export async function run(
  test: Function,
  options: {
    // Directories to put in the SASS_PATH env variable before running test.
    sassPathDirs?: string[];
  } = {}
): Promise<void> {
  try {
    await fs.rmdir(root, {recursive: true});
  } catch {
    // noop
  } finally {
    await fs.mkdir(root);
    process.chdir(resolve(root));
  }

  try {
    if (options.sassPathDirs) {
      process.env.SASS_PATH = options.sassPathDirs.join(
        process.platform === 'win32' ? ';' : ':'
      );
    }
    await test();
  } finally {
    if (options.sassPathDirs) {
      process.env.SASS_PATH = undefined;
    }

    process.chdir(resolve('..'));
    try {
      await fs.rmdir(root, {recursive: true});
    } catch {
      // noop
    }
  }
}
