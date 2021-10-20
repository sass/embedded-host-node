// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {List, OrderedMap, ValueObject} from 'immutable';

import {SassBoolean} from './boolean';
import {SassColor} from './color';
import {SassNumber} from './number';
import {SassString} from './string';
import {valueError} from '../utils';

/**
 * A SassScript value.
 *
 * All SassScript values are immutable.
 *
 * Concrete values (such as `SassColor`) are implemented as subclasses and get
 * instantiated as normal JS classes.
 *
 * Untyped values can be cast to particular types using `assert*()` functions,
 * which throw user-friendly error messages if they fail.
 *
 * All values, except `false` and `null`, count as `true`.
 *
 * All values can be used as lists. Maps count as lists of pairs, while all
 * other values count as single-value lists.
 */
export abstract class Value implements ValueObject {
  /** Whether `this` counts as `true`. */
  get isTruthy(): boolean {
    return true;
  }

  /** Returns JS null if `this` is `sassNull`. Otherwise, returns `this`. */
  get realNull(): Value | null {
    return this;
  }

  /** `this` as a list. */
  get asList(): List<Value> {
    return List([this]);
  }

  /** The separator for `this` as a list. */
  get separator(): null {
    return null;
    // TODO(awjin): Implement the proper return type ListSeparator.
  }

  /** Whether `this`, as a list, has brackets. */
  get hasBrackets(): boolean {
    return false;
  }

  /**
   * Converts `sassIndex` to a JS index into the array returned by `asList`.
   *
   * Sass indices start counting at 1, and may be negative in order to index
   * from the end of the list.
   *
   * `sassIndex` must be...
   * - a number, and
   * - an integer, and
   * - a valid index into `asList`.
   *
   * Otherwise, this throws an error.
   *
   * If `this` came from a function argument, `name` is the argument name
   * (without the `$`) and is used for error reporting.
   */
  sassIndexToListIndex(sassIndex: Value, name?: string): number {
    // TODO(awjin)
    throw Error('Not implemented yet');
  }

  /**
   * Casts `this` to `SassBoolean`; throws if `this` isn't a boolean.
   *
   * If `this` came from a function argument, `name` is the argument name
   * (without the `$`) and is used for error reporting.
   */
  assertBoolean(name?: string): SassBoolean {
    throw valueError(`${this} is not a boolean`, name);
  }

  /**
   * Casts `this` to `SassColor`; throws if `this` isn't a color.
   *
   * If `this` came from a function argument, `name` is the argument name
   * (without the `$`) and is used for error reporting.
   */
  assertColor(name?: string): SassColor {
    throw valueError(`${this} is not a color`, name);
  }

  /**
   * Casts `this` to `SassFunction`; throws if `this` isn't a function
   * reference.
   *
   * If `this` came from a function argument, `name` is the argument name
   * (without the `$`) and is used for error reporting.
   */
  assertFunction(name?: string): Value {
    throw valueError(`${this} is not a function reference`, name);
    // TODO(awjin): Narrow the return type to SassFunction.
  }

  /**
   * Casts `this` to `SassMap`; throws if `this` isn't a map.
   *
   * If `this` came from a function argument, `name` is the argument name
   * (without the `$`) and is used for error reporting.
   */
  assertMap(name?: string): Value {
    throw valueError(`${this} is not a map`, name);
    // TODO(awjin): Narrow the return type to SassMap.
  }

  /**
   * Returns `this` as a `SassMap` if it counts as one (including empty lists),
   * or `null` if it does not.
   */
  tryMap(): OrderedMap<Value, Value> | null {
    return null;
  }

  /**
   * Casts `this` to `SassString`; throws if `this` isn't a string.
   *
   * If `this` came from a function argument, `name` is the argument name
   * (without the `$`) and is used for error reporting.
   */
  assertNumber(name?: string): SassNumber {
    throw valueError(`${this} is not a number`, name);
  }

  /**
   * Casts `this` to `SassString`; throws if `this` isn't a string.
   *
   * If `this` came from a function argument, `name` is the argument name
   * (without the `$`) and is used for error reporting.
   */
  assertString(name?: string): SassString {
    throw valueError(`${this} is not a string`, name);
  }

  /** Whether `this == other` in SassScript. */
  abstract equals(other: Value): boolean;

  /** This is the same for values that are `==` in SassScript. */
  abstract hashCode(): number;

  /** A meaningful descriptor for this value. */
  abstract toString(): string;
}
