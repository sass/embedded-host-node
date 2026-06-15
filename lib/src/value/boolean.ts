// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {hash} from 'immutable';

import {Value} from './index';

/**
 * Sass boolean.
 *
 * This is an abstract class that cannot be directly instantiated. Instead,
 * use the provided {@link sassTrue} and {@link sassFalse} singleton instances.
 */
export abstract class SassBoolean extends Value {
  abstract readonly value: boolean;
}

const trueHash = hash(true);
const falseHash = hash(false);

export class SassBooleanInternal extends SassBoolean {
  constructor(private readonly valueInternal: boolean) {
    super();
    Object.freeze(this);
  }

  get value(): boolean {
    return this.valueInternal;
  }

  get isTruthy(): boolean {
    return this.value;
  }

  assertBoolean(): SassBoolean {
    return this;
  }

  equals(other: Value): boolean {
    return this === other;
  }

  hashCode(): number {
    return this.value ? trueHash : falseHash;
  }

  toString(): string {
    return this.value ? 'sassTrue' : 'sassFalse';
  }
}

/** The singleton instance of SassScript true. */
export const sassTrue = new SassBooleanInternal(true);

/** The singleton instance of SassScript false. */
export const sassFalse = new SassBooleanInternal(false);
