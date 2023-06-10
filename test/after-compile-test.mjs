// Copyright 2023 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';

// Note: this file isn't .test.ts specifically because we _don't_ want Jest to
// handle it, because Jest chokes on dynamic imports of literal ESM modules.

// This file should only be run _after_ `npm run compile`.
if (!fs.existsSync('dist/package.json')) {
  throw new Error('after-compile.test.ts must be run after `npm run compile`.');
}

// Load these dynamically so we have a better error mesage if `npm run compile`
// hasn't been run.
const cjs = await import('../dist/lib/index.js');
const esm = await import('../dist/lib/index.mjs');

for (const [name, value] of Object.entries(cjs)) {
  if (name === '__esModule' || name === 'default') continue;
  if (!esm[name]) {
    throw new Error(`ESM module is missing export ${name}.`);
  } else if (esm[name] !== value) {
    throw new Error(`ESM ${name} isn't the same as CJS.`);
  }

  if (!esm.default[name]) {
    throw new Error(`ESM default export is missing export ${name}.`);
  } else if (esm.default[name] !== value) {
    throw new Error(`ESM default export ${name} isn't the same as CJS.`);
  }
}
