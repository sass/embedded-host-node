// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

// For the most part, Sass treats URIs and paths interchangeably, but Node does
// not. These helper methods smooth over Node's URI/path dichotomy.

import * as p from 'path';
import {fileURLToPath, pathToFileURL, URL} from 'url';

/**
 * Returns the URL that represents `pathOrUri`.
 *
 * If `pathOrUri` is an absolute file path, returns a `file:` UTL.
 * If `pathOrUri` is a URL, returns the URL.
 * If `pathOrUri` is relative, returns a relative URI.
 */
export function toUrl(pathOrUri: string): string {
  try {
    return new URL(pathOrUri).toString();
  } catch (error) {
    if (p.isAbsolute(pathOrUri)) {
      return pathToFileURL(pathOrUri).toString();
    } else {
      return pathOrUri;
    }
  }
}

/**
 * Returns the path representation of `pathOrUri`.
 *
 * If `pathOrUri` is a file URL, returns an absolute path. Otherwise, just
 * returns the URI.
 */
export function toPath(pathOrUri: string): string {
  if (isFileUrl(pathOrUri)) return fileURLToPath(pathOrUri);
  return pathOrUri;
}

/**
 * Determines whether `pathOrUri` is root relative.
 */
export function isRootRelative(pathOrUri: string): boolean {
  return pathOrUri.charAt(0) === '/';
}

/**
 * Determines whether `pathOrUri` is absolute. Returns true for root relative
 * URIs.
 */
export function isAbsolute(pathOrUri: string): boolean {
  try {
    new URL(pathOrUri);
    return true;
  } catch {
    return p.isAbsolute(pathOrUri);
  }
}

/**
 * Creates a relative path from `from` to `to`. `from` and `to` can be paths or
 * URIs.
 */
export function relative(from: string, to: string): string {
  if (isFileUrl(from)) from = fileURLToPath(from);
  if (isFileUrl(to)) to = fileURLToPath(to);
  return p.relative(from, to);
}

function isFileUrl(pathOrUri: string): boolean {
  return /^file:\/\//.test(pathOrUri);
}
