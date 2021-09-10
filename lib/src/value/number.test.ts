// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {List} from 'immutable';

import {SassNumber} from './number';
import {expectEqualWithHashCode} from '../../../spec/helpers/utils';
import {precision} from './utils';

describe('Sass number', () => {
  describe('unitless', () => {
    describe('integer', () => {
      const number = new SassNumber(123);

      describe('construction', () => {
        it('is a number', () => {
          expect(() => number.assertNumber()).not.toThrow();
        });

        it('has no units', () => {
          expect(number.numeratorUnits.isEmpty()).toBe(true);
          expect(number.denominatorUnits.isEmpty()).toBe(true);
          expect(number.hasUnits).toBe(false);
          expect(number.hasUnit('px')).toBe(false);
          expect(() => number.assertNoUnits()).not.toThrow();
          expect(() => number.assertUnit('px')).toThrow();
        });

        it("isn't any other type", () => {
          expect(() => number.assertBoolean()).toThrow();
          expect(() => number.assertColor()).toThrow();
          expect(() => number.assertFunction()).toThrow();
          expect(() => number.assertMap()).toThrow();
          expect(number.tryMap()).toBe(null);
          expect(() => number.assertString()).toThrow();
        });
      });

      describe('value', () => {
        it('has the correct value', () => {
          expect(number.value).toBe(123);
        });

        it('is an int', () => {
          expect(number.isInt).toBe(true);
          expect(number.asInt).toBe(123);
          expect(number.assertInt()).toBe(123);
        });

        it('clamps within the given range', () => {
          expect(number.assertInRange(0, 123)).toBe(123);
          expect(number.assertInRange(123, 123)).toBe(123);
          expect(number.assertInRange(123, 1000)).toBe(123);
        });

        it('rejects a value outside the range', () => {
          expect(() => number.assertInRange(0, 122)).toThrow();
          expect(() => number.assertInRange(124, 1000)).toThrow();
        });
      });

      describe('equality', () => {
        it('equals the same number', () => {
          expectEqualWithHashCode(number, new SassNumber(123));
        });

        it('equals the same number within precision tolerance', () => {
          expectEqualWithHashCode(
            number,
            new SassNumber(123 + Math.pow(10, -precision - 2))
          );
          expectEqualWithHashCode(
            number,
            new SassNumber(123 - Math.pow(10, -precision - 2))
          );
        });

        it("doesn't equal a different number", () => {
          expect(number.equals(new SassNumber(122))).toBe(false);
          expect(number.equals(new SassNumber(124))).toBe(false);
          expect(
            number.equals(new SassNumber(123 + Math.pow(10, -precision - 1)))
          ).toBe(false);
          expect(
            number.equals(new SassNumber(123 - Math.pow(10, -precision - 1)))
          ).toBe(false);
        });

        it("doesn't equal a number with units", () => {
          expect(number.equals(new SassNumber(123, 'px'))).toBe(false);
        });
      });

      describe('convert/coerce', () => {
        it('is compatible with any unit', () => {
          expect(number.compatibleWithUnit('px')).toBe(true);
          expect(number.compatibleWithUnit('abc')).toBe(true);
        });

        it('can be converted to unitless', () => {
          expect(number.convert([], []).equals(new SassNumber(123))).toBe(true);
        });

        it('can be converted to match unitless', () => {
          expect(
            number
              .convertToMatch(new SassNumber(456))
              .equals(new SassNumber(123))
          ).toBe(true);
        });

        it('cannot be converted to a unit', () => {
          expect(() => number.convert(['px'], [])).toThrow();
        });

        it('cannot be converted to match a unit', () => {
          expect(() =>
            number.convertToMatch(new SassNumber(456, 'px'))
          ).toThrow();
        });

        it('cannot be converted to any unit', () => {
          expect(() => number.convert(['abc'], ['def'])).toThrow();
        });

        it('cannot be converted to match any unit', () => {
          expect(() =>
            number.convertToMatch(
              SassNumber.withUnits(456, {
                numeratorUnits: ['abc'],
                denominatorUnits: ['def'],
              })
            )
          ).toThrow();
        });

        it('can convert its value to unitless', () => {
          expect(number.convertValue([], [])).toEqual(123);
        });

        it('can convert its value to match unitless', () => {
          expect(number.convertValueToMatch(new SassNumber(456))).toEqual(123);
        });

        it('cannot convert its value to a unit', () => {
          expect(() => number.convertValue(['px'], [])).toThrow();
        });

        it('cannot convert its value to match a unit', () => {
          expect(() =>
            number.convertValueToMatch(new SassNumber(456, 'px'))
          ).toThrow();
        });

        it('cannot convert its value to any units', () => {
          expect(() => number.convertValue(['abc'], ['def'])).toThrow();
        });

        it('cannot convert its value to match any units', () => {
          expect(() =>
            number.convertValueToMatch(
              SassNumber.withUnits(456, {
                numeratorUnits: ['abc'],
                denominatorUnits: ['def'],
              })
            )
          ).toThrow();
        });

        it('can be coerced to unitless', () => {
          expect(number.coerce([], []).equals(new SassNumber(123))).toBe(true);
        });

        it('can be coerced to match unitless', () => {
          expect(
            number
              .coerceToMatch(new SassNumber(456))
              .equals(new SassNumber(123))
          ).toBe(true);
        });

        it('can be coerced to a unit', () => {
          expect(
            number.coerce(['px'], []).equals(
              SassNumber.withUnits(123, {
                numeratorUnits: ['px'],
              })
            )
          ).toBe(true);
        });

        it('can be coerced to match a unit', () => {
          expect(
            number
              .coerceToMatch(
                SassNumber.withUnits(456, {
                  numeratorUnits: ['px'],
                })
              )
              .equals(
                SassNumber.withUnits(123, {
                  numeratorUnits: ['px'],
                })
              )
          ).toBe(true);
        });

        it('can be coerced to any units', () => {
          expect(
            number.coerce(['abc'], ['def']).equals(
              SassNumber.withUnits(123, {
                numeratorUnits: ['abc'],
                denominatorUnits: ['def'],
              })
            )
          ).toBe(true);
        });

        it('can be coerced to match any units', () => {
          expect(
            number
              .coerceToMatch(
                SassNumber.withUnits(456, {
                  numeratorUnits: ['abc'],
                  denominatorUnits: ['def'],
                })
              )
              .equals(
                SassNumber.withUnits(123, {
                  numeratorUnits: ['abc'],
                  denominatorUnits: ['def'],
                })
              )
          ).toBe(true);
        });

        it('can coerce its value to unitless', () => {
          expect(number.coerceValue([], [])).toEqual(123);
        });

        it('can coerce its value to match unitless', () => {
          expect(number.coerceValueToMatch(new SassNumber(456))).toEqual(123);
        });

        it('can coerce its value to a unit', () => {
          expect(number.coerceValue(['px'], [])).toEqual(123);
        });

        it('can coerce its value to match a unit', () => {
          expect(
            number.coerceValueToMatch(
              SassNumber.withUnits(456, {
                numeratorUnits: ['px'],
              })
            )
          ).toEqual(123);
        });

        it('can coerce its value to any units', () => {
          expect(number.coerceValue(['abc'], ['def'])).toEqual(123);
        });

        it('can coerce its value to match any units', () => {
          expect(
            number.coerceValueToMatch(
              SassNumber.withUnits(456, {
                numeratorUnits: ['abc'],
                denominatorUnits: ['def'],
              })
            )
          ).toEqual(123);
        });
      });
    });

    describe('fuzzy integer', () => {
      const number = new SassNumber(123.000000000001);

      it('has the correct value', () => {
        expect(number.value).toBe(123.000000000001);
      });

      it('is an int', () => {
        expect(number.isInt).toBe(true);
        expect(number.asInt).toBe(123);
        expect(number.assertInt()).toBe(123);
      });

      it('clamps within the given range', () => {
        expect(number.assertInRange(0, 123)).toBe(123);
        expect(number.assertInRange(123, 123)).toBe(123);
        expect(number.assertInRange(123, 1000)).toBe(123);
      });

      it('rejects a value outside the range', () => {
        expect(() => number.assertInRange(0, 122)).toThrow();
        expect(() => number.assertInRange(124, 1000)).toThrow();
      });

      it('equals the same number', () => {
        expectEqualWithHashCode(
          number,
          new SassNumber(123 + Math.pow(10, -precision - 2))
        );
      });

      it('equals the same number within precision tolerance', () => {
        expectEqualWithHashCode(number, new SassNumber(123));
        expectEqualWithHashCode(
          number,
          new SassNumber(123 - Math.pow(10, -precision - 2))
        );
      });
    });

    describe('double', () => {
      const number = new SassNumber(123.456);

      it('has the correct value', () => {
        expect(number.value).toBe(123.456);
      });

      it('is not an int', () => {
        expect(number.isInt).toBe(false);
        expect(number.asInt).toBe(null);
        expect(() => number.assertInt()).toThrow();
      });
    });
  });

  describe('single numerator unit', () => {
    const number = new SassNumber(123, 'px');

    describe('construction', () => {
      it('has that unit', () => {
        expect(number.numeratorUnits.equals(List(['px']))).toBe(true);
        expect(number.hasUnits).toBe(true);
        expect(number.hasUnit('px')).toBe(true);
        expect(() => number.assertUnit('px')).not.toThrow();
        expect(() => number.assertNoUnits()).toThrow();
      });

      it('has no other units', () => {
        expect(number.denominatorUnits.isEmpty()).toBe(true);
        expect(number.hasUnit('in')).toBe(false);
        expect(() => number.assertUnit('in')).toThrow();
      });
    });

    describe('convert/coerce', () => {
      it('is compatible with the same unit', () => {
        expect(number.compatibleWithUnit('px')).toBe(true);
      });

      it('is compatible with a compatible unit', () => {
        expect(number.compatibleWithUnit('in')).toBe(true);
      });

      it('is incompatible with an incompatible unit', () => {
        expect(number.compatibleWithUnit('abc')).toBe(false);
      });

      it('cannot be converted to unitless', () => {
        expect(() => number.convert([], [])).toThrow();
      });

      it('cannot be converted to match unitless', () => {
        expect(() => number.convertToMatch(new SassNumber(456))).toThrow();
      });

      it('can be converted to compatible units', () => {
        expect(number.convert(['px'], []).equals(number)).toBe(true);
        expect(
          number.convert(['in'], []).equals(new SassNumber(1.28125, 'in'))
        ).toBe(true);
      });

      it('can be converted to match compatible units', () => {
        expect(
          number.convertToMatch(new SassNumber(456, 'px')).equals(number)
        ).toBe(true);
        expect(
          number
            .convertToMatch(new SassNumber(456, 'in'))
            .equals(new SassNumber(1.28125, 'in'))
        ).toBe(true);
      });

      it('cannot be converted to incompatible units', () => {
        expect(() => number.convert(['abc'], [])).toThrow();
      });

      it('cannot be converted to match incompatible units', () => {
        expect(() =>
          number.convertToMatch(new SassNumber(456, 'abc'))
        ).toThrow();
      });

      it('cannot convert its value to unitless', () => {
        expect(() => number.convertValue([], [])).toThrow();
      });

      it('cannot convert its value to match unitless', () => {
        expect(() => number.convertValueToMatch(new SassNumber(456))).toThrow();
      });

      it('can convert its value to compatible units', () => {
        expect(number.convertValue(['px'], [])).toBe(123);
        expect(number.convertValue(['in'], [])).toBe(1.28125);
      });

      it('can convert its value to match compatible units', () => {
        expect(number.convertValueToMatch(new SassNumber(456, 'px'))).toBe(123);
        expect(number.convertValueToMatch(new SassNumber(456, 'in'))).toBe(
          1.28125
        );
      });

      it('cannot convert its value to incompatible units', () => {
        expect(() => number.convertValue(['abc'], [])).toThrow();
      });

      it('cannot convert its value to match incompatible units', () => {
        expect(() =>
          number.convertValueToMatch(new SassNumber(456, 'abc'))
        ).toThrow();
      });

      it('can be coerced to unitless', () => {
        expect(number.coerce([], []).equals(new SassNumber(123))).toBe(true);
      });

      it('can be coerced to match unitless', () => {
        expect(
          number.coerceToMatch(new SassNumber(456)).equals(new SassNumber(123))
        ).toBe(true);
      });

      it('can be coerced to compatible units', () => {
        expect(number.coerce(['px'], []).equals(number)).toBe(true);
        expect(
          number.coerce(['in'], []).equals(new SassNumber(1.28125, 'in'))
        ).toBe(true);
      });

      it('can be coerced to match compatible units', () => {
        expect(
          number.coerceToMatch(new SassNumber(456, 'px')).equals(number)
        ).toBe(true);
        expect(
          number
            .coerceToMatch(new SassNumber(456, 'in'))
            .equals(new SassNumber(1.28125, 'in'))
        ).toBe(true);
      });

      it('cannot be coerced to incompatible units', () => {
        expect(() => number.coerce(['abc'], [])).toThrow();
      });

      it('cannot be coerced to match incompatible units', () => {
        expect(() =>
          number.coerceToMatch(new SassNumber(456, 'abc'))
        ).toThrow();
      });

      it('can coerce its value to unitless', () => {
        expect(number.coerceValue([], [])).toBe(123);
      });

      it('can coerce its value to match unitless', () => {
        expect(number.coerceValueToMatch(new SassNumber(456))).toBe(123);
      });

      it('can coerce its value to compatible units', () => {
        expect(number.coerceValue(['px'], [])).toBe(123);
        expect(number.coerceValue(['in'], [])).toBe(1.28125);
      });

      it('can coerce its value to match compatible units', () => {
        expect(number.coerceValueToMatch(new SassNumber(456, 'px'))).toBe(123);
        expect(number.coerceValueToMatch(new SassNumber(456, 'in'))).toBe(
          1.28125
        );
      });

      it('cannot coerce its value to incompatible units', () => {
        expect(() => number.coerceValue(['abc'], [])).toThrow();
      });

      it('cannot coerce its value to match incompatible units', () => {
        expect(() =>
          number.coerceValueToMatch(new SassNumber(456, 'abc'))
        ).toThrow();
      });
    });

    describe('equality', () => {
      it('equals the same number', () => {
        expectEqualWithHashCode(number, new SassNumber(123, 'px'));
      });

      it('equals an equivalent number', () => {
        expectEqualWithHashCode(number, new SassNumber(1.28125, 'in'));
      });

      it("doesn't equal a unitless number", () => {
        expect(number.equals(new SassNumber(123))).toBe(false);
      });

      it("doesn't equal a number with different units", () => {
        expect(number.equals(new SassNumber(123, 'abc'))).toBe(false);
        expect(
          number.equals(
            SassNumber.withUnits(123, {numeratorUnits: ['px', 'px']})
          )
        ).toBe(false);
        expect(
          number.equals(
            SassNumber.withUnits(123, {
              numeratorUnits: ['px'],
              denominatorUnits: ['abc'],
            })
          )
        ).toBe(false);
        expect(
          number.equals(SassNumber.withUnits(123, {denominatorUnits: ['px']}))
        ).toBe(false);
      });
    });
  });

  describe('numerator and denominator units', () => {
    const number = SassNumber.withUnits(123, {
      numeratorUnits: ['px'],
      denominatorUnits: ['ms'],
    });

    describe('construction', () => {
      it('has those units', () => {
        expect(number.hasUnits).toBe(true);
        expect(number.hasUnit('px')).toBe(false);
        expect(() => number.assertUnit('px')).toThrow();
        expect(() => number.assertNoUnits()).toThrow();
      });

      it('does not simplify incompatible units', () => {
        expect(number.numeratorUnits).toEqual(List(['px']));
        expect(number.denominatorUnits).toEqual(List(['ms']));
      });

      it('simplifies compatible units', () => {
        const number = SassNumber.withUnits(123, {
          numeratorUnits: ['px', 's'],
          denominatorUnits: ['ms'],
        });
        expect(number.value).toBe(123000);
        expect(number.numeratorUnits.equals(List(['px']))).toBe(true);
        expect(number.denominatorUnits.isEmpty()).toBe(true);
      });

      it('does not simplify unknown units', () => {
        const number = SassNumber.withUnits(123, {
          numeratorUnits: ['abc'],
          denominatorUnits: ['def'],
        });
        expect(number.value).toBe(123);
        expect(number.numeratorUnits.equals(List(['abc']))).toBe(true);
        expect(number.denominatorUnits.equals(List(['def']))).toBe(true);
      });
    });

    describe('convert/coerce', () => {
      it('is incompatible with the numerator unit', () => {
        expect(number.compatibleWithUnit('px')).toBe(false);
      });

      it('is incompatible with the denominator unit', () => {
        expect(number.compatibleWithUnit('ms')).toBe(false);
      });

      it('cannot be converted to unitless', () => {
        expect(() => number.convert([], [])).toThrow();
      });

      it('cannot be converted to match unitless', () => {
        expect(() => number.convertToMatch(new SassNumber(456))).toThrow();
      });

      it('can be converted to compatible units', () => {
        expect(number.convert(['px'], ['ms']).equals(number)).toBe(true);
        expect(
          number.convert(['in'], ['s']).equals(
            SassNumber.withUnits(1281.25, {
              numeratorUnits: ['in'],
              denominatorUnits: ['s'],
            })
          )
        ).toBe(true);
      });

      it('can be converted to match compatible units', () => {
        expect(
          number
            .convertToMatch(
              SassNumber.withUnits(456, {
                numeratorUnits: ['px'],
                denominatorUnits: ['ms'],
              })
            )
            .equals(number)
        ).toBe(true);
        expect(
          number
            .convertToMatch(
              SassNumber.withUnits(456, {
                numeratorUnits: ['in'],
                denominatorUnits: ['s'],
              })
            )
            .equals(
              SassNumber.withUnits(1281.25, {
                numeratorUnits: ['in'],
                denominatorUnits: ['s'],
              })
            )
        ).toBe(true);
      });

      it('cannot convert its value to unitless', () => {
        expect(() => number.convertValue([], [])).toThrow();
      });

      it('cannot convert its value to match unitless', () => {
        expect(() => number.convertValueToMatch(new SassNumber(456))).toThrow();
      });

      it('can convert its value to compatible units', () => {
        expect(number.convertValue(['px'], ['ms'])).toBe(123);
        expect(number.convertValue(['in'], ['s'])).toBe(1281.25);
      });

      it('can convert its value to match compatible units', () => {
        expect(
          number.convertValueToMatch(
            SassNumber.withUnits(456, {
              numeratorUnits: ['px'],
              denominatorUnits: ['ms'],
            })
          )
        ).toBe(123);
        expect(
          number.convertValueToMatch(
            SassNumber.withUnits(456, {
              numeratorUnits: ['in'],
              denominatorUnits: ['s'],
            })
          )
        ).toBe(1281.25);
      });

      it('cannot convert its value to incompatible units', () => {
        expect(() => number.convertValue(['abc'], [])).toThrow();
      });

      it('cannot convert its value to match incompatible units', () => {
        expect(() =>
          number.convertValueToMatch(new SassNumber(456, 'abc'))
        ).toThrow();
      });

      it('can be coerced to unitless', () => {
        expect(number.coerce([], []).equals(new SassNumber(123))).toBe(true);
      });

      it('can be coerced to match unitless', () => {
        expect(
          number.coerceToMatch(new SassNumber(456)).equals(new SassNumber(123))
        ).toBe(true);
      });

      it('can be coerced to compatible units', () => {
        expect(number.coerce(['px'], ['ms']).equals(number)).toBe(true);
        expect(
          number.coerce(['in'], ['s']).equals(
            SassNumber.withUnits(1281.25, {
              numeratorUnits: ['in'],
              denominatorUnits: ['s'],
            })
          )
        ).toBe(true);
      });

      it('can be coerced to match compatible units', () => {
        expect(
          number
            .coerceToMatch(
              SassNumber.withUnits(456, {
                numeratorUnits: ['px'],
                denominatorUnits: ['ms'],
              })
            )
            .equals(number)
        ).toBe(true);
        expect(
          number
            .coerceToMatch(
              SassNumber.withUnits(456, {
                numeratorUnits: ['in'],
                denominatorUnits: ['s'],
              })
            )
            .equals(
              SassNumber.withUnits(1281.25, {
                numeratorUnits: ['in'],
                denominatorUnits: ['s'],
              })
            )
        ).toBe(true);
      });

      it('cannot be coerced to incompatible units', () => {
        expect(() => number.coerce(['abc'], [])).toThrow();
      });

      it('cannot be coerced to match incompatible units', () => {
        expect(() =>
          number.coerceToMatch(
            SassNumber.withUnits(456, {
              numeratorUnits: ['abc'],
              denominatorUnits: [],
            })
          )
        ).toThrow();
      });

      it('can coerce its value to unitless', () => {
        expect(number.coerceValue([], [])).toBe(123);
      });

      it('can coerce its value to match unitless', () => {
        expect(
          number.coerceValueToMatch(
            SassNumber.withUnits(456, {
              numeratorUnits: [],
              denominatorUnits: [],
            })
          )
        ).toBe(123);
      });

      it('can coerce its value to compatible units', () => {
        expect(number.coerceValue(['px'], ['ms'])).toBe(123);
        expect(number.coerceValue(['in'], ['s'])).toBe(1281.25);
      });

      it('can coerce its value to match compatible units', () => {
        expect(
          number.coerceValueToMatch(
            SassNumber.withUnits(456, {
              numeratorUnits: ['px'],
              denominatorUnits: ['ms'],
            })
          )
        ).toBe(123);
        expect(
          number.coerceValueToMatch(
            SassNumber.withUnits(456, {
              numeratorUnits: ['in'],
              denominatorUnits: ['s'],
            })
          )
        ).toBe(1281.25);
      });

      it('cannot coerce its value to incompatible units', () => {
        expect(() => number.coerceValue(['abc'], [])).toThrow();
      });

      it('cannot coerce its value to match incompatible units', () => {
        expect(() =>
          number.coerceValueToMatch(
            SassNumber.withUnits(456, {
              numeratorUnits: ['abc'],
              denominatorUnits: [],
            })
          )
        ).toThrow();
      });
    });

    describe('equality', () => {
      it('equals the same number', () => {
        expectEqualWithHashCode(
          number,
          SassNumber.withUnits(123, {
            numeratorUnits: ['px'],
            denominatorUnits: ['ms'],
          })
        );
      });

      it('equals an equivalent number', () => {
        expectEqualWithHashCode(
          number,
          SassNumber.withUnits(1281.25, {
            numeratorUnits: ['in'],
            denominatorUnits: ['s'],
          })
        );
      });

      it("doesn't equal a unitless number", () => {
        expect(number.equals(new SassNumber(24.6))).toBe(false);
      });

      it("doesn't equal a number with different units", () => {
        expect(number.equals(new SassNumber(123, 'px'))).toBe(false);
        expect(
          number.equals(SassNumber.withUnits(123, {denominatorUnits: ['ms']}))
        ).toBe(false);
        expect(
          number.equals(
            SassNumber.withUnits(123, {
              numeratorUnits: ['ms'],
              denominatorUnits: ['px'],
            })
          )
        ).toBe(false);
        expect(
          number.equals(
            SassNumber.withUnits(123, {
              numeratorUnits: ['in'],
              denominatorUnits: ['s'],
            })
          )
        ).toBe(false);
      });
    });
  });
});
