// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {getDartSassEmbedded, getEmbeddedProtocol} from './utils';

async function main() {
  const outPath = 'lib/src/vendor';
  await getEmbeddedProtocol({outPath});
  await getDartSassEmbedded({outPath});
}

main();
