// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import yargs from 'yargs';

import {getEmbeddedCompiler} from './get-embedded-compiler';
import {getEmbeddedProtocol} from './get-embedded-protocol';
import {getJSApi} from './get-js-api';

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
  .option('skip-compiler', {
    type: 'boolean',
    description: "Don't Embedded Dart Sass at all.",
  })
  .option('protocol-path', {
    type: 'string',
    description: 'Build the Embedded Protocol from the source at this path.',
  })
  .option('protocol-ref', {
    type: 'string',
    description: 'Build the Embedded Protocol from this Git ref.',
  })
  .option('api-path', {
    type: 'string',
    description: 'Use the JS API definitions from the source at this path.',
  })
  .option('api-ref', {
    type: 'string',
    description: 'Build the JS API definitions from this Git ref.',
  })
  .conflicts({
    'compiler-path': ['compiler-ref', 'skip-compiler'],
    'compiler-ref': ['skip-compiler'],
    'protocol-path': ['protocol-ref'],
    'api-path': 'api-ref',
  })
  .parseSync();

(async () => {
  try {
    const outPath = 'lib/src/vendor';

    if (argv['protocol-ref']) {
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

    if (!argv['skip-compiler']) {
      if (argv['compiler-ref']) {
        await getEmbeddedCompiler(outPath, {
          ref: argv['compiler-ref'],
        });
      } else if (argv['compiler-path']) {
        await getEmbeddedCompiler(outPath, {
          path: argv['compiler-path'],
        });
      } else {
        await getEmbeddedCompiler(outPath);
      }
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
