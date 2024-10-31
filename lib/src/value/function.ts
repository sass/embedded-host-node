// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {hash} from 'immutable';

import {CustomFunction} from '../vendor/sass';
import {Value} from './index';

/** A first-class SassScript function. */
export class SassFunction extends Value {
  /**
   * If this function is defined in the compiler, this is the unique ID that the
   * compiler uses to determine which function it refers to.
   *
   * This is marked as public so that the protofier can access it, but it's not
   * part of the package's public API and should not be accessed by user code.
   * It may be renamed or removed without warning in the future.
   */
  readonly id: number | undefined;

  /**
   * If this function is defined in the host, this is the signature that
   * describes how to pass arguments to it.
   *
   * This is marked as public so that the protofier can access it, but it's not
   * part of the package's public API and should not be accessed by user code.
   * It may be renamed or removed without warning in the future.
   */
  readonly signature: string | undefined;

  /**
   * If this function is defined in the host, this is the callback to run when
   * the function is invoked from a stylesheet.
   *
   * This is marked as public so that the protofier can access it, but it's not
   * part of the package's public API and should not be accessed by user code.
   * It may be renamed or removed without warning in the future.
   */
  readonly callback: CustomFunction<'sync'> | undefined;

  constructor(id: number);
  constructor(signature: string, callback: CustomFunction<'sync'>);
  constructor(
    idOrSignature: number | string,
    callback?: CustomFunction<'sync'>,
  ) {
    super();

    if (typeof idOrSignature === 'number') {
      this.id = idOrSignature;
    } else {
      this.signature = idOrSignature;
      this.callback = callback!;
    }
  }

  equals(other: Value): boolean {
    return this.id === undefined
      ? other === this
      : other instanceof SassFunction && other.id === this.id;
  }

  hashCode(): number {
    return this.id === undefined ? hash(this.signature) : hash(this.id);
  }

  toString(): string {
    return this.signature ? this.signature : `<compiler function ${this.id}>`;
  }
}
