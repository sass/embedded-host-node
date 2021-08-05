// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {hash} from 'immutable';

import {Value} from './value';

// SassScript null. Cannot be constructed; exists only as the exported
// singleton.
class SassNull extends Value {
  private readonly _hashCode = hash(null);

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
    return this._hashCode;
  }
}

/** The singleton instance of SassScript null. */
export const sassNull = new SassNull();
Object.freeze(sassNull);
