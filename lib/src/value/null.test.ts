// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {sassNull} from './null';

describe('Sass null', () => {
  it('is falsey', () => {
    expect(sassNull.isTruthy).toBe(false);
  });

  it('is equal to itself', () => {
    expect(sassNull.equals(sassNull)).toBe(true);
  });

  it("isn't any type", () => {
    expect(sassNull.assertBoolean).toThrow();
    expect(sassNull.assertColor).toThrow();
    expect(sassNull.assertFunction).toThrow();
    expect(sassNull.assertMap).toThrow();
    expect(sassNull.tryMap()).toBe(null);
    expect(sassNull.assertNumber).toThrow();
    expect(sassNull.assertString).toThrow();
  });
});
