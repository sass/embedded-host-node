// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {List, hash, isList} from 'immutable';

import {Value} from './index';
import {SassMap} from './map';
import {asImmutableList, valueError} from '../utils';

/** The types of separator that a SassList can have. */
export type ListSeparator = ',' | '/' | ' ' | null;

// All empty SassList and SassMaps should have the same hashcode, so this caches
// the value.
const emptyListHashCode = hash([]);

/** The options that are passed to the constructor. */
interface ConstructorOptions {
  separator?: ListSeparator;
  brackets?: boolean;
}

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
      separator?: ListSeparator;
      brackets?: boolean;
    }
  );
  constructor(options?: ConstructorOptions);
  constructor(
    contentsOrOptions?: Value[] | List<Value> | ConstructorOptions,
    options?: ConstructorOptions
  ) {
    super();

    if (isList(contentsOrOptions) || Array.isArray(contentsOrOptions)) {
      this.contentsInternal = asImmutableList(contentsOrOptions);
    } else {
      this.contentsInternal = List();
      options = contentsOrOptions;
    }

    if (this.contentsInternal.size > 1 && options?.separator === null) {
      throw Error(
        'Non-null separator required for SassList with more than one element.'
      );
    }
    this.separatorInternal =
      options?.separator === undefined ? ',' : options.separator;
    this.hasBracketsInternal = options?.brackets ?? false;
  }

  get asList(): List<Value> {
    return this.contentsInternal;
  }

  /** Whether `this` has brackets. */
  get hasBrackets(): boolean {
    return this.hasBracketsInternal;
  }

  /** `this`'s list separator. */
  get separator(): ListSeparator {
    return this.separatorInternal;
  }

  protected get lengthAsList(): number {
    return this.contentsInternal.size;
  }

  get(index: number): Value | undefined {
    return this.contentsInternal.get(index);
  }

  assertList(): SassList {
    return this;
  }

  assertMap(name?: string): SassMap {
    if (this.contentsInternal.isEmpty()) return new SassMap();
    throw valueError(`${this} is not a map`, name);
  }

  /**
   * If `this` is empty, returns an empty OrderedMap.
   *
   * Otherwise, returns null.
   */
  tryMap(): SassMap | null {
    return this.contentsInternal.isEmpty() ? new SassMap() : null;
  }

  equals(other: Value): boolean {
    if (
      (other instanceof SassList || other instanceof SassMap) &&
      this.contentsInternal.isEmpty() &&
      other.asList.isEmpty()
    ) {
      return true;
    }

    if (
      !(other instanceof SassList) ||
      this.hasBrackets !== other.hasBrackets ||
      this.separator !== other.separator
    ) {
      return false;
    }

    return this.contentsInternal.equals(other.asList);
  }

  hashCode(): number {
    return this.contentsInternal.isEmpty()
      ? emptyListHashCode
      : this.contentsInternal.hashCode() ^
          hash(this.hasBrackets) ^
          hash(this.separator);
  }

  toString(): string {
    let string = '';
    if (this.hasBrackets) string += '[';
    string += `${this.contentsInternal.join(
      this.separator === ' ' || this.separator === null
        ? ' '
        : `${this.separator} `
    )}`;
    if (this.hasBrackets) string += ']';
    return string;
  }
}
