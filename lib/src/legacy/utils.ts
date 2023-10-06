// Copyright 2023 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {strict as assert} from 'assert';
import {pathToFileURL} from 'url';

import {fileUrlToPathCrossPlatform} from '../utils';
import {SourceSpan} from '../vendor/sass';
import {legacyImporterFileProtocol} from './importer';

/**
 * The URL protocol to use for URLs canonicalized using `LegacyImporterWrapper`.
 */
export const legacyImporterProtocol = 'legacy-importer:';

/**
 * The prefix for absolute URLs canonicalized using `LegacyImporterWrapper`.
 *
 * This is used to distinguish imports resolved relative to URLs returned by a
 * legacy importer from manually-specified absolute URLs.
 */
export const legacyImporterProtocolPrefix = 'legacy-importer-';

/// A regular expression that matches legacy importer protocol syntax that
/// should be removed from human-readable messages.
const removeLegacyImporterRegExp = new RegExp(
  `${legacyImporterProtocol}|${legacyImporterProtocolPrefix}`,
  'g'
);

/// Returns `string` with all instances of legacy importer syntax removed.
export function removeLegacyImporter(string: string): string {
  return string.replace(removeLegacyImporterRegExp, '');
}

/// Returns a copy of [span] with the URL updated to remove legacy importer
/// syntax.
export function removeLegacyImporterFromSpan(span: SourceSpan): SourceSpan {
  if (!span.url) return span;
  return {...span, url: new URL(removeLegacyImporter(span.url.toString()))};
}

/// Converts [path] to a `file:` URL and adds the [legacyImporterProtocolPrefix]
/// to the beginning so we can distinguish it from manually-specified absolute
/// `file:` URLs.
export function pathToLegacyFileUrl(path: string): URL {
  return new URL(`${legacyImporterProtocolPrefix}${pathToFileURL(path)}`);
}

/// Converts a `file:` URL with [legacyImporterProtocolPrefix] to the filesystem
/// path which it represents.
export function legacyFileUrlToPath(url: URL): string {
  assert.equal(url.protocol, legacyImporterFileProtocol);
  const originalUrl = url
    .toString()
    .substring(legacyImporterProtocolPrefix.length);
  return fileUrlToPathCrossPlatform(originalUrl);
}
