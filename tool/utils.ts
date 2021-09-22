// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import extractZip = require('extract-zip');
import {promises as fs, existsSync} from 'fs';
import fetch from 'node-fetch';
import * as p from 'path';
import * as shell from 'shelljs';
import {extract as extractTar} from 'tar';

import * as pkg from '../package.json';

shell.config.fatal = true;

// The current platform's operating system. Throws if the operating system
// is not supported by Dart Sass Embedded.
const OS: 'linux' | 'macos' | 'windows' = (() => {
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
})();

// The current platform's architecture. Throws if the architecture is not
// supported by Dart Sass Embedded.
const ARCH: 'ia32' | 'x64' = (() => {
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
})();

// The current platform's file extension for archives.
const ARCHIVE_EXTENSION = OS === 'windows' ? '.zip' : '.tar.gz';

// Directory that holds source files.
const BUILD_PATH = 'build';

// Release info provided by Github.
// See: https://docs.github.com/en/rest/reference/repos#releases
interface ReleaseInfo {
  tag_name: string;
  name: string;
}

/**
 * Gets the Embedded Protocol.
 *
 * Can download the release `version`, check out and build the source from a Git
 * `ref`, or build from the source at `path`.
 *
 * By default, downloads the release version specified in package.json. Throws
 * if an error occurs.
 */
export async function getEmbeddedProtocol(
  outPath: string,
  options?:
    | {
        version: string;
      }
    | {
        ref: string | 'main';
      }
    | {
        path: string;
      }
): Promise<void> {
  const repo = 'embedded-protocol';

  if (!options || 'version' in options) {
    const version = options?.version ?? pkg['protocol-version'];
    await downloadRelease({
      repo,
      assetUrl: `https://github.com/sass/${repo}/archive/${version}${ARCHIVE_EXTENSION}`,
      outPath: BUILD_PATH,
    });
    fs.rename(
      p.join(BUILD_PATH, `${repo}-${version}`),
      p.join(BUILD_PATH, repo)
    );
  }

  if (options && 'ref' in options) {
    fetchRepo({
      repo,
      outPath: BUILD_PATH,
      ref: options.ref,
    });
  }

  const repoPath =
    options && 'path' in options ? options.path : p.join(BUILD_PATH, repo);

  buildEmbeddedProtocol(repoPath);
  await linkBuiltFiles(repoPath, p.join(outPath, repo));
}

/**
 * Gets the Dart Sass wrapper for the Embedded Compiler.
 *
 * Can download the release `version`, check out and build the source from a Git
 * `ref`, or build from the source at `path`.
 *
 * By default, downloads the release version specified in package.json. Throws
 * if an error occurs.
 */
export async function getDartSassEmbedded(
  outPath: string,
  options?:
    | {
        version: string;
      }
    | {
        ref: string | 'main';
      }
    | {
        path: string;
      }
): Promise<void> {
  const repo = 'dart-sass-embedded';

  if (!options || 'version' in options) {
    const version = options?.version ?? pkg['compiler-version'];
    await downloadRelease({
      repo,
      assetUrl:
        `https://github.com/sass/${repo}/releases/download/` +
        `${version}/sass_embedded-${version}-` +
        `${OS}-${ARCH}${ARCHIVE_EXTENSION}`,
      outPath,
    });
    fs.rename(p.join(outPath, 'sass_embedded'), p.join(outPath, repo));
    return;
  }

  if ('ref' in options) {
    fetchRepo({
      repo,
      outPath: BUILD_PATH,
      ref: options.ref,
    });
  }

  const repoPath = 'path' in options ? options.path : p.join(BUILD_PATH, repo);

  buildDartSassEmbedded(repoPath);
  await linkBuiltFiles(p.join(repoPath, 'build'), p.join(outPath, repo));
}

// Downloads the release for `repo` located at `assetUrl`, then unzips it into
// `outPath`.
async function downloadRelease(options: {
  repo: string;
  assetUrl: string;
  outPath: string;
}): Promise<void> {
  console.log(`Downloading ${options.repo} release asset.`);
  const response = await fetch(options.assetUrl, {
    redirect: 'follow',
  });
  if (!response.ok) {
    throw Error(
      `Failed to download ${options.repo} release asset: ${response.statusText}`
    );
  }
  const releaseAsset = await response.buffer();

  console.log(`Unzipping ${options.repo} release asset to ${options.outPath}.`);
  await cleanDir(p.join(options.outPath, options.repo));
  const zippedAssetPath = `${options.outPath}/${options.repo}${ARCHIVE_EXTENSION}`;
  await fs.writeFile(zippedAssetPath, releaseAsset);
  if (OS === 'windows') {
    await extractZip(zippedAssetPath, {
      dir: p.join(process.cwd(), options.outPath),
    });
  } else {
    extractTar({
      file: zippedAssetPath,
      cwd: options.outPath,
      sync: true,
    });
  }
  await fs.unlink(zippedAssetPath);
}

// Clones `repo` into `outPath`, then checks out the given Git `ref`.
function fetchRepo(options: {
  repo: string;
  outPath: string;
  ref: string;
}): void {
  if (!existsSync(p.join(options.outPath, options.repo))) {
    console.log(`Cloning ${options.repo} into ${options.outPath}.`);
    shell.exec(
      `git clone \
      --depth=1 \
      git://github.com/sass/${options.repo} \
      ${p.join(options.outPath, options.repo)}`,
      {silent: true}
    );
  }

  const version =
    options.ref === 'main' ? 'latest update' : `commit ${options.ref}`;
  console.log(`Fetching ${version} for ${options.repo}.`);
  shell.exec(
    `git fetch --depth=1 origin ${options.ref} && git reset --hard FETCH_HEAD`,
    {
      silent: true,
      cwd: p.join(options.outPath, options.repo),
    }
  );
}

// Builds the embedded proto at `repoPath` into a pbjs with TS declaration file.
function buildEmbeddedProtocol(repoPath: string): void {
  const proto = p.join(repoPath, 'embedded_sass.proto');
  console.log(`Building pbjs and TS declaration file from ${proto}.`);
  const protocPath =
    OS === 'windows'
      ? '%CD%/node_modules/protoc/protoc/bin/protoc.exe'
      : 'node_modules/protoc/protoc/bin/protoc';
  const pluginPath =
    OS === 'windows'
      ? '%CD%/node_modules/.bin/protoc-gen-ts.cmd'
      : 'node_modules/.bin/protoc-gen-ts';
  shell.exec(
    `${protocPath} \
      --plugin="protoc-gen-ts=${pluginPath}" \
      --js_out="import_style=commonjs,binary:." \
      --ts_out="." \
      ${proto}`,
    {silent: true}
  );
}

// Builds the Embedded Dart Sass executable from the source at `repoPath`.
function buildDartSassEmbedded(repoPath: string): void {
  console.log('Downloading dart-sass-embedded dependencies.');
  shell.exec('dart pub upgrade', {
    cwd: repoPath,
    silent: true,
  });

  console.log('Building dart-sass-embedded executable.');
  shell.exec('dart run grinder protobuf pkg-standalone-dev', {
    cwd: repoPath,
    silent: true,
  });
}

// Links the built files at `builtPath` into `outPath`.
async function linkBuiltFiles(
  builtPath: string,
  outPath: string
): Promise<void> {
  console.log(`Linking built files into ${outPath}.`);
  await cleanDir(outPath);
  if (OS === 'windows') {
    shell.cp('-R', builtPath, outPath);
  } else {
    // Symlinking doesn't play nice with Jasmine's test globbing on Windows.
    fs.symlink(p.resolve(builtPath), outPath);
  }
}

// Ensures that `dir` does not exist, but its parent directory does.
async function cleanDir(dir: string): Promise<void> {
  await fs.mkdir(p.dirname(dir), {recursive: true});
  try {
    await fs.rmdir(dir, {recursive: true});
  } catch (_) {
    // If dir doesn't exist yet, that's fine.
  }
}
