// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {List} from 'immutable';
import * as p from 'path';
import * as url from 'url';

import * as proto from './vendor/embedded_sass_pb';
import {Syntax} from './vendor/sass';

export type PromiseOr<
  T,
  sync extends 'sync' | 'async' = 'async',
> = sync extends 'async' ? T | Promise<T> : T;

// A boolean type that's `true` if `sync` requires synchronous APIs only and
// `false` if it allows asynchronous APIs.
export type SyncBoolean<sync extends 'sync' | 'async'> = sync extends 'async'
  ? false
  : true;

/**
 * The equivalent of `Promise.then()`, except that if the first argument is a
 * plain value it synchronously invokes `callback()` and returns its result.
 */
export function thenOr<T, V, sync extends 'sync' | 'async'>(
  promiseOrValue: PromiseOr<T, sync>,
  callback: (value: T) => PromiseOr<V, sync>
): PromiseOr<V, sync> {
  return promiseOrValue instanceof Promise
    ? (promiseOrValue.then(callback) as PromiseOr<V, sync>)
    : callback(promiseOrValue as T);
}

/**
 * The equivalent of `Promise.catch()`, except that if the first argument throws
 * synchronously it synchronously invokes `callback()` and returns its result.
 */
export function catchOr<T, sync extends 'sync' | 'async'>(
  promiseOrValueCallback: () => PromiseOr<T, sync>,
  callback: (error: unknown) => PromiseOr<T, sync>
): PromiseOr<T, sync> {
  try {
    const result = promiseOrValueCallback();
    return result instanceof Promise
      ? (result.catch(callback) as PromiseOr<T, sync>)
      : result;
  } catch (error: unknown) {
    return callback(error);
  }
}

/** Checks for null or undefined. */
export function isNullOrUndefined<T>(
  object: T | null | undefined
): object is null | undefined {
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

/**
 * Returns a `compilerError()` indicating that the given `field` should have
 * been included but was not.
 */
export function mandatoryError(field: string): Error {
  return compilerError(`Missing mandatory field ${field}`);
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

  // percent encode relative path like `pathToFileURL`
  return encodeURI(path)
    .replace(/[#?]/g, encodeURIComponent)
    .replace(
      process.platform === 'win32' ? /%(5B|5C|5D|5E|7C)/g : /%(5B|5D|5E|7C)/g,
      decodeURIComponent
    )
    .replace(/\\/g, '/');
}

/**
 * Like `url.fileURLToPath`, but returns the same result for Windows-style file
 * URLs on all platforms.
 */
export function fileUrlToPathCrossPlatform(fileUrl: url.URL | string): string {
  const path = url.fileURLToPath(fileUrl);

  // Windows file: URLs begin with `file:///C:/` (or another drive letter),
  // which `fileURLToPath` converts to `"/C:/"` on non-Windows systems. We want
  // to ensure the behavior is consistent across OSes, so we normalize this back
  // to a Windows-style path.
  return /^\/[A-Za-z]:\//.test(path) ? path.substring(1) : path;
}

/** Returns `path` without an extension, if it had one. */
export function withoutExtension(path: string): string {
  const extension = p.extname(path);
  return path.substring(0, path.length - extension.length);
}

/** Converts a JS syntax string into a protobuf syntax enum. */
export function protofySyntax(syntax: Syntax): proto.Syntax {
  switch (syntax) {
    case 'scss':
      return proto.Syntax.SCSS;

    case 'indented':
      return proto.Syntax.INDENTED;

    case 'css':
      return proto.Syntax.CSS;

    default:
      throw new Error(`Unknown syntax: "${syntax}"`);
  }
}

/** Returns whether `error` is a NodeJS-style exception with an error code. */
export function isErrnoException(
  error: unknown
): error is NodeJS.ErrnoException {
  return error instanceof Error && ('errno' in error || 'code' in error);
}

/**
 * Dart-style utility. See
 * http://go/dart-api/stable/2.8.4/dart-core/Map/putIfAbsent.html.
 */
export function putIfAbsent<K, V>(
  map: Map<K, V>,
  key: K,
  provider: () => V
): V {
  const val = map.get(key);
  if (val !== undefined) {
    return val;
  } else {
    const newVal = provider();
    map.set(key, newVal);
    return newVal;
  }
}
