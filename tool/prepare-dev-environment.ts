// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import yargs from 'yargs';

import {
  getArch,
  getDartSassEmbedded,
  getEmbeddedProtocol,
  getJSApi,
  getOS,
} from './utils';

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
  .conflicts({
    'compiler-path': ['compiler-ref', 'compiler-version', 'skip-compiler'],
    'compiler-ref': ['compiler-version', 'skip-compiler'],
    'compiler-version': 'skip-compiler',
    'protocol-path': ['protocol-ref', 'protocol-version'],
    'protocol-ref': 'protocol-version',
    'api-path': 'api-ref',
  })
  .parseSync();

(async () => {
  try {
    const outPath = 'lib/src/vendor';
    const os = getOS(process.env.npm_config_platform || process.platform);
    const arch = getArch(process.env.npm_config_arch || process.arch);

    if (argv['protocol-version']) {
      await getEmbeddedProtocol(outPath, os, {
        version: argv['protocol-version'],
      });
    } else if (argv['protocol-ref']) {
      await getEmbeddedProtocol(outPath, os, {
        ref: argv['protocol-ref'],
      });
    } else if (argv['protocol-path']) {
      await getEmbeddedProtocol(outPath, os, {
        path: argv['protocol-path'],
      });
    } else {
      await getEmbeddedProtocol(outPath, os);
    }

    if (!argv['skip-compiler']) {
      if (argv['compiler-version']) {
        await getDartSassEmbedded(outPath, os, arch, {
          version: argv['compiler-version'],
        });
      } else if (argv['compiler-ref']) {
        await getDartSassEmbedded(outPath, os, arch, {
          ref: argv['compiler-ref'],
        });
      } else if (argv['compiler-path']) {
        await getDartSassEmbedded(outPath, os, arch, {
          path: argv['compiler-path'],
        });
      } else {
        await getDartSassEmbedded(outPath, os, arch);
      }
    }

    if (argv['api-ref']) {
      await getJSApi(outPath, os, {
        ref: argv['api-ref'],
      });
    } else if (argv['api-path']) {
      await getJSApi(outPath, os, {
        path: argv['api-path'],
      });
    } else {
      await getJSApi(outPath, os);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
