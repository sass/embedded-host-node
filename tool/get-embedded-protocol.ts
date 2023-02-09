// Copyright 2022 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from 'path';
import {pathEqual} from 'path-equal'
import * as shell from 'shelljs';

import * as pkg from '../package.json';
import * as utils from './utils';

/**
 * Downloads and builds the Embedded Sass protocol definition.
 *
 * Can check out and build the source from a Git `ref` or build from the source
 * at `path`. By default, checks out the tagged version specified in
 * package.json's `protocol-version` field. If this version ends in `-dev`,
 * checks out the latest revision from GitHub instead.
 */
export async function getEmbeddedProtocol(
  outPath: string,
  options?: {ref: string} | {path: string}
): Promise<void> {
  if (!options || 'ref' in options) {
    let ref = options?.ref;
    if (ref === undefined) {
      const version = pkg['protocol-version'] as string;
      ref = version.endsWith('-dev') ? 'main' : version;
    }

    utils.fetchRepo({repo: 'embedded-protocol', outPath: 'build', ref});
  } else if (!pathEqual(options.path, 'build/embedded-protocol')) {
    await utils.cleanDir('build/embedded-protocol');
    await utils.link(options.path, 'build/embedded-protocol');
  }

  buildEmbeddedProtocol();
}

// Builds the embedded proto into a TS file.
function buildEmbeddedProtocol(): void {
  const version = shell.exec('npx buf --version', {silent: true}).stdout.trim();
  console.log(`Building TS with buf ${version}.`);
  shell.exec('npx buf generate');
}
