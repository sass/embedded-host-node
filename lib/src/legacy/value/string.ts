// Copyright 2022 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {SassString} from '../../value/string';
import {LegacyValueBase} from './base';

export class LegacyString extends LegacyValueBase<SassString> {
  constructor(valueOrInner: string | SassString) {
    if (valueOrInner instanceof SassString) {
      super(valueOrInner);
    } else {
      super(new SassString(valueOrInner, {quotes: false}));
    }
  }

  getValue(): string {
    return this.inner.text;
  }

  setValue(value: string): void {
    this.inner = new SassString(value, {quotes: false});
  }
}

Object.defineProperty(LegacyString, 'name', {value: 'sass.types.String'});
