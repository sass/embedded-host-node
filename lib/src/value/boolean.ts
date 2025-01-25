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
  // Whether callers are allowed to construct this class. This is set to
  // `false` once the two constants are constructed so that the constructor
  // throws an error for future calls, in accordance with the legacy API.
  static constructionAllowed = true;

  constructor(private readonly valueInternal: boolean) {
    super();

    if (!SassBooleanInternal.constructionAllowed) {
      throw (
        "new sass.types.Boolean() isn't allowed.\n" +
        'Use sass.types.Boolean.TRUE or sass.types.Boolean.FALSE instead.'
      );
    }

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

  // Legacy API support

  static TRUE: SassBooleanInternal;
  static FALSE: SassBooleanInternal;

  getValue(): boolean {
    return this.value;
  }
}

/** The singleton instance of SassScript true. */
export const sassTrue = new SassBooleanInternal(true);

/** The singleton instance of SassScript false. */
export const sassFalse = new SassBooleanInternal(false);

// Legacy API support
SassBooleanInternal.constructionAllowed = false;

SassBooleanInternal.TRUE = sassTrue;
SassBooleanInternal.FALSE = sassFalse;
