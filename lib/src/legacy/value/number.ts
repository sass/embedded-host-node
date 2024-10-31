// Copyright 2022 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {SassNumber} from '../../value/number';
import {LegacyValueBase} from './base';

export class LegacyNumber extends LegacyValueBase<SassNumber> {
  constructor(valueOrInner: number | SassNumber, unit?: string) {
    super(
      valueOrInner instanceof SassNumber
        ? valueOrInner
        : parseNumber(valueOrInner, unit),
    );
  }

  getValue(): number {
    return this.inner.value;
  }

  setValue(value: number): void {
    this.inner = new SassNumber(value, {
      numeratorUnits: this.inner.numeratorUnits,
      denominatorUnits: this.inner.denominatorUnits,
    });
  }

  getUnit(): string {
    return (
      this.inner.numeratorUnits.join('*') +
      (this.inner.denominatorUnits.size === 0 ? '' : '/') +
      this.inner.denominatorUnits.join('*')
    );
  }

  setUnit(unit: string): void {
    this.inner = parseNumber(this.inner.value, unit);
  }
}

Object.defineProperty(LegacyNumber, 'name', {value: 'sass.types.Number'});

// Parses a `SassNumber` from `value` and `unit`, using Node Sass's unit
// format.
function parseNumber(value: number, unit?: string): SassNumber {
  if (!unit) return new SassNumber(value);

  if (!unit.includes('*') && !unit.includes('/')) {
    return new SassNumber(value, unit);
  }

  const invalidUnit = new Error(`Unit ${unit} is invalid`);

  const operands = unit.split('/');
  if (operands.length > 2) throw invalidUnit;

  const numerator = operands[0];
  const denominator = operands.length === 1 ? null : operands[1];

  const numeratorUnits = numerator.length === 0 ? [] : numerator.split('*');
  if (numeratorUnits.some(unit => unit.length === 0)) throw invalidUnit;

  const denominatorUnits = denominator === null ? [] : denominator.split('*');
  if (denominatorUnits.some(unit => unit.length === 0)) throw invalidUnit;

  return new SassNumber(value, {
    numeratorUnits: numeratorUnits,
    denominatorUnits: denominatorUnits,
  });
}
