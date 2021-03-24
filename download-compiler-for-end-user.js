// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

const fs = require('fs');

if (fs.existsSync('.dev')) return;

const getDartSassEmbedded = require('./dist/tool/utils.js').getDartSassEmbedded;

(async () => {
  try {
    await getDartSassEmbedded({
      outPath: './dist/lib/src/vendor',
      release: true,
    });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
