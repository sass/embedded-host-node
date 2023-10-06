// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import yargs from 'yargs';

import {getEmbeddedCompiler} from './get-embedded-compiler';
import {getLanguageRepo} from './get-language-repo';

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
  .option('language-path', {
    type: 'string',
    description: 'Use the Sass language repo from the source at this path.',
  })
  .option('language-ref', {
    type: 'string',
    description: 'Use the Sass language repo from this Git ref.',
  })
  .conflicts({
    'compiler-path': ['compiler-ref', 'skip-compiler'],
    'compiler-ref': ['skip-compiler'],
    'language-path': ['language-ref'],
  })
  .parseSync();

void (async () => {
  try {
    const outPath = 'lib/src/vendor';

    if (argv['language-ref']) {
      await getLanguageRepo(outPath, {
        ref: argv['language-ref'],
      });
    } else if (argv['language-path']) {
      await getLanguageRepo(outPath, {
        path: argv['language-path'],
      });
    } else {
      await getLanguageRepo(outPath);
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
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
