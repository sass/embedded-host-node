// Copyright 2022 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Value} from '../../value';

/**
 * A base class for legacy value types. A shared base class makes it easier to
 * detect legacy values and extract their inner value objects.
 */
export class LegacyValueBase<T extends Value> {
  inner: T;

  constructor(inner: T) {
    this.inner = inner;
  }
}
