// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {List, OrderedMap, ValueObject} from 'immutable';

import {ListSeparator} from './list';
import {SassBoolean} from './boolean';
import {SassColor} from './color';
import {SassMap} from './map';
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
 * other values count as single-value lists. Empty maps are equal to empty
 * lists.
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
  get separator(): ListSeparator {
    return null;
  }

  /** Whether `this`, as a list, has brackets. */
  get hasBrackets(): boolean {
    return false;
  }

  // Subclasses can override this to change the behavior of
  // `sassIndexToListIndex`.
  protected get lengthAsList(): number {
    return 1;
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
    const index = sassIndex.assertNumber().assertInt();
    if (index === 0) {
      throw Error('List index may not be 0.');
    }
    if (Math.abs(index) > this.lengthAsList) {
      throw valueError(
        `Invalid index ${sassIndex} for a list with ${this.lengthAsList} elements.`,
        name
      );
    }
    return index < 0 ? this.lengthAsList + index : index - 1;
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
  assertMap(name?: string): SassMap {
    throw valueError(`${this} is not a map`, name);
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
