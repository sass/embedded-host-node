// Copyright 2022 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {OrderedMap} from 'immutable';

import {LegacyValueBase} from './base';
import {LegacyValue} from '../../vendor/sass';
import {SassMap} from '../../value/map';
import {SassNumber} from '../../value/number';
import {Value} from '../../value';
import {sassNull} from '../../value/null';
import {unwrapValue, wrapValue} from './wrap';

export class LegacyMap extends LegacyValueBase<SassMap> {
  constructor(lengthOrInner: number | SassMap) {
    if (lengthOrInner instanceof SassMap) {
      super(lengthOrInner);
      return;
    }

    super(
      new SassMap(
        OrderedMap(
          Array.from({length: lengthOrInner}, (_, i) => [
            new SassNumber(i),
            sassNull,
          ])
        )
      )
    );
  }

  getValue(index: number): LegacyValue {
    const value = this.inner.contents.valueSeq().get(index);
    if (index < 0 || !value) {
      throw new Error(
        `Invalid index ${index}, must be between 0 and ` +
          this.inner.contents.size
      );
    }

    return wrapValue(value);
  }

  setValue(index: number, value: LegacyValue): void {
    this.inner = new SassMap(
      this.inner.contents.set(this.getUnwrappedKey(index), unwrapValue(value))
    );
  }

  getKey(index: number): LegacyValue {
    return wrapValue(this.getUnwrappedKey(index));
  }

  // Like `getKey()`, but returns the unwrapped non-legacy value.
  private getUnwrappedKey(index: number): Value {
    const key = this.inner.contents.keySeq().get(index);
    if (index >= 0 && key) return key;
    throw new Error(
      `Invalid index ${index}, must be between 0 and ` +
        this.inner.contents.size
    );
  }

  setKey(index: number, key: LegacyValue): void {
    const oldMap = this.inner.contents;
    if (index < 0 || index >= oldMap.size) {
      throw new Error(
        `Invalid index ${index}, must be between 0 and ${oldMap.size}`
      );
    }

    const newKey = unwrapValue(key);
    const newMap = OrderedMap<Value, Value>().asMutable();

    let i = 0;
    for (const [oldKey, oldValue] of oldMap.entries()) {
      if (i === index) {
        newMap.set(newKey, oldValue);
      } else {
        if (newKey.equals(oldKey)) {
          throw new Error(`${key} is already in the map`);
        }
        newMap.set(oldKey, oldValue);
      }
      i++;
    }

    this.inner = new SassMap(newMap.asImmutable());
  }

  getLength(): number {
    return this.inner.contents.size;
  }
}

Object.defineProperty(LegacyMap, 'name', {value: 'sass.types.Map'});
