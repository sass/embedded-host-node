// Copyright 2026 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {hash} from 'immutable';

import {Value} from './index';

/** A first-class SassScript module. */
export class SassModule extends Value {
  /**
   * This is the unique ID that the compiler uses to determine which module it
   * refers to.
   *
   * This is marked as public so that the protofier can access it, but it's not
   * part of the package's public API and should not be accessed by user code.
   * It may be renamed or removed without warning in the future.
   */
  readonly id: number;

  /**
   * This is the unique context that the host uses to determine which
   * compilation this module belongs to.
   *
   * This is marked as public so that the protofier can access it, but it's not
   * part of the package's public API and should not be accessed by user code.
   * It may be renamed or removed without warning in the future.
   */
  readonly compileContext: symbol;

  constructor(id: number, compileContext: symbol) {
    super();
    this.id = id;
    this.compileContext = compileContext;
  }

  equals(other: Value): boolean {
    return (
      other instanceof SassModule &&
      other.compileContext === this.compileContext &&
      other.id === this.id
    );
  }

  hashCode(): number {
    return hash(this.id);
  }

  toString(): string {
    return `<compiler module ${this.id}>`;
  }

  assertModule(): SassModule {
    return this;
  }
}
