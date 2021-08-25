// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Value} from './value';
import {sassNull} from './null';
import {expectEqualWithHashCode} from '../../../spec/helpers/utils';

describe('Sass null', () => {
  const value: Value = sassNull;

  it('is falsey', () => {
    expect(value.isTruthy).toBe(false);
  });

  it('returns null in realNull check', () => {
    expect(value.realNull).toBe(null);
  });

  it('is equal to itself', () => {
    expectEqualWithHashCode(value, sassNull);
  });

  it("isn't any type", () => {
    expect(value.assertBoolean).toThrow();
    expect(value.assertColor).toThrow();
    expect(value.assertFunction).toThrow();
    expect(value.assertMap).toThrow();
    expect(value.tryMap()).toBe(null);
    expect(value.assertNumber).toThrow();
    expect(value.assertString).toThrow();
  });
});
