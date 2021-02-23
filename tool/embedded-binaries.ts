// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from 'path';
import {satisfies} from 'semver';
import {promises as fs, existsSync} from 'fs';
import fetch, {RequestInit} from 'node-fetch';
import {extract as extractTar} from 'tar';
import extractZip = require('extract-zip');
import * as shell from 'shelljs';

shell.config.fatal = true;

// The current platform's operating system. Throws if the operating system
// is not supported by Dart Sass Embedded.
let OS: 'linux' | 'macos' | 'windows';
switch (process.platform) {
  case 'linux':
    OS = 'linux';
    break;
  case 'darwin':
    OS = 'macos';
    break;
  case 'win32':
    OS = 'windows';
    break;
  default:
    throw Error(`Platform ${process.platform} is not supported.`);
}

// The current platform's architecture. Throws if the architecture is not
// supported by Dart Sass Embedded.
let ARCH: 'ia32' | 'x64';
switch (process.arch) {
  case 'ia32':
    ARCH = 'ia32';
    break;
  case 'x86':
    ARCH = 'ia32';
    break;
  case 'x64':
    ARCH = 'x64';
    break;
  default:
    throw Error(`Architecure ${process.arch} is not supported.`);
}

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
 * Gets the latest version of the Embedded Protocol. Throws if an error occurs.
 *
 * @param release - Whether to download a release version of the Embedded
 *   Protocol or build one from source.
 * @param version - If `release` is `true`, the version of the Embedded Protocol
 *   to download. If it's `false`, the Git ref to check out. Defaults to
 *   the latest available version or `master`, respectively.
 */
export async function getEmbeddedProtocol(
  outPath: string,
  options: {
    release?: boolean;
    version?: string;
  }
): Promise<void> {
  const repo = 'embedded-protocol';
  if (options.release) {
    const version = await downloadRelease({
      repo,
      outPath,
      version: options.version,
      assetUrl: releaseInfo =>
        `https://github.com/sass/${repo}/archive/` +
        `${releaseInfo.name.replace(' ', '-')}` +
        ARCHIVE_EXTENSION,
      tags: true,
    });
    fs.rename(p.join(outPath, `${repo}-${version}`), p.join(outPath, repo));
    buildEmbeddedProtocol(p.join(outPath, repo, 'embedded_sass.proto'));
  } else {
    fetchRepo(repo, BUILD_PATH, options.version);
    // TODO(awjin): Allow building and linking from custom path for local dev.
    buildEmbeddedProtocol(p.join(BUILD_PATH, repo, 'embedded_sass.proto'));
    await linkBuiltFiles(repo, p.join(BUILD_PATH, repo), outPath);
  }
}

/**
 * Gets the latest version of the Dart Sass wrapper for the Embedded Compiler.
 * Throws if an error occurs.
 *
 * @param release - Whether to download a release version of the Embedded
 *   Compiler or build one from source.
 * @param version - If `release` is `true`, the version of the Embedded Compiler
 *   to download. If it's `false`, the Git ref to check out. Defaults to
 *   the latest available version or `master`, respectively.
 */
export async function getDartSassEmbedded(
  outPath: string,
  options: {
    release?: boolean;
    version?: string;
  }
): Promise<void> {
  const repo = 'dart-sass-embedded';
  if (options.release) {
    await downloadRelease({
      repo,
      version: options.version,
      assetUrl: releaseInfo =>
        `https://github.com/sass/${repo}/releases/download/` +
        `${releaseInfo.tag_name}/` +
        `${releaseInfo.name.replace(' ', '-')}-` +
        `${OS}-${ARCH}` +
        ARCHIVE_EXTENSION,
      outPath,
    });
    fs.rename(p.join(outPath, 'sass_embedded'), p.join(outPath, repo));
  } else {
    fetchRepo(repo, BUILD_PATH, options.version);
    // TODO(awjin): Allow building and linking from custom path for local dev.
    buildDartSassEmbedded(p.join(BUILD_PATH, repo));
    await linkBuiltFiles(repo, p.join(BUILD_PATH, repo, 'build'), outPath);
  }
}

// Downloads a release asset and returns the version that was downloaded.
async function downloadRelease(options: {
  // The Sass repo whose release we should download.
  repo: string;
  // The directory to download the release into.
  outPath: string;
  // Semver constraint for the release. This will always download the latest
  // available version of the release, but will error if the latest version is
  // not compatible with this version.
  version?: string;
  // Given the ReleaseInfo of the latest release, this callback should return
  // the URL at which to download the asset.
  assetUrl: (release: ReleaseInfo) => string;
  // Whether to download the tag archive instead of a release asset.
  tags?: boolean;
}): Promise<string> {
  const fetchOptions: RequestInit = {
    redirect: 'follow',
  };

  console.log(`Getting version info for ${options.repo}.`);
  let latestRelease: ReleaseInfo;
  try {
    const response = await fetch(
      'https://api.github.com/repos/sass/' +
        `${options.repo}/${options.tags ? 'tags' : 'releases'}`,
      fetchOptions
    );
    if (!response.ok) throw Error(response.statusText);

    latestRelease = JSON.parse(await response.text())[0];
    if (options.version) {
      if (!satisfies(latestRelease.name, options.version)) {
        throw Error(
          `Latest release is not compatible with ${options.version}.`
        );
      }
    }
  } catch (error) {
    throw Error(
      `Failed to get version info for ${options.repo}: ${error.message}.`
    );
  }

  console.log(`Downloading ${options.repo} release asset.`);
  let releaseAsset;
  try {
    const response = await fetch(options.assetUrl(latestRelease), fetchOptions);
    if (!response.ok) throw Error(response.statusText);
    releaseAsset = await response.buffer();
  } catch (error) {
    throw Error(
      `Failed to download ${options.repo} release asset: ${error.message}.`
    );
  }

  console.log(`Unzipping ${options.repo} release asset to ${options.outPath}.`);
  try {
    await cleanDir(p.join(options.outPath, options.repo));
    const zippedAssetPath = `${options.outPath}/${options.repo}${ARCHIVE_EXTENSION}`;
    await fs.writeFile(zippedAssetPath, releaseAsset);
    if (OS === 'windows') {
      await extractZip(zippedAssetPath, {
        dir: process.cwd(),
      });
    } else {
      extractTar({
        file: zippedAssetPath,
        cwd: options.outPath,
        sync: true,
      });
    }
    await fs.unlink(zippedAssetPath);
  } catch (error) {
    throw Error(
      `Failed to unzip ${options.repo} release asset: ${error.message}.`
    );
  }

  return latestRelease.name.replace(' ', '-');
}

// Clones `repo` into `outPath`, then checks out the given Git `ref`.
function fetchRepo(repo: string, outPath: string, ref?: string) {
  if (!existsSync(p.join(outPath, repo))) {
    console.log(`Cloning ${repo} into ${outPath}.`);
    shell.exec(
      `git clone \
      --depth=1 \
      git://github.com/sass/${repo} \
      ${p.join(outPath, repo)}`,
      {silent: true}
    );
  }

  const version = ref ? `commit ${ref}` : 'latest update';
  console.log(`Fetching ${version} for ${repo}.`);
  shell.exec(`git fetch --depth=1 origin ${ref ?? 'master'}`, {
    silent: true,
    cwd: p.join(outPath, repo),
  });
  shell.exec('git reset --hard FETCH_HEAD', {
    silent: true,
    cwd: p.join(outPath, repo),
  });
}

// Links the built files at `builtPath` into `outPath`/`repo`.
async function linkBuiltFiles(
  repo: string,
  builtPath: string,
  outPath: string
) {
  console.log(`Linking built ${repo} into ${outPath}.`);
  await cleanDir(p.join(outPath, repo));
  if (OS === 'windows') {
    shell.cp('-R', builtPath, p.join(outPath, repo));
  } else {
    // Symlinking doesn't play nice with Jasmine's test globbing on Windows.
    fs.symlink(p.resolve(builtPath), p.join(outPath, repo));
  }
}

// Builds the embedded proto at `protoPath` into a pbjs with TS declaration
// file.
function buildEmbeddedProtocol(protoPath: string) {
  console.log(`Building pbjs and TS declaration file from ${protoPath}.`);
  try {
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
      ${protoPath}`,
      {silent: true}
    );
  } catch (error) {
    throw Error(`Failed to write proto to pbjs: ${error.message}.`);
  }
}

// Builds the Embedded Dart Sass executable from the source at `repoPath`.
function buildDartSassEmbedded(repoPath: string) {
  console.log('Downloading dart-sass-embedded dependencies.');
  shell.exec('pub upgrade', {
    cwd: repoPath,
    silent: true,
  });

  console.log('Building dart-sass-embedded executable.');
  shell.exec('pub run grinder protobuf pkg-standalone-dev', {
    cwd: repoPath,
    silent: true,
  });
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
