// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {URL} from 'url';

import {SourceLocation} from './location';

/**
 * A chunk of a source file.
 */
export interface SourceSpan {
  /**
   * The text covered by the span, between `start.offset` and `end.offset` in
   * the source file referred to by `url`.
   */
  readonly text: string;

  /** The location of the first character in the span. */
  readonly start: SourceLocation;

  /**
   * The location of the first character after the span. If omitted, indicates
   * that the span is empty and points immediately before `start`.
   */
  readonly end?: SourceLocation;

  /**
   * The URL of the file to which this span refers. If omitted, indicates that
   * the span refers to a string that doesn't specify a URL.
   */
  readonly url?: URL;

  /**
   * Additional source text surrounding the span. Usually contains the full
   * lines the span begins and ends on if the span itself doesn't cover the full
   * lines.
   */
  readonly context?: string;
}
