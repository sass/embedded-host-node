// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';
import * as p from 'path';
import * as del from 'del';

import {PromiseOr} from '../lib/src/utils';

/**
 * Runs `test` within a sandbox directory. This directory is made available via
 * the `dir` function, which acts like `p.join()` but includes the sandbox
 * directory at the beginning.
 *
 * Handles all buildup and teardown. Returns a promise that resolves when `test`
 * finishes running.
 */
export async function run(
  test: (dir: (...paths: string[]) => string) => PromiseOr<void>,
  options?: {
    // Directories to put in the SASS_PATH env variable before running test.
    sassPathDirs?: string[];
  },
): Promise<void> {
  const testDir = p.join(
    p.dirname(__filename),
    'sandbox',
    `${Math.random()}`.slice(2),
  );
  fs.mkdirSync(testDir, {recursive: true});
  if (options?.sassPathDirs) {
    process.env.SASS_PATH = options.sassPathDirs.join(
      process.platform === 'win32' ? ';' : ':',
    );
  }
  try {
    await test((...paths) => p.join(testDir, ...paths));
  } finally {
    if (options?.sassPathDirs) process.env.SASS_PATH = undefined;
    // TODO(awjin): Change this to rmSync once we drop support for Node 12.
    del.sync(testDir, {force: true});
  }
}
