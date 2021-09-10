// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {List} from 'immutable';

export type PromiseOr<T> = T | Promise<T>;

/** Checks for null or undefined. */
export function isNullOrUndefined<T>(object: T): boolean {
  return object === null || object === undefined;
}

/** Returns `collection` as an immutable List. */
export function asImmutableList<T>(collection: T[] | List<T>): List<T> {
  return collection instanceof Array ? List(collection) : collection;
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
