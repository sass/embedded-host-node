// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {hash} from 'immutable';

import {Value} from './value';

/**
 * Sass boolean.
 *
 * Cannot be constructed; exists only as an interface and the exported
 * singletons.
 */
export interface SassBoolean extends Value {
  value: boolean;
}

const trueHash = hash(true);
const falseHash = hash(true);

class SassBooleanInternal extends Value implements SassBoolean {
  constructor(private readonly _value: boolean) {
    super();
    Object.freeze(this);
  }

  get value(): boolean {
    return this._value;
  }

  get isTruthy(): boolean {
    return this.value;
  }

  assertBoolean(): SassBoolean {
    return this;
  }

  equals(other: Value): boolean {
    return other instanceof SassBooleanInternal && this._value === other._value;
  }

  hashCode(): number {
    return this._value ? trueHash : falseHash;
  }
}

/** The singleton instance of SassScript true. */
export const sassTrue = new SassBooleanInternal(true);

/** The singleton instance of SassScript false. */
export const sassFalse = new SassBooleanInternal(false);
