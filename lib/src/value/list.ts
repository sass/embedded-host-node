// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {hash, List, OrderedMap} from 'immutable';

import {Value} from './value';
import {SassMap} from './map';
import {asImmutableList} from '../utils';

export type ListSeparator = ',' | ' ' | null;

/** A SassScript list. */
export class SassList extends Value {
  private readonly contentsInternal: List<Value>;
  private readonly separatorInternal: ListSeparator;
  private readonly hasBracketsInternal: boolean;

  /**
   * Returns a list that contains `contents`, with the given `separator` and
   * `brackets`.
   */
  constructor(
    contents: Value[] | List<Value>,
    options?: {
      /** @default ',' */ separator?: ListSeparator;
      /** @default false */ brackets?: boolean;
    }
  ) {
    super();
    this.contentsInternal = asImmutableList(contents);
    this.separatorInternal = options?.separator ?? ',';
    this.hasBracketsInternal = options?.brackets ?? false;
  }

  /** Returns an empty list with the given `separator` and `brackets`. */
  static empty(options?: {
    /** @default null */ separator?: ListSeparator;
    /** @default false */ brackets?: boolean;
  }) {
    return new SassList([], {
      separator: options?.separator ?? null,
      brackets: options?.brackets,
    });
  }

  /** `this`'s contents. */
  get contents() {
    return this.contentsInternal;
  }

  /** Whether `this` has brackets. */
  get hasBrackets() {
    return this.hasBracketsInternal;
  }

  /** `this`'s contents as an immutable list. */
  get asList(): List<Value> {
    return this.contentsInternal;
  }

  /** `this`'s list separator. */
  get separator(): ListSeparator {
    return this.separatorInternal;
  }

  protected get lengthAsList(): number {
    return this.contents.size;
  }

  assertList(): SassList {
    return this;
  }

  /**
   * If `this` is empty, returns an empty OrderedMap.
   *
   * Otherwise, returns null
   */
  tryMap(): OrderedMap<Value, Value> | null {
    return this.contents.isEmpty() ? OrderedMap<Value, Value>() : null;
  }

  equals(other: Value): boolean {
    if (
      other instanceof SassMap &&
      this.contents.isEmpty() &&
      other.contents.isEmpty()
    ) {
      return true;
    }

    if (
      !(other instanceof SassList) ||
      this.contents.size !== other.contents.size ||
      this.hasBrackets !== other.hasBrackets ||
      this.separator !== other.separator
    ) {
      return false;
    }

    for (let i = 0; i < this.contents.size; i++) {
      const thisValue = this.contents.get(i);
      const otherValue = other.contents.get(i);
      if (
        thisValue === undefined ||
        otherValue === undefined ||
        !thisValue.equals(otherValue)
      ) {
        return false;
      }
    }
    return true;
  }

  hashCode(): number {
    return hash([
      ...this.contents.map(item => item.hashCode()),
      this.hasBrackets,
      this.separator,
    ]);
  }

  toString(): string {
    return 'SassList';
  }
}
