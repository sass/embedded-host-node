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

function assertCalculationValue(value: CalculationValue): void {
  if (value instanceof SassString && value.hasQuotes) {
    throw new Error(`Expected ${value} to be an unquoted string.`);
  }
}

const isValidClampArg = (value: CalculationValue): boolean =>
  value instanceof CalculationInterpolation ||
  (value instanceof SassString && !value.hasQuotes);

/* A SassScript calculation */
export class SassCalculation extends Value {
  readonly arguments: List<CalculationValue>;

  private constructor(
    readonly name: string,
    args: CalculationValueIterable
  ) {
    super();
    this.arguments = List(args);
  }

  static calc(argument: CalculationValue): SassCalculation {
    assertCalculationValue(argument);
    return new SassCalculation('calc', [argument]);
  }

  static min(args: CalculationValueIterable): SassCalculation {
    args.forEach(assertCalculationValue);
    return new SassCalculation('min', args);
  }

  static max(args: CalculationValueIterable): SassCalculation {
    args.forEach(assertCalculationValue);
    return new SassCalculation('max', args);
  }

  static clamp(
    min: CalculationValue,
    value?: CalculationValue,
    max?: CalculationValue
  ): SassCalculation {
    if (
      (value === undefined && !isValidClampArg(min)) ||
      (max === undefined && ![min, value].some(x => x && isValidClampArg(x)))
    ) {
      throw new Error(
        'Argument must be an unquoted SassString or CalculationInterpolation.'
      );
    }
    const args = [min];
    if (value !== undefined) args.push(value);
    if (max !== undefined) args.push(max);
    args.forEach(assertCalculationValue);
    return new SassCalculation('clamp', args);
  }

  assertCalculation(): SassCalculation {
    return this;
  }

  equals(other: unknown): boolean {
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

const operators = ['+', '-', '*', '/'] as const;
export type CalculationOperator = (typeof operators)[number];

export class CalculationOperation implements ValueObject {
  constructor(
    readonly operator: CalculationOperator,
    readonly left: CalculationValue,
    readonly right: CalculationValue
  ) {
    if (!operators.includes(operator)) {
      throw new Error(`Invalid operator: ${operator}`);
    }
    assertCalculationValue(left);
    assertCalculationValue(right);
  }

  equals(other: unknown): boolean {
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
  constructor(readonly value: string) {}

  equals(other: unknown): boolean {
    return (
      other instanceof CalculationInterpolation && this.value === other.value
    );
  }

  hashCode(): number {
    return hash(this.value);
  }
}
