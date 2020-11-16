// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {execSync} from 'child_process';
import {promises as fs} from 'fs';
import fetch, {RequestInit, RequestRedirect} from 'node-fetch';
import {extract as extractTar} from 'tar';
import extractZip = require('extract-zip');

/**
 * Gets the latest version of the Embedded Protocol and writes it to pbjs with
 * a TS declaration file. Throws if an error occurs.
 */
export async function getEmbeddedProtocol(outPath: string): Promise<void> {
  await fs.mkdir(outPath, {recursive: true});
  const protoName = 'embedded_sass.proto';
  let proto: string;

  console.log('Downloading Embedded Sass Protocol.');
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/sass/embedded-protocol/master/${protoName}`,
      {
        redirect: 'follow' as RequestRedirect,
      }
    );
    if (!response.ok) throw Error(response.statusText);
    proto = await response.text();
  } catch (error) {
    throw Error(`Failed to download Embedded Sass Protocol: ${error.message}.`);
  }

  console.log('Writing proto to pbjs.');
  try {
    await fs.writeFile(`${outPath}/${protoName}`, proto);
    execSync(
      `protoc \
        --plugin="protoc-gen-ts=${
          getOs() === 'windows'
            ? '%CD%/node_modules/.bin/protoc-gen-ts.cmd'
            : 'node_modules/.bin/protoc-gen-ts'
        }" \
        --js_out="import_style=commonjs,binary:." \
        --ts_out="." \
        ${outPath}/${protoName}`,
      {
        windowsHide: true,
      }
    );
  } catch (error) {
    throw Error(`Failed to write proto to pbjs: ${error.message}.`);
  }
}

/**
 * Gets the latest version of the Dart Sass wrapper for the Embedded Compiler.
 * Throws if an error occurs.
 */
export async function getDartSassEmbedded(outPath: string): Promise<void> {
  await fs.mkdir(outPath, {recursive: true});

  let latestRelease: {
    tag_name: string;
    name: string;
  };

  // TODO(awjin): Once dart-sass-embedded is no longer under pre-release, call
  // the Github API instead of manually piecing together the asset URL. The
  // API exposes only the latest *non*-pre-release versions.
  // https://docs.github.com/en/free-pro-team@latest/rest/reference/repos#get-the-latest-release
  console.log('Getting Dart Sass Embedded release info.');
  try {
    const fetchOptions = {
      redirect: 'follow' as RequestRedirect,
    } as RequestInit;
    if (process.env.TRAVIS === 'true') {
      fetchOptions['headers'] = {
        Authorization:
          'Basic ' +
          Buffer.from(`sassbot:${process.env.GITHUB_AUTH}`).toString('base64'),
      };
    }
    const response = await fetch(
      'https://api.github.com/repos/sass/dart-sass-embedded/releases',
      fetchOptions
    );
    if (!response.ok) throw Error(response.statusText);
    latestRelease = JSON.parse(await response.text())[0];
  } catch (error) {
    throw Error(
      `Failed to get Dart Sass Embedded release info: ${error.message}.`
    );
  }

  let releaseAsset: Buffer;

  console.log('Downloading Dart Sass Embedded.');
  try {
    const assetUrl =
      'https://github.com/sass/dart-sass-embedded/releases/download' +
      `/${latestRelease.tag_name}` +
      `/${latestRelease.name.replace(' ', '-')}` +
      `-${getOs()}-${getArch()}` +
      getArchiveFileExtension();
    const response = await fetch(assetUrl, {
      redirect: 'follow' as RequestRedirect,
    });
    if (!response.ok) throw Error(response.statusText);
    releaseAsset = await response.buffer();
  } catch (error) {
    throw Error(`Failed to download Dart Sass Embedded: ${error.message}.`);
  }

  console.log('Writing Dart Sass Embedded binary.');
  try {
    const archivePath = `${outPath}/dart-sass-embedded${getArchiveFileExtension()}`;
    await fs.writeFile(archivePath, releaseAsset);
    if (getOs() === 'windows') {
      await extractZip(archivePath, {dir: `${process.cwd()}/${outPath}`});
    } else {
      extractTar({
        file: archivePath,
        cwd: outPath,
        sync: true,
      });
    }
    await fs.unlink(archivePath);
  } catch (error) {
    throw Error(`Failed to write Dart Sass Embedded binary: ${error.message}.`);
  }
}

// Gets the current platform's operating system. Throws if the operating system
// is not supported by Dart Sass Embedded.
function getOs(): string {
  switch (process.platform) {
    case 'linux':
      return 'linux';
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    default:
      throw Error(`Platform ${process.platform} is not supported.`);
  }
}

// Gets the current platform's architecture. Throws if the architecture is not
// supported by Dart Sass Embedded.
function getArch(): string {
  switch (process.arch) {
    case 'ia32':
      return 'ia32';
    case 'x86':
      return 'ia32';
    case 'x64':
      return 'x64';
    default:
      throw Error(`Architecure ${process.arch} is not supported.`);
  }
}

function getArchiveFileExtension(): string {
  return getOs() === 'windows' ? '.zip' : '.tar.gz';
}
