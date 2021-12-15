// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {hash} from 'immutable';

import {Value} from './index';

/**
 * Sass boolean.
 *
 * Cannot be constructed; exists only as an interface and the exported
 * singletons.
 */
export interface SassBoolean extends Value {
  readonly value: boolean;
}

const trueHash = hash(true);
const falseHash = hash(false);

class SassBooleanInternal extends Value implements SassBoolean {
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
    return other instanceof SassBooleanInternal && this.value === other.value;
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
