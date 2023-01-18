// Copyright 2022 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {promises as fs} from 'fs';
import * as p from 'path';
import * as yaml from 'yaml';
import * as shell from 'shelljs';

import * as utils from './utils';

/**
 * Downlaods and builds the Embedded Dart Sass compiler.
 *
 * Can check out and build the source from a Git `ref` or build from the source
 * at `path`. By default, checks out the latest revision from GitHub.
 */
export async function getEmbeddedCompiler(
  outPath: string,
  options?: {ref: string} | {path: string}
): Promise<void> {
  const repo = 'dart-sass-embedded';

  let source: string;
  if (!options || 'ref' in options) {
    utils.fetchRepo({
      repo,
      outPath: utils.BUILD_PATH,
      ref: options?.ref ?? 'main',
    });
    source = p.join(utils.BUILD_PATH, repo);
    await maybeOverrideSassDependency(source);
  } else {
    source = options.path;
  }

  buildDartSassEmbedded(source);
  await utils.link(p.join(source, 'build'), p.join(outPath, repo));
}

/**
 * Overrides Embedded Dart Sass compiler's dependency on Dart Sass to use the
 * latest version of Dart Sass from the `main` branch.
 *
 * This allows us to avoid needing to commit a dependency override to the
 * embedded compiler when it doesn't actually require any local changes.
 */
async function maybeOverrideSassDependency(repo: string): Promise<void> {
  const pubspecPath = p.join(repo, 'pubspec.yaml');
  const pubspec = yaml.parse(
    await fs.readFile(pubspecPath, {encoding: 'utf-8'})
  );

  console.log(`Overriding ${repo} to load Dart Sass from HEAD.`);

  pubspec['dependency_overrides'] = {
    ...pubspec['dependency_overrides'],
    sass: {git: 'https://github.com/sass/dart-sass.git'},
  };
  await fs.writeFile(pubspecPath, yaml.stringify(pubspec), {encoding: 'utf-8'});
}

// Builds the Embedded Dart Sass executable from the source at `repoPath`.
function buildDartSassEmbedded(repoPath: string): void {
  console.log('Downloading dart-sass-embedded dependencies.');
  shell.exec('dart pub upgrade', {cwd: repoPath});

  console.log('Building dart-sass-embedded executable.');
  shell.exec('dart run grinder protobuf pkg-standalone-dev', {cwd: repoPath});
}
