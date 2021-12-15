// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import yargs from 'yargs';

import {getDartSassEmbedded, getEmbeddedProtocol, getJSApi} from './utils';

const argv = yargs(process.argv.slice(2))
  .option('compiler-path', {
    type: 'string',
    description:
      'Build the Embedded Dart Sass binary from the source at this path.',
  })
  .option('compiler-ref', {
    type: 'string',
    description: 'Build the Embedded Dart Sass binary from this Git ref.',
  })
  .option('compiler-version', {
    type: 'string',
    description: 'Download this version of the Embedded Dart Sass binary.',
  })
  .option('protocol-path', {
    type: 'string',
    description: 'Build the Embedded Protocol from the source at this path.',
  })
  .option('protocol-ref', {
    type: 'string',
    description: 'Build the Embedded Protocol from this Git ref.',
  })
  .option('protocol-version', {
    type: 'string',
    description: 'Build the Embedded Protocol from this release version.',
  })
  .option('api-path', {
    type: 'string',
    description: 'Use the JS API definitions from the source at this path.',
  })
  .option('api-ref', {
    type: 'string',
    description: 'Build the JS API definitions from this Git ref.',
  })
  .conflicts({'compiler-path': ['compiler-ref', 'compiler-version']})
  .conflicts('compiler-ref', 'compiler-version')
  .conflicts({'protocol-path': ['protocol-ref', 'protocol-version']})
  .conflicts('protocol-ref', 'protocol-version')
  .conflicts('api-path', 'api-ref')
  .parseSync();

(async () => {
  try {
    const outPath = 'lib/src/vendor';

    if (argv['protocol-version']) {
      await getEmbeddedProtocol(outPath, {
        version: argv['protocol-version'],
      });
    } else if (argv['protocol-ref']) {
      await getEmbeddedProtocol(outPath, {
        ref: argv['protocol-ref'],
      });
    } else if (argv['protocol-path']) {
      await getEmbeddedProtocol(outPath, {
        path: argv['protocol-path'],
      });
    } else {
      await getEmbeddedProtocol(outPath);
    }

    if (argv['compiler-version']) {
      await getDartSassEmbedded(outPath, {
        version: argv['compiler-version'],
      });
    } else if (argv['compiler-ref']) {
      await getDartSassEmbedded(outPath, {
        ref: argv['compiler-ref'],
      });
    } else if (argv['compiler-path']) {
      await getDartSassEmbedded(outPath, {
        path: argv['compiler-path'],
      });
    } else {
      await getDartSassEmbedded(outPath);
    }

    if (argv['api-ref']) {
      await getJSApi(outPath, {
        ref: argv['api-ref'],
      });
    } else if (argv['api-path']) {
      await getJSApi(outPath, {
        path: argv['api-path'],
      });
    } else {
      await getJSApi(outPath);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
