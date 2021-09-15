// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Value} from './value';
import {SassString} from './string';
import {SassNumber} from './number';
import {expectEqualWithHashCode} from '../../../spec/helpers/utils';

describe('Sass string', () => {
  describe('construction', () => {
    it('creates a quoted string with the given text', () => {
      const string = new SassString('nb', {quotes: true});
      expect(string.text).toBe('nb');
      expect(string.hasQuotes).toBe(true);
    });

    it('creates an unquoted string with the given text', () => {
      const string = new SassString('nb', {quotes: false});
      expect(string.text).toBe('nb');
      expect(string.hasQuotes).toBe(false);
    });

    it('creates an empty quoted string', () => {
      const string = SassString.empty({quotes: true});
      expect(string.text).toBe('');
      expect(string.hasQuotes).toBe(true);
    });

    it('creates an empty unquoted string', () => {
      const string = SassString.empty({quotes: false});
      expect(string.text).toBe('');
      expect(string.hasQuotes).toBe(false);
    });

    it('is equal to the same string', () => {
      const string = new SassString('nb', {quotes: true});
      expectEqualWithHashCode(string, new SassString('nb', {quotes: false}));
    });

    it('is a string', () => {
      const value: Value = new SassString('nb');
      expect(() => value.assertString()).not.toThrow();
    });

    it("isn't any other type", () => {
      const value: Value = new SassString('nb');
      expect(value.assertBoolean).toThrow();
      expect(value.assertColor).toThrow();
      expect(value.assertFunction).toThrow();
      expect(value.assertMap).toThrow();
      expect(value.tryMap()).toBe(null);
      expect(value.assertNumber).toThrow();
    });
  });

  describe('length and index handling', () => {
    const string = new SassString('nb');

    it('rejects a zero index', () => {
      expect(() => string.sassIndexToStringIndex(new SassNumber(0))).toThrow();
    });

    it('rejects a non-integer index', () => {
      expect(() =>
        string.sassIndexToStringIndex(new SassNumber(0.1))
      ).toThrow();
    });

    it('rejects a non-SassNumber index', () => {
      expect(() =>
        string.sassIndexToStringIndex(new SassString('1'))
      ).toThrow();
    });

    describe('ASCII', () => {
      const string = new SassString('nb');

      it('returns the length', () => {
        expect(string.sassLength()).toBe(2);
      });

      it('converts a positive index', () => {
        expect(string.sassIndexToStringIndex(new SassNumber(1))).toBe(0);
        expect(string.sassIndexToStringIndex(new SassNumber(2))).toBe(1);
      });

      it('converts a negative index', () => {
        expect(string.sassIndexToStringIndex(new SassNumber(-1))).toBe(1);
        expect(string.sassIndexToStringIndex(new SassNumber(-2))).toBe(0);
      });

      it('rejects out of bound indices', () => {
        expect(() =>
          string.sassIndexToStringIndex(new SassNumber(3))
        ).toThrow();
        expect(() =>
          string.sassIndexToStringIndex(new SassNumber(-3))
        ).toThrow();
      });
    });

    describe('Unicode', () => {
      const string = new SassString('a👭b👬c');

      it('returns the length', () => {
        expect(string.sassLength()).toBe(5);
      });

      it('converts a positive index', () => {
        expect(string.sassIndexToStringIndex(new SassNumber(1))).toBe(0);
        expect(string.sassIndexToStringIndex(new SassNumber(2))).toBe(1);
        expect(string.sassIndexToStringIndex(new SassNumber(3))).toBe(3);
        expect(string.sassIndexToStringIndex(new SassNumber(4))).toBe(4);
        expect(string.sassIndexToStringIndex(new SassNumber(5))).toBe(6);
      });

      it('converts a negative index', () => {
        expect(string.sassIndexToStringIndex(new SassNumber(-1))).toBe(6);
        expect(string.sassIndexToStringIndex(new SassNumber(-2))).toBe(4);
        expect(string.sassIndexToStringIndex(new SassNumber(-3))).toBe(3);
        expect(string.sassIndexToStringIndex(new SassNumber(-4))).toBe(1);
        expect(string.sassIndexToStringIndex(new SassNumber(-5))).toBe(0);
      });

      it('rejects out of bound indices', () => {
        expect(() =>
          string.sassIndexToStringIndex(new SassNumber(6))
        ).toThrow();
        expect(() =>
          string.sassIndexToStringIndex(new SassNumber(-6))
        ).toThrow();
      });
    });
  });
});
