// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {hash} from 'immutable';

import {Value} from './index';

/** A first-class SassScript mixin. */
export class SassMixin extends Value {
  /**
   * If this mixin is defined in the compiler, this is the unique ID that the
   * compiler uses to determine which mixin it refers to.
   *
   * This is marked as public so that the protofier can access it, but it's not
   * part of the package's public API and should not be accessed by user code.
   * It may be renamed or removed without warning in the future.
   */
  readonly id: number | undefined;

  constructor(id: number) {
    super();
    this.id = id;
  }

  equals(other: Value): boolean {
    return this.id === undefined
      ? other === this
      : other instanceof SassMixin && other.id === this.id;
  }

  hashCode(): number {
    return hash(this.id);
  }

  toString(): string {
    return `<compiler mixin ${this.id}>`;
  }

  assertMixin(): SassMixin {
    return this;
  }
}
