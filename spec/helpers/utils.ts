// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable} from 'rxjs';

/**
 * Subscribes to `observable` and asserts that it errors with the expected
 * `errorMessage`. Calls `done()` to complete the spec.
 */
export function expectObservableToError<T>(
  observable: Observable<T>,
  errorMessage: string,
  done: () => void
): void {
  observable.subscribe(
    () => fail('expected error'),
    error => {
      expect(error.message).toBe(errorMessage);
      done();
    },
    () => fail('expected error')
  );
}

/**
 * Asserts that the `actual` path is equal to the `expected` one, accounting for
 * OS differences.
 */
export function expectEqualPaths(actual: string, expected: string): void {
  if (process.platform === 'win32') {
    expect(actual.toLowerCase()).toBe(expected.toLowerCase());
  } else {
    expect(actual).toBe(expected);
  }
}

/**
 * Asserts that `string1` is equal to `string2`, ignoring all whitespace in
 * either string.
 */
export function expectEqualIgnoringWhitespace(
  string1: string,
  string2: string
): void {
  function strip(str: string) {
    return str.replace(/\s+/g, '');
  }
  expect(strip(string1)).toBe(strip(string2));
}
