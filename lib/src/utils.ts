// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {List} from 'immutable';
import * as p from 'path';
import * as url from 'url';

export type PromiseOr<T> = T | Promise<T>;

/** Checks for null or undefined. */
export function isNullOrUndefined<T>(object: T): boolean {
  return object === null || object === undefined;
}

/** Returns `collection` as an immutable List. */
export function asImmutableList<T>(collection: T[] | List<T>): List<T> {
  return List.isList(collection) ? collection : List(collection);
}

/** Constructs a compiler-caused Error. */
export function compilerError(message: string): Error {
  return Error(`Compiler caused error: ${message}.`);
}

/** Constructs a host-caused Error. */
export function hostError(message: string): Error {
  return Error(`Compiler reported error: ${message}.`);
}

/** Constructs an error caused by an invalid value type. */
export function valueError(message: string, name?: string): Error {
  return Error(name ? `$${name}: ${message}.` : `${message}.`);
}

/** Converts a (possibly relative) path on the local filesystem to a URL. */
export function pathToUrlString(path: string): string {
  if (p.isAbsolute(path)) return url.pathToFileURL(path).toString();

  const components = p.sep === '\\' ? path.split(/[/\\]/) : path.split('/');
  return components.map(encodeURIComponent).join('/');
}

/** Returns `path` without an extension, if it had one. */
export function withoutExtension(path: string): string {
  const extension = p.extname(path);
  return path.substring(0, path.length - extension.length);
}
