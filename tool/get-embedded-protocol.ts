// Copyright 2022 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {mkdirSync} from 'fs';
import * as p from 'path';
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
  const repo = 'embedded-protocol';

  let source: string;
  if (!options || 'ref' in options) {
    let ref = options?.ref;
    if (ref === undefined) {
      const version = pkg['protocol-version'] as string;
      ref = version.endsWith('-dev') ? 'main' : version;
    }

    utils.fetchRepo({repo, outPath: utils.BUILD_PATH, ref});
    source = p.join(utils.BUILD_PATH, repo);
  } else {
    source = options.path;
  }

  buildEmbeddedProtocol(source);
  await utils.link('build/embedded-protocol', p.join(outPath, repo));
}

// Builds the embedded proto at `repoPath` into a pbjs with TS declaration file.
function buildEmbeddedProtocol(repoPath: string): void {
  const proto = p.join(repoPath, 'embedded_sass.proto');
  const protocPath =
    process.platform === 'win32'
      ? '%CD%/node_modules/protoc/protoc/bin/protoc.exe'
      : 'node_modules/protoc/protoc/bin/protoc';
  const version = shell
    .exec(`${protocPath} --version`, {silent: true})
    .stdout.trim();
  console.log(
    `Building pbjs and TS declaration file from ${proto} with ${version}.`
  );

  const pluginPath =
    process.platform === 'win32'
      ? '%CD%/node_modules/.bin/protoc-gen-ts.cmd'
      : 'node_modules/.bin/protoc-gen-ts';
  mkdirSync('build/embedded-protocol', {recursive: true});
  shell.exec(
    `${protocPath} \
      --plugin="protoc-gen-ts=${pluginPath}" \
      --js_out="import_style=commonjs,binary:build/embedded-protocol" \
      --ts_out="build/embedded-protocol" \
      --proto_path="${repoPath}" \
      ${proto}`,
    {silent: true}
  );
}
