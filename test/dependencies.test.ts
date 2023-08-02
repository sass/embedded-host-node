// Copyright 2022 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';
import * as p from 'path';

import * as pkg from '../package.json';

// These tests assert that our declared dependency on the embedded protocol is
// either a -dev version or the same version we're testing against.

it('declares a compatible dependency on the embedded protocol', () => {
  if (pkg['protocol-version'].endsWith('-dev')) return;

  expect(
    fs
      .readFileSync(
        p.join(__dirname, '../build/sass/spec/EMBEDDED_PROTOCOL_VERSION'),
        'utf-8'
      )
      .trim()
  ).toBe(pkg['protocol-version']);
});
