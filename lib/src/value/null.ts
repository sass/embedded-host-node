// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {hash} from 'immutable';

import {Value} from './index';

const hashCode = hash(null);

// SassScript null. Cannot be constructed; exists only as the exported
// singleton.
export class SassNull extends Value {
  // Whether callers are allowed to construct this class. This is set to
  // `false` once the two constants are constructed so that the constructor
  // throws an error for future calls, in accordance with the legacy API.
  static constructionAllowed = true;

  constructor() {
    super();

    if (!SassNull.constructionAllowed) {
      throw (
        "new sass.types.Null() isn't allowed.\n" +
        'Use sass.types.Null.NULL instead.'
      );
    }

    Object.freeze(this);
  }

  get isTruthy(): boolean {
    return false;
  }

  get realNull(): null {
    return null;
  }

  equals(other: Value): boolean {
    return this === other;
  }

  hashCode(): number {
    return hashCode;
  }

  toString(): string {
    return 'sassNull';
  }

  // Legacy API support
  static NULL: SassNull;
}

/** The singleton instance of SassScript null. */
export const sassNull = new SassNull();

// Legacy API support
SassNull.constructionAllowed = false;

SassNull.NULL = sassNull;
