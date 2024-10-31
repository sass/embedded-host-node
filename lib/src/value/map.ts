// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {List, OrderedMap} from 'immutable';

import {Value} from './index';
import {ListSeparator, SassList} from './list';

/** A SassScript map */
export class SassMap extends Value {
  private readonly contentsInternal: OrderedMap<Value, Value>;

  /** Returns a map that contains `contents`. */
  constructor(contents?: OrderedMap<Value, Value>) {
    super();
    this.contentsInternal = contents ?? OrderedMap();
  }

  /** The separator for `this`'s contents as a list. */
  get separator(): ListSeparator {
    return this.contentsInternal.isEmpty() ? null : ',';
  }

  /** `this`'s contents. */
  get contents(): OrderedMap<Value, Value> {
    return this.contentsInternal;
  }

  /**
   * Returns an immutable list of `contents`'s keys and values as two-element
   * `SassList`s.
   */
  get asList(): List<Value> {
    const list = [];
    for (const entry of this.contents.entries()) {
      list.push(new SassList(entry, {separator: ' '}));
    }
    return List(list);
  }

  protected get lengthAsList(): number {
    return this.contentsInternal.size;
  }

  get(indexOrKey: number | Value): Value | undefined {
    if (indexOrKey instanceof Value) {
      return this.contentsInternal.get(indexOrKey);
    } else {
      const entry = this.contentsInternal
        .entrySeq()
        .get(Math.floor(indexOrKey));
      return entry ? new SassList(entry, {separator: ' '}) : undefined;
    }
  }

  assertMap(): SassMap {
    return this;
  }

  tryMap(): SassMap {
    return this;
  }

  equals(other: Value): boolean {
    if (
      other instanceof SassList &&
      this.contents.size === 0 &&
      other.asList.size === 0
    ) {
      return true;
    }

    if (
      !(other instanceof SassMap) ||
      this.contents.size !== other.contents.size
    ) {
      return false;
    }

    for (const [key, value] of this.contents.entries()) {
      const otherValue = other.contents.get(key);
      if (otherValue === undefined || !otherValue.equals(value)) {
        return false;
      }
    }
    return true;
  }

  hashCode(): number {
    return this.contents.isEmpty()
      ? new SassList().hashCode()
      : // SassMaps with the same key-value pairs are considered equal
        // regardless of key-value order, so this hash must be order
        // independent. Since OrderedMap.hashCode() encodes the key-value order,
        // we use a manual XOR accumulator instead.
        this.contents.reduce(
          (accumulator, value, key) =>
            accumulator ^ value.hashCode() ^ key.hashCode(),
          0,
        );
  }

  toString(): string {
    let string = '(';
    string += Array.from(
      this.contents.entries(),
      ([key, value]) => `${key}: ${value}`,
    ).join(', ');
    string += ')';
    return string;
  }
}
