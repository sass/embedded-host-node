// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {hash} from 'immutable';

import {Value} from './index';
import {valueError} from '../utils';

/** A SassScript string. */
export class SassString extends Value {
  private readonly textInternal: string;
  private readonly hasQuotesInternal: boolean;

  /** Creates a string with `text`, optionally with quotes. */
  constructor(text: string, options?: {quotes?: boolean});
  constructor(options?: {quotes?: boolean});
  constructor(
    textOrOptions?: string | {quotes?: boolean},
    options?: {quotes?: boolean}
  ) {
    super();

    if (typeof textOrOptions === 'string') {
      this.textInternal = textOrOptions;
      this.hasQuotesInternal = options?.quotes ?? true;
    } else {
      this.textInternal = '';
      this.hasQuotesInternal = textOrOptions?.quotes ?? true;
    }
  }

  /** Creates an empty string, optionally with quotes. */
  static empty(options?: {/** @default true */ quotes?: boolean}): SassString {
    return options === undefined || options?.quotes
      ? emptyQuoted
      : emptyUnquoted;
  }

  /** `this`'s text. */
  get text(): string {
    return this.textInternal;
  }

  /** Whether `this` has quotes. */
  get hasQuotes(): boolean {
    return this.hasQuotesInternal;
  }

  assertString(): SassString {
    return this;
  }

  /**
   * Sass's notion of `this`'s length.
   *
   * Sass treats strings as a series of Unicode code points while JS treats them
   * as a series of UTF-16 code units. For example, the character U+1F60A,
   * Smiling Face With Smiling Eyes, is a single Unicode code point but is
   * represented in UTF-16 as two code units (`0xD83D` and `0xDE0A`). So in
   * JS, `"n😊b".length` returns `4`, whereas in Sass `string.length("n😊b")`
   * returns `3`.
   */
  get sassLength(): number {
    let length = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const codepoint of this.text) {
      length++;
    }
    return length;
  }

  /**
   * Converts `sassIndex` to a JS index into `text`.
   *
   * Sass indices are one-based, while JS indices are zero-based. Sass
   * indices may also be negative in order to index from the end of the string.
   *
   * In addition, Sass indices refer to Unicode code points while JS string
   * indices refer to UTF-16 code units. For example, the character U+1F60A,
   * Smiling Face With Smiling Eyes, is a single Unicode code point but is
   * represented in UTF-16 as two code units (`0xD83D` and `0xDE0A`). So in
   * JS, `"n😊b".charAt(1)` returns `0xD83D`, whereas in Sass
   * `string.slice("n😊b", 1, 1)` returns `"😊"`.
   *
   * This function converts Sass's code point indices to JS's code unit
   * indices. This means it's O(n) in the length of `text`.
   *
   * Throws an error `sassIndex` isn't a number, if that number isn't an
   * integer, or if that integer isn't a valid index for this string.
   *
   * If `sassIndex` came from a function argument, `name` is the argument name
   * (without the `$`) and is used for error reporting.
   */
  sassIndexToStringIndex(sassIndex: Value, name?: string): number {
    let sassIdx = sassIndex.assertNumber().assertInt();
    if (sassIdx === 0) {
      throw valueError('String index may not be 0', name);
    }

    const sassLength = this.sassLength;
    if (Math.abs(sassIdx) > sassLength) {
      throw valueError(
        `Invalid index ${sassIdx} for a string with ${sassLength} characters`,
        name
      );
    }
    if (sassIdx < 0) sassIdx += sassLength + 1;

    let pointer = 1;
    let idx = 0;
    for (const codePoint of this.text) {
      if (pointer === sassIdx) break;
      idx += codePoint.length;
      pointer++;
    }
    return idx;
  }

  equals(other: Value): boolean {
    return other instanceof SassString && this.text === other.text;
  }

  hashCode(): number {
    return hash(this.text);
  }

  toString(): string {
    if (!this.hasQuotes)
      return this.text.replace(/\0/g, '\uFFFD').replace(/\n */g, ' ');

    // https://drafts.csswg.org/cssom/#serialize-a-string
    let buffer = '"';
    for (const character of this.text) {
      if (character === '\0') {
        // If the character is NULL (U+0000), then the REPLACEMENT CHARACTER
        // (U+FFFD).
        buffer += '\uFFFD';
      } else if (character === '\x22' || character === '\x5C') {
        // If the character is '"' (U+0022) or "\" (U+005C), then the escaped
        // character.
        buffer += '\x5C' + character;
      } else if (character < '\x20' || character === '\x7F') {
        // If the character is in the range [\1-\1f] (U+0001 to U+001F) or is
        // U+007F, then the character escaped as code point.
        //
        // To escape a character as code point means to create a string of "\"
        // (U+005C), followed by the Unicode code point as the smallest possible
        // number of hexadecimal digits in the range 0-9 a-f (U+0030 to U+0039
        // and U+0061 to U+0066) to represent the code point in base 16,
        // followed by a single SPACE (U+0020).
        buffer += '\x5C' + character.codePointAt(0)!.toString(16) + '\x20';
      } else {
        // Otherwise, the character itself.
        buffer += character;
      }
    }
    buffer += '"';
    return buffer;
  }
}

// A quoted empty string returned by `SassString.empty()`.
const emptyQuoted = new SassString('', {quotes: true});

// An unquoted empty string returned by `SassString.empty()`.
const emptyUnquoted = new SassString('', {quotes: false});
