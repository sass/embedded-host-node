// Copyright 2023 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from 'path';
import {URL, pathToFileURL} from 'url';
import {fileUrlToPathCrossPlatform} from '../utils';
import {SourceSpan} from '../vendor/sass';

export const legacyImporterScheme = 'legacy-importer-file';

export const legacyImporterProtocol = legacyImporterScheme + ':';

// A regular expression that matches legacy importer protocol syntax that
// should be removed from human-readable messages.
const removeLegacyImporterRegExp = new RegExp(legacyImporterProtocol, 'g');

// Returns `string` with all instances of legacy importer syntax removed.
export function removeLegacyImporter(string: string): string {
  return string.replace(removeLegacyImporterRegExp, '');
}

// Returns a copy of [span] with the URL updated to remove legacy importer
// syntax.
export function removeLegacyImporterFromSpan(span: SourceSpan): SourceSpan {
  if (span.url?.protocol === legacyImporterProtocol) {
    const path = legacyFileUrlToPath(span.url);
    return {...span, url: path === undefined ? undefined : pathToFileURL(path)};
  }
  return span;
}

// Converts [path] to a `legacy-importer-file:` URL.
export function pathToLegacyFileUrl(path?: string): URL {
  if (path === undefined) {
    return new URL(legacyImporterProtocol);
  } else if (p.isAbsolute(path)) {
    return new URL(legacyImporterProtocol + pathToFileURL(path).pathname);
  } else {
    const encoded = encodeURI(path)
      .replace(/[#?]/g, encodeURIComponent)
      .replace(
        process.platform === 'win32' ? /%(5B|5C|5D|5E|7C)/g : /%(5B|5D|5E|7C)/g,
        decodeURIComponent
      )
      .replace(/\\/g, '/');
    return new URL(legacyImporterProtocol + encoded);
  }
}

// Converts a `legacy-importer-file:` URL or 'file:' URL to the filesystem path
// which it represents.
export function legacyFileUrlToPath(url: URL): string | undefined {
  switch (url.protocol) {
    case legacyImporterProtocol:
      if (url.pathname === '') {
        return undefined;
      } else if (url.pathname.startsWith('/')) {
        return fileUrlToPathCrossPlatform('file://' + url.pathname);
      } else {
        return decodeURIComponent(url.pathname);
      }
    case 'file:':
      return fileUrlToPathCrossPlatform(url);
    default:
      return decodeURI(url.toString());
  }
}
