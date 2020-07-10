// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

const mkdir = require('fs').mkdir;
const protocol = require('./embedded-protocol');

// Create the vendor directory.
const dir = 'dist/lib/src/vendor';
mkdir(dir, {recursive: true}, error => {
  if (error) {
    throw Error(`Could not create vendor directory.\n${error.message}`);
  }
});

// Download and compile the Embedded Sass Protocol.
protocol.downloadProto(dir, () => protocol.writePbjs(dir));
