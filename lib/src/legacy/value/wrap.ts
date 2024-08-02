// Copyright 2022 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as util from 'util';

import {LegacyValueBase} from './base';
import {LegacyColor} from './color';
import {LegacyList} from './list';
import {LegacyMap} from './map';
import {LegacyNumber} from './number';
import {LegacyString} from './string';
import {PromiseOr, SyncBoolean} from '../../utils';
import {Value} from '../../value';
import {SassColor} from '../../value/color';
import {SassList} from '../../value/list';
import {SassMap} from '../../value/map';
import {SassNumber} from '../../value/number';
import {SassString} from '../../value/string';
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
      unwrapTypedValue(
        (callback as LegacyFunction<'sync'>).apply(thisArg, args.map(wrapValue))
      );
  } else {
    return args =>
      new Promise((resolve, reject) => {
        function done(result: unknown): void {
          try {
            if (result instanceof Error) {
              reject(result);
            } else {
              resolve(unwrapTypedValue(result));
            }
          } catch (error: unknown) {
            reject(error);
          }
        }

        // The cast here is necesary to work around microsoft/TypeScript#33815.
        const syncResult = (callback as (...args: unknown[]) => unknown).apply(
          thisArg,
          [...args.map(wrapValue), done]
        );

        if (syncResult !== undefined) resolve(unwrapTypedValue(syncResult));
      }) as PromiseOr<types.Value, sync>;
  }
}

// Like `unwrapValue()`, but returns a `types.Value` type.
function unwrapTypedValue(value: unknown): types.Value {
  return unwrapValue(value) as types.Value;
}

/** Converts a value returned by a `LegacyFunction` into a `Value`. */
export function unwrapValue(value: unknown): Value {
  if (value instanceof Error) throw value;
  if (value instanceof Value) return value;
  if (value instanceof LegacyValueBase) return value.inner;
  throw new Error(`Expected legacy Sass value, got ${util.inspect(value)}.`);
}

/** Converts a `Value` into a `LegacyValue`. */
export function wrapValue(value: Value | types.Value): LegacyValue {
  if (value instanceof SassColor) return new LegacyColor(value);
  if (value instanceof SassList) return new LegacyList(value);
  if (value instanceof SassMap) return new LegacyMap(value);
  if (value instanceof SassNumber) return new LegacyNumber(value);
  if (value instanceof SassString) return new LegacyString(value);
  if (value instanceof Value) return value;
  throw new Error(`Expected Sass value, got ${util.inspect(value)}.`);
}
