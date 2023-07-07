// Copyright 2023 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {hash, List, ValueObject} from 'immutable';

import {Value} from './index';
import {SassNumber} from './number';
import {SassString} from './string';

export type CalculationValue =
  | SassNumber
  | SassCalculation
  | SassString
  | CalculationOperation
  | CalculationInterpolation;

type CalculationValueIterable = CalculationValue[] | List<CalculationValue>;

function checkUnquotedString(value: CalculationValue): void {
  if (value instanceof SassString && value.hasQuotes) {
    throw new Error(`Expected ${value} to be an unquoted string.`);
  }
}

export class SassCalculation extends Value {
  readonly name: string;
  readonly arguments: List<CalculationValue>;

  private constructor(name: string, args: CalculationValueIterable) {
    super();
    this.name = name;
    this.arguments = List(args);
  }

  static calc(argument: CalculationValue): SassCalculation {
    checkUnquotedString(argument);
    return new SassCalculation('calc', [argument]);
  }

  static min(args: CalculationValueIterable): SassCalculation {
    args.forEach(checkUnquotedString);
    return new SassCalculation('min', args);
  }

  static max(args: CalculationValueIterable): SassCalculation {
    args.forEach(checkUnquotedString);
    return new SassCalculation('max', args);
  }

  static clamp(
    min: CalculationValue,
    value?: CalculationValue,
    max?: CalculationValue
  ): SassCalculation {
    if (value === undefined && max === undefined) {
      let minString: string;
      if (min instanceof SassString) {
        minString = min.text;
      } else if (min instanceof CalculationInterpolation) {
        minString = min.value;
      } else {
        throw new Error(
          '`value` and `max` are both undefined, but `min` is not a SassString or CalculationInterpolation.'
        );
      }
      const values = minString.split(',').map(s => {
        const parsed = parseFloat(s.trim());
        return isNaN(parsed) ? undefined : new SassNumber(parsed);
      });
      const error = new Error(
        `Expected \`min\` to be a comma-separated list of numbers, got \`${min}\``
      );
      if (values[0] === undefined) {
        throw error;
      } else if (values.length === 2) {
        [min, value] = values;
      } else if (values.length === 3) {
        [min, value, max] = values;
      } else {
        throw error;
      }
    } else if (value === undefined && max !== undefined) {
      throw new Error('`value` is undefined but `max` is defined.');
    }
    const args = [min];
    if (value !== undefined) args.push(value);
    if (max !== undefined) args.push(max);
    args.forEach(checkUnquotedString);
    return new SassCalculation('clamp', args);
  }

  assertCalculation(): SassCalculation {
    return this;
  }

  equals(other: Value): boolean {
    return (
      other instanceof SassCalculation &&
      this.name === other.name &&
      this.arguments.equals(other.arguments)
    );
  }

  hashCode(): number {
    return hash(this.name) ^ this.arguments.hashCode();
  }

  toString(): string {
    return `${this.name}(${this.arguments.join(', ')})`;
  }
}

export type CalculationOperator = '+' | '-' | '*' | '/';

export class CalculationOperation implements ValueObject {
  readonly operator: CalculationOperator;
  readonly left: CalculationValue;
  readonly right: CalculationValue;

  constructor(
    operator: CalculationOperator,
    left: CalculationValue,
    right: CalculationValue
  ) {
    this.operator = operator;
    this.left = left;
    this.right = right;
  }

  equals(other: Value): boolean {
    return (
      other instanceof CalculationOperation &&
      this.operator === other.operator &&
      this.left === other.left &&
      this.right === other.right
    );
  }

  hashCode(): number {
    return hash(this.operator) ^ hash(this.left) ^ hash(this.right);
  }
}

export class CalculationInterpolation implements ValueObject {
  readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  equals(other: Value): boolean {
    return (
      other instanceof CalculationInterpolation && this.value === other.value
    );
  }

  hashCode(): number {
    return hash(this.value);
  }
}
