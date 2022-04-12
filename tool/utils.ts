// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

const fetch = require('make-fetch-happen').defaults();
import extractZip = require('extract-zip');
import {promises as fs, existsSync, mkdirSync} from 'fs';
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
const ARCH: 'ia32' | 'x64' | 'arm64' = (() => {
  switch (process.arch) {
    case 'ia32':
      return 'ia32';
    case 'x86':
      return 'ia32';
    case 'x64':
      return 'x64';
    case 'arm64':
      return 'arm64';
    default:
      throw Error(`Architecure ${process.arch} is not supported.`);
  }
})();

// The current platform's file extension for archives.
const ARCHIVE_EXTENSION = OS === 'windows' ? '.zip' : '.tar.gz';

// Directory that holds source files.
const BUILD_PATH = 'build';

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
        ref: string;
      }
    | {
        path: string;
      }
): Promise<void> {
  const repo = 'embedded-protocol';

  options ??= defaultVersionOption('protocol-version');
  if ('version' in options) {
    const version = options?.version;
    await downloadRelease({
      repo,
      assetUrl: `https://github.com/sass/${repo}/archive/${version}${ARCHIVE_EXTENSION}`,
      outPath: BUILD_PATH,
    });
    await fs.rename(
      p.join(BUILD_PATH, `${repo}-${version}`),
      p.join(BUILD_PATH, repo)
    );
  } else if ('ref' in options) {
    fetchRepo({
      repo,
      outPath: BUILD_PATH,
      ref: options.ref,
    });
  }

  const source =
    options && 'path' in options ? options.path : p.join(BUILD_PATH, repo);
  buildEmbeddedProtocol(source);
  await link('build/embedded-protocol', p.join(outPath, repo));
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
        ref: string;
      }
    | {
        path: string;
      }
): Promise<void> {
  const repo = 'dart-sass-embedded';

  options ??= defaultVersionOption('compiler-version');
  if ('version' in options) {
    const version = options?.version;
    await downloadRelease({
      repo,
      assetUrl:
        `https://github.com/sass/${repo}/releases/download/` +
        `${version}/sass_embedded-${version}-` +
        `${OS}-${ARCH}${ARCHIVE_EXTENSION}`,
      outPath,
    });
    await fs.rename(p.join(outPath, 'sass_embedded'), p.join(outPath, repo));
    return;
  }

  if ('ref' in options) {
    fetchRepo({
      repo,
      outPath: BUILD_PATH,
      ref: options.ref,
    });
  }

  const source = 'path' in options ? options.path : p.join(BUILD_PATH, repo);
  buildDartSassEmbedded(source);
  await link(p.join(source, 'build'), p.join(outPath, repo));
}

/**
 * Checks out JS API type defintions from the Sass language repo.
 *
 * Can check out a Git `ref`, or link to the source at `path`. By default,
 * checks out the latest revision from GitHub.
 */
export async function getJSApi(
  outPath: string,
  options?: {ref: string} | {path: string}
): Promise<void> {
  const repo = 'sass';

  let source: string;
  if (!options || 'ref' in options) {
    fetchRepo({
      repo,
      outPath: BUILD_PATH,
      ref: options?.ref ?? 'main',
    });
    source = p.join(BUILD_PATH, repo);
  } else {
    source = options.path;
  }

  await link(p.join(source, 'js-api-doc'), p.join(outPath, repo));
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
      https://github.com/sass/${options.repo} \
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
  mkdirSync('build/embedded-protocol', {recursive: true});
  shell.exec(
    `${protocPath} \
      --plugin="protoc-gen-ts=${pluginPath}" \
      --js_out="import_style=commonjs,binary:build/embedded-protocol" \
      --ts_out="build/embedded-protocol" \
      --proto_path="${repoPath}" \
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

// Given the name of a field in `package.json`, returns the default version
// option described by that field.
function defaultVersionOption(
  pkgField: keyof typeof pkg
): {version: string} | {ref: string} {
  const version = pkg[pkgField] as string;
  return version.endsWith('-dev') ? {ref: 'main'} : {version};
}

// Links or copies the contents of `source` into `destination`.
async function link(source: string, destination: string): Promise<void> {
  await cleanDir(destination);
  if (OS === 'windows') {
    console.log(`Copying ${source} into ${destination}.`);
    shell.cp('-R', source, destination);
  } else {
    console.log(`Linking ${source} into ${destination}.`);
    // Symlinking doesn't play nice with Jasmine's test globbing on Windows.
    await fs.symlink(p.resolve(source), destination);
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
