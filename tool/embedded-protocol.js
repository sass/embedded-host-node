// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

const createWriteStream = require('fs').createWriteStream;
const execSync = require('child_process').execSync;
const https = require('https');

const PROTO_NAME = 'embedded_sass.proto';

/**
 * Downloads the latest version of the Embedded Protocol into the given
 * directory.
 */
function downloadProto(dir, callback) {
  console.log('Downloading Embedded Sass Protocol');
  https
    .get(
      `https://raw.githubusercontent.com/sass/embedded-protocol/master/${PROTO_NAME}`
    )
    .on('response', response => {
      const proto = createWriteStream(`${dir}/${PROTO_NAME}`);
      response.pipe(proto);
      proto.on('finish', () => {
        if (callback) callback();
      });
    })
    .on('error', error => {
      throw Error(
        `Could not download Embedded Sass Protocol.\n${error.message}`
      );
    });
}

/**
 * Writes the embedded proto in the given directory to pbjs.
 */
function writePbjs(dir) {
  console.log('Writing Embedded Protocol to pbjs');
  execSync(
    `npx protoc --js_out="import_style=commonjs,binary:." ${dir}/${PROTO_NAME}`,
    {
      windowsHide: true,
    }
  );
}

/**
 * Writes the embedded proto in the given directory to pbjs, along with a TS
 * declaration file.
 */
function writePbjsWithDeclaration(dir) {
  console.log('Copying pbjs to dist');
  execSync(
    `npx protoc \
      --plugin="protoc-gen-ts=node_modules/.bin/protoc-gen-ts" \
      --js_out="import_style=commonjs,binary:." \
      --ts_out="." \
      ${dir}/${PROTO_NAME}`,
    {
      windowsHide: true,
    }
  );
}

module.exports = {
  downloadProto,
  writePbjs,
  writePbjsWithDeclaration,
};
