// Copyright 2022 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as p from 'path';

import * as pkg from '../package.json';

// These tests assert that our declared dependencies on the embedded protocol
// and compiler are either -dev versions (which download the latest main
// branches of each repo and block release) or the same versions as the versions
// we're testing against.

it('declares a compatible dependency on the embedded protocol', () => {
  if (pkg['protocol-version'].endsWith('-dev')) return;

  expect(
    fs
      .readFileSync(
        p.join(__dirname, '../build/embedded-protocol/VERSION'),
        'utf-8'
      )
      .trim()
  ).toBe(pkg['protocol-version']);
});

it('declares a compatible dependency on the embedded compiler', () => {
  if (pkg['compiler-version'].endsWith('-dev')) return;

  const version = JSON.parse(
    child_process.execSync(
      p.join(__dirname, '../lib/src/vendor/dart-sass/sass') +
        ' --embedded --version',
      {encoding: 'utf-8'}
    )
  );
  expect(version.compilerVersion).toBe(pkg['compiler-version']);
});
