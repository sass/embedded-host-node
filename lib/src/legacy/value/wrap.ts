// Copyright 2022 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as util from 'util';

import {PromiseOr, SyncBoolean} from '../../utils';
import {Value} from '../../value';
import {sassTrue, sassFalse} from '../../value/boolean';
import {sassNull} from '../../value/null';
import {
  CustomFunction,
  LegacyFunction,
  LegacyPluginThis,
  LegacyValue,
} from '../../vendor/sass';
import * as types from '../../vendor/sass';

/**
 * Converts a `LegacyFunction` into a `CustomFunction` so it can be passed to
 * the new JS API.
 */
export function wrapFunction<sync extends 'sync' | 'async'>(
  thisArg: LegacyPluginThis,
  callback: LegacyFunction<sync>,
  sync: SyncBoolean<sync>
): CustomFunction<sync> {
  if (sync) {
    return args =>
      unwrapValue(
        (callback as LegacyFunction<'sync'>).apply(thisArg, args.map(wrapValue))
      );
  } else {
    return args =>
      new Promise((resolve, reject) => {
        const done = (result: unknown) =>
          result instanceof Error
            ? reject(result)
            : resolve(unwrapValue(result));

        // The cast here is necesary to work around microsoft/TypeScript#33815.
        resolve(
          unwrapValue(
            (callback as (...args: unknown[]) => unknown).apply(thisArg, [
              ...args.map(wrapValue),
              done,
            ])
          )
        );
      }) as PromiseOr<types.Value, sync>;
  }
}

// Converts a value returned by a `LegacyFunction` into a `types.Value`.
function unwrapValue(value: unknown): types.Value {
  return unwrapHostValue(value) as types.Value;
}

// Like `unwrapValue`, but returns the `Value` type defined by this package.
function unwrapHostValue(value: unknown): Value {
  if (value instanceof Error) throw value;
  if (value === sassTrue) return sassTrue;
  if (value === sassFalse) return sassFalse;
  if (value === sassNull) return sassNull;
  throw new Error(`Expected legacy Sass value, got ${util.inspect(value)}.`);
}

// Converts a `types.Value` into a `LegacyValue`.
function wrapValue(value: types.Value): LegacyValue {
  if (value === sassTrue || value === sassFalse || value === sassNull) {
    return value;
  }
  throw new Error(`Expected Sass value, got ${util.inspect(value)}.`);
}
