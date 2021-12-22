// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {List} from 'immutable';
import * as p from 'path';
import * as url from 'url';

export type PromiseOr<
  T,
  sync extends 'sync' | 'async' = 'async'
> = sync extends 'async' ? T | Promise<T> : T;

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

  const components = p.sep === '\\' ? path.split(/[/\\]/) : path.split('/');
  return components.map(encodeURIComponent).join('/');
}

/** Returns `path` without an extension, if it had one. */
export function withoutExtension(path: string): string {
  const extension = p.extname(path);
  return path.substring(0, path.length - extension.length);
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
