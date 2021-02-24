// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import yargs from 'yargs';

import {getDartSassEmbedded, getEmbeddedProtocol} from './embedded-binaries';

const argv = yargs(process.argv.slice(2)).option('release', {
  type: 'boolean',
  description: 'Download a released version of Embedded Dart Sass',
}).argv;

async function main() {
  const outPath = 'lib/src/vendor';
  await getEmbeddedProtocol(outPath, {release: argv.release});
  await getDartSassEmbedded(outPath, {release: argv.release});
}

main();
