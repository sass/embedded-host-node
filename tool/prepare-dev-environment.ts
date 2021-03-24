// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import yargs from 'yargs';

import {getDartSassEmbedded, getEmbeddedProtocol} from './utils';

const argv = yargs(process.argv.slice(2))
  .option('compiler-path', {
    type: 'string',
    description:
      'Build the Embedded Dart Sass binary from the source at this path.',
  })
  .option('compiler-version', {
    type: 'string',
    description: 'Build the Embedded Dart Sass binary from this Git ref.',
  })
  .option('protocol-path', {
    type: 'string',
    description: 'Build the Embedded Protocol from the source at this path.',
  })
  .option('protocol-version', {
    type: 'string',
    description: 'Build the Embedded Protocol from this Git ref.',
  }).argv;

(async () => {
  try {
    const outPath = 'lib/src/vendor';
    await getEmbeddedProtocol({
      outPath,
      version: argv['protocol-version'],
      path: argv['protocol-path'],
    });
    await getDartSassEmbedded({
      outPath,
      version: argv['compiler-version'],
      path: argv['compiler-path'],
    });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
