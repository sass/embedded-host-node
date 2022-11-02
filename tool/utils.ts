// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import extractZip = require('extract-zip');
import {promises as fs, existsSync, mkdirSync} from 'fs';
import fetch from 'node-fetch';
import * as p from 'path';
import * as yaml from 'yaml';
import * as shell from 'shelljs';
import {extract as extractTar} from 'tar';

import * as pkg from '../package.json';

shell.config.fatal = true;

// Directory that holds source files.
const BUILD_PATH = 'build';

export type DartPlatform = 'linux' | 'macos' | 'windows';
export type DartArch = 'ia32' | 'x64' | 'arm' | 'arm64';

// Converts a Node-style platform name as returned by `process.platform` into a
// name used by Dart Sass. Throws if the operating system is not supported by
// Dart Sass Embedded.
export function nodePlatformToDartPlatform(platform: string): DartPlatform {
  switch (platform) {
    case 'linux':
      return 'linux';
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    default:
      throw Error(`Platform ${platform} is not supported.`);
  }
}

// Converts a Node-style architecture name as returned by `process.arch` into a
// name used by Dart Sass. Throws if the architecture is not supported by Dart
// Sass Embedded.
export function nodeArchToDartArch(arch: string): DartArch {
  switch (arch) {
    case 'ia32':
      return 'ia32';
    case 'x86':
      return 'ia32';
    case 'x64':
      return 'x64';
    case 'arm':
      return 'arm';
    case 'arm64':
      return 'arm64';
    default:
      throw Error(`Architecture ${arch} is not supported.`);
  }
}

// Get the platform's file extension for archives.
function getArchiveExtension(platform: DartPlatform): '.zip' | '.tar.gz' {
  return platform === 'windows' ? '.zip' : '.tar.gz';
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
      assetUrl: `https://github.com/sass/${repo}/archive/${version}.tar.gz`,
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
  platform: DartPlatform,
  arch: DartArch,
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

  await checkForMusl();

  if ('version' in options) {
    const version = options?.version;
    await downloadRelease({
      repo,
      assetUrl:
        `https://github.com/sass/${repo}/releases/download/` +
        `${version}/sass_embedded-${version}-` +
        `${platform}-${arch}${getArchiveExtension(platform)}`,
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
    await maybeOverrideSassDependency(repo);
  }

  const source = 'path' in options ? options.path : p.join(BUILD_PATH, repo);
  buildDartSassEmbedded(source);
  await link(p.join(source, 'build'), p.join(outPath, repo));
}

/**
 * Overrides the dart-sass dependency to latest git commit on main when the
 * pubspec file declares it as a "-dev" dependency.
 */
async function maybeOverrideSassDependency(repo: string): Promise<void> {
  const pubspecPath = p.join(BUILD_PATH, repo, 'pubspec.yaml');
  const pubspecRaw = await fs.readFile(pubspecPath, {encoding: 'utf-8'});
  const pubspec = yaml.parse(pubspecRaw);
  const sassVersion = pubspec?.dependencies?.sass;

  if (typeof sassVersion !== 'string') return;
  if (!sassVersion.endsWith('-dev')) return;

  console.log(
    `${repo} depends on sass: ${sassVersion}, overriding with latest commit.`
  );

  pubspec['dependency_overrides'] = {
    ...pubspec['dependency_overrides'],
    sass: {git: 'https://github.com/sass/dart-sass.git'},
  };
  await fs.writeFile(pubspecPath, yaml.stringify(pubspec), {encoding: 'utf-8'});
}

/**
 * Throws an informative error if we're running in a Linux environment that uses
 * musl.
 */
async function checkForMusl(): Promise<void> {
  if (process.platform !== 'linux') return;

  const executable = await fs.readFile(process.execPath);
  if (!executable.includes('libc.musl-')) return;

  throw Error(
    "sass-embedded doesn't support Linux distributions that use musl-libc."
  );
}

/**
 * Checks out JS API type definitions from the Sass language repo.
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

  const archiveExtension = options.assetUrl.endsWith('.zip')
    ? '.zip'
    : '.tar.gz';
  const zippedAssetPath =
    options.outPath + '/' + options.repo + archiveExtension;
  await fs.writeFile(zippedAssetPath, releaseAsset);
  if (archiveExtension === '.zip') {
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
    process.platform === 'win32'
      ? '%CD%/node_modules/protoc/protoc/bin/protoc.exe'
      : 'node_modules/protoc/protoc/bin/protoc';
  const pluginPath =
    process.platform === 'win32'
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
  if (process.platform === 'win32') {
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
