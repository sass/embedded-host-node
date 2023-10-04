import extractZip = require('extract-zip');
import {promises as fs} from 'fs';
import * as p from 'path';
import {extract as extractTar} from 'tar';
import yargs from 'yargs';

import * as pkg from '../package.json';
import * as utils from './utils';

export type DartPlatform = 'linux' | 'macos' | 'windows';
export type DartArch = 'ia32' | 'x64' | 'arm' | 'arm64';

const argv = yargs(process.argv.slice(2))
  .option('package', {
    type: 'string',
    description:
      'Directory name under `npm` directory that contains optional dependencies.',
    demandOption: true,
    choices: Object.keys(pkg.optionalDependencies).map(
      name => name.split('sass-embedded-')[1]
    ),
  })
  .parseSync();

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
  const releaseAsset = Buffer.from(await response.arrayBuffer());

  console.log(`Unzipping ${options.repo} release asset to ${options.outPath}.`);
  await utils.cleanDir(p.join(options.outPath, options.repo));

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

void (async () => {
  try {
    const version = pkg['compiler-version'] as string;
    if (version.endsWith('-dev')) {
      throw Error(
        "Can't release optional packages for a -dev compiler version."
      );
    }

    const [nodePlatform, nodeArch] = argv.package.split('-');
    const dartPlatform = nodePlatformToDartPlatform(nodePlatform);
    const dartArch = nodeArchToDartArch(nodeArch);
    const outPath = p.join('npm', argv.package);
    await downloadRelease({
      repo: 'dart-sass',
      assetUrl:
        'https://github.com/sass/dart-sass/releases/download/' +
        `${version}/dart-sass-${version}-` +
        `${dartPlatform}-${dartArch}${getArchiveExtension(dartPlatform)}`,
      outPath,
    });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
