// Copyright 2022 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {LegacyValueBase} from './base';
import {LegacyValue} from '../../vendor/sass';
import {SassList} from '../../value/list';
import {sassNull} from '../../value/null';
import {unwrapValue, wrapValue} from './wrap';

export class LegacyList extends LegacyValueBase<SassList> {
  constructor(length: number, commaSeparator?: boolean);
  constructor(inner: SassList);

  constructor(lengthOrInner: number | SassList, commaSeparator?: boolean) {
    if (lengthOrInner instanceof SassList) {
      super(lengthOrInner);
      return;
    }

    super(
      new SassList(new Array(lengthOrInner).fill(sassNull), {
        separator: commaSeparator === false ? ' ' : ',',
      })
    );
  }

  getValue(index: number): LegacyValue | undefined {
    const length = this.inner.asList.size;
    if (index < 0 || index >= length) {
      throw new Error(
        `Invalid index ${index}, must be between 0 and ${length}`
      );
    }
    const value = this.inner.get(index);
    return value ? wrapValue(value) : undefined;
  }

  setValue(index: number, value: LegacyValue): void {
    this.inner = new SassList(
      this.inner.asList.set(index, unwrapValue(value)),
      {
        separator: this.inner.separator,
        brackets: this.inner.hasBrackets,
      }
    );
  }

  getSeparator(): boolean {
    return this.inner.separator === ',';
  }

  setSeparator(isComma: boolean): void {
    this.inner = new SassList(this.inner.asList, {
      separator: isComma ? ',' : ' ',
      brackets: this.inner.hasBrackets,
    });
  }

  getLength(): number {
    return this.inner.asList.size;
  }
}

Object.defineProperty(LegacyList, 'name', {value: 'sass.types.List'});
