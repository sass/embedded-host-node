// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {execSync} from 'child_process';
import {promises} from 'fs';
import fetch from 'node-fetch';

/**
 * Get the latest version of the Embedded Protocol and write it to pbjs with
 * a TS declaration file.
 */
export async function getEmbeddedProtocol() {
  const outPath = 'lib/src/vendor';
  const protoName = 'embedded_sass.proto';
  let proto: string;

  await promises.mkdir(outPath, {recursive: true});

  console.log('Downloading Embedded Sass Protocol');
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/sass/embedded-protocol/master/${protoName}`
    );
    if (!response.ok) throw Error(response.statusText);
    proto = await response.text();
  } catch (error) {
    console.error(
      `Could not download Embedded Sass Protocol.\n${error.message}`
    );
    return;
  }

  console.log('Writing proto to pbjs');
  try {
    await promises.writeFile(`${outPath}/${protoName}`, proto);
    execSync(
      `npx protoc \
          --plugin="protoc-gen-ts=node_modules/.bin/protoc-gen-ts" \
          --js_out="import_style=commonjs,binary:." \
          --ts_out="." \
          ${outPath}/${protoName}`,
      {
        windowsHide: true,
      }
    );
  } catch (error) {
    console.error(`Could not write proto to pbjs.\n${error.message}`);
    return;
  }
}
