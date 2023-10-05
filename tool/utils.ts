// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {promises as fs, existsSync, lstatSync} from 'fs';
import * as p from 'path';
import * as shell from 'shelljs';

shell.config.fatal = true;

// Directory that holds source files.
export const BUILD_PATH = 'build';

// Clones `repo` into `outPath`, then checks out the given Git `ref`.
export function fetchRepo(options: {
  repo: string;
  outPath: string;
  ref: string;
}): void {
  const path = p.join(options.outPath, options.repo);
  if (existsSync(p.join(path, '.git')) && lstatSync(path).isSymbolicLink()) {
    throw (
      `${path} is a symlink to a git repo, not overwriting.\n` +
      `Run "rm ${path}" and try again.`
    );
  }

  if (!existsSync(path)) {
    console.log(`Cloning ${options.repo} into ${options.outPath}.`);
    shell.exec(
      `git clone \
      --depth=1 \
      https://github.com/sass/${options.repo} \
      ${path}`,
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
      cwd: path,
    }
  );
}

// Links or copies the contents of `source` into `destination`.
export async function link(source: string, destination: string): Promise<void> {
  await cleanDir(destination);
  if (process.platform === 'win32') {
    console.log(`Copying ${source} into ${destination}.`);
    shell.cp('-R', source, destination);
  } else {
    source = p.resolve(source);
    console.log(`Linking ${source} into ${destination}.`);
    // Symlinking doesn't play nice with Jasmine's test globbing on Windows.
    await fs.symlink(source, destination);
  }
}

// Ensures that `dir` does not exist, but its parent directory does.
export async function cleanDir(dir: string): Promise<void> {
  await fs.mkdir(p.dirname(dir), {recursive: true});
  try {
    await fs.rm(dir, {force: true, recursive: true});
  } catch (_) {
    // If dir doesn't exist yet, that's fine.
  }
}

/// Returns whether [path1] and [path2] are symlinks that refer to the same file.
export async function sameTarget(
  path1: string,
  path2: string
): Promise<boolean> {
  const realpath1 = await tryRealpath(path1);
  if (realpath1 === null) return false;

  return realpath1 === (await tryRealpath(path2));
}

/// Like `fs.realpath()`, but returns `null` if the path doesn't exist on disk.
async function tryRealpath(path: string): Promise<string | null> {
  try {
    return await fs.realpath(p.resolve(path));
  } catch (_) {
    return null;
  }
}
