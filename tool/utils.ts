// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import extractZip = require('extract-zip');
import {promises as fs, existsSync} from 'fs';
import fetch from 'node-fetch';
import * as p from 'path';
import {satisfies} from 'semver';
import * as shell from 'shelljs';
import {extract as extractTar} from 'tar';

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
 * Gets the latest version of the Embedded Protocol. Throws if an error occurs.
 *
 * @param version - The Git ref to check out and build. Defaults to `main`.
 * @param path - Build from this path instead of pulling from Github.
 * @param release - Download the latest release instead of building from source.
 */
export async function getEmbeddedProtocol(options: {
  outPath: string;
  version?: string;
  path?: string;
  release?: boolean;
}): Promise<void> {
  const repo = 'embedded-protocol';

  if (options.release) {
    const latestRelease = await getLatestReleaseInfo({
      repo,
      tag: true,
    });
    await downloadRelease({
      repo,
      assetUrl:
        `https://github.com/sass/${repo}/archive/` +
        `${latestRelease.name.replace(' ', '-')}` +
        ARCHIVE_EXTENSION,
      outPath: BUILD_PATH,
    });
    fs.rename(
      p.join(BUILD_PATH, `${repo}-${latestRelease.name.replace(' ', '-')}`),
      p.join(BUILD_PATH, repo)
    );
  } else if (!options.path) {
    fetchRepo({
      repo,
      outPath: BUILD_PATH,
      ref: options.version,
    });
  }

  const repoPath = options.path ?? p.join(BUILD_PATH, repo);
  buildEmbeddedProtocol(repoPath);
  await linkBuiltFiles(repoPath, p.join(options.outPath, repo));
}

/**
 * Gets the latest version of the Dart Sass wrapper for the Embedded Compiler.
 * Throws if an error occurs.
 *
 * @param version - If `release` is true, the version of the released binary to
 *   download (defaults to the latest version). If it's false, the Git ref to
 *   check out and build (defaults to main).
 * @param path - Build from this path instead of pulling from Github.
 * @param release - Download the latest release instead of building from source.
 */
export async function getDartSassEmbedded(options: {
  outPath: string;
  version?: string;
  path?: string;
  release?: boolean;
}): Promise<void> {
  const repo = 'dart-sass-embedded';

  if (options.release) {
    const release = options.version
      ? {tag_name: options.version, name: `sass_embedded ${options.version}`}
      : await getLatestReleaseInfo({
          repo,
        });
    await downloadRelease({
      repo,
      assetUrl:
        `https://github.com/sass/${repo}/releases/download/` +
        `${release.tag_name}/` +
        `${release.name.replace(' ', '-')}-` +
        `${OS}-${ARCH}` +
        ARCHIVE_EXTENSION,
      outPath: options.outPath,
    });
    fs.rename(
      p.join(options.outPath, 'sass_embedded'),
      p.join(options.outPath, repo)
    );
  } else if (options.path) {
    buildDartSassEmbedded(options.path);
    await linkBuiltFiles(
      p.join(options.path, 'build'),
      p.join(options.outPath, repo)
    );
  } else {
    fetchRepo({
      repo,
      outPath: BUILD_PATH,
      ref: options.version,
    });
    buildDartSassEmbedded(p.join(BUILD_PATH, repo));
    await linkBuiltFiles(
      p.join(BUILD_PATH, repo, 'build'),
      p.join(options.outPath, repo)
    );
  }
}

// Gets the ReleaseInfo of the latest release for `repo`. If `version` is given,
// throws an error if the latest version is not semver-compatible with
// `version`. If `tag` is true, gets the latest tag instead of release.
async function getLatestReleaseInfo(options: {
  repo: string;
  versionConstraint?: string;
  tag?: boolean;
}): Promise<ReleaseInfo> {
  console.log(`Getting version info for ${options.repo}.`);
  const response = await fetch(
    'https://api.github.com/repos/sass/' +
      `${options.repo}/${options.tag ? 'tags' : 'releases'}`,
    {
      redirect: 'follow',
    }
  );
  if (!response.ok) {
    throw Error(
      `Failed to get version info for ${options.repo}: ${response.statusText}`
    );
  }
  const latestRelease = JSON.parse(await response.text())[0];
  const latestVersion = options.tag
    ? latestRelease.name
    : latestRelease.tag_name;

  if (options.versionConstraint) {
    try {
      satisfies(latestVersion, options.versionConstraint);
    } catch {
      throw Error(
        `Latest release ${latestVersion} is not compatible with ${options.versionConstraint}.`
      );
    }
  }

  console.log(`Latest release for ${options.repo} is ${latestVersion}.`);
  return latestRelease;
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
  ref?: string;
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

  const version = options.ref ? `commit ${options.ref}` : 'latest update';
  console.log(`Fetching ${version} for ${options.repo}.`);
  shell.exec(`git fetch --depth=1 origin ${options.ref ?? 'main'}`, {
    silent: true,
    cwd: p.join(options.outPath, options.repo),
  });
  shell.exec('git reset --hard FETCH_HEAD', {
    silent: true,
    cwd: p.join(options.outPath, options.repo),
  });
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
