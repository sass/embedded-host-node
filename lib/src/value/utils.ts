// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {hash} from 'immutable';

import {valueError} from '../utils';

/** The precision of Sass numbers. */
export const precision = 10;

// The max distance two Sass numbers can be from each another before they're
// considered different.
//
// Uses ** instead of Math.pow() for constant folding.
const epsilon = 10 ** (-precision - 1);

/** Whether `num1` and `num2` are equal within `epsilon`. */
export function fuzzyEquals(num1: number, num2: number): boolean {
  return Math.abs(num1 - num2) < epsilon;
}

/**
 * Returns a hash code for `num`.
 *
 * Two numbers that `fuzzyEquals` each other must have the same hash code.
 */
export function fuzzyHashCode(num: number): number {
  return !isFinite(num) || isNaN(num)
    ? hash(num)
    : hash(Math.round(num / epsilon));
}

/** Whether `num1` < `num2`, within `epsilon`. */
export function fuzzyLessThan(num1: number, num2: number): boolean {
  return num1 < num2 && !fuzzyEquals(num1, num2);
}

/** Whether `num1` <= `num2`, within `epsilon`. */
export function fuzzyLessThanOrEquals(num1: number, num2: number): boolean {
  return num1 < num2 || fuzzyEquals(num1, num2);
}

/** Whether `num1` > `num2`, within `epsilon`. */
export function fuzzyGreaterThan(num1: number, num2: number): boolean {
  return num1 > num2 && !fuzzyEquals(num1, num2);
}

/** Whether `num1` >= `num2`, within `epsilon`. */
export function fuzzyGreaterThanOrEquals(num1: number, num2: number): boolean {
  return num1 > num2 || fuzzyEquals(num1, num2);
}

/** Whether `num` `fuzzyEquals` an integer. */
export function fuzzyIsInt(num: number): boolean {
  return !isFinite(num) || isNaN(num)
    ? false
    : // Check against 0.5 rather than 0.0 so that we catch numbers that are
      // both very slightly above an integer, and very slightly below.
      fuzzyEquals(Math.abs(num - 0.5) % 1, 0.5);
}

/**
 * If `num` `fuzzyIsInt`, returns it as an integer. Otherwise, returns `null`.
 */
export function fuzzyAsInt(num: number): number | null {
  return fuzzyIsInt(num) ? Math.round(num) : null;
}

/**
 * Rounds `num` to the nearest integer.
 *
 * If `num` `fuzzyEquals` `x.5`, rounds away from zero.
 */
export function fuzzyRound(num: number): number {
  if (num > 0) {
    return fuzzyLessThan(num % 1, 0.5) ? Math.floor(num) : Math.ceil(num);
  } else {
    return fuzzyGreaterThan(num % 1, -0.5) ? Math.ceil(num) : Math.floor(num);
  }
}

/**
 * Returns `num` if it's within `min` and `max`, or `null` if it's not.
 *
 * If `num` `fuzzyEquals` `min` or `max`, it gets clamped to that value.
 */
export function fuzzyInRange(
  num: number,
  min: number,
  max: number
): number | null {
  if (fuzzyEquals(num, min)) return min;
  if (fuzzyEquals(num, max)) return max;
  if (num > min && num < max) return num;
  return null;
}

/**
 * Returns `num` if it's within `min` and `max`. Otherwise, throws an error.
 *
 * If `num` `fuzzyEquals` `min` or `max`, it gets clamped to that value.
 *
 * If `name` is provided, it is used as the parameter name for error reporting.
 */
export function fuzzyAssertInRange(
  num: number,
  min: number,
  max: number,
  name?: string
): number {
  if (fuzzyEquals(num, min)) return min;
  if (fuzzyEquals(num, max)) return max;
  if (num > min && num < max) return num;
  throw valueError(`${num} must be between ${min} and ${max}`, name);
}
