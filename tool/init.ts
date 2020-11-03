// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {getDartSassEmbedded, getEmbeddedProtocol} from './embedded-binaries';

async function main() {
  const outPath = 'lib/src/vendor';

  try {
    await getEmbeddedProtocol(outPath);
    await getDartSassEmbedded(outPath);
  } catch (error) {
    console.error(error);
  }
}

main();
