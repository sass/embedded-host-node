// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {URL} from 'url';

import {SourceLocation} from './location';
import {compilerError} from '../utils';
import * as proto from '../vendor/embedded_sass_pb';

/**
 * A chunk of a source file.
 */
export class SourceSpan {
  /**
   * @param text - The text covered by the span, between `start.offset` and
   * `end.offset` in the source file referred to by `url`.
   *
   * @param start - The location of the first character in the span.
   *
   * @param [end] - The location of the first character after the span. If
   * omitted, indicates that the span is empty and points immediately before
   * `start`.
   *
   * @param [url] - The URL of the file to which this span refers. If omitted,
   * indicates that the span refers to a string that doesn't specify a URL.
   *
   * @param [context] - Additional source text surrounding the span. Usually
   * contains the full lines the span begins and ends on if the span itself
   * doesn't cover the full lines.
   */
  constructor(
    readonly text: string,
    readonly start: SourceLocation,
    readonly end?: SourceLocation,
    readonly url?: URL,
    readonly context = ''
  ) {
    if (end === undefined && text !== '') {
      throw Error('Expected SourceSpan text to be empty.');
    }
    if (end !== undefined && end.offset <= start.offset) {
      throw Error('Expected SourceSpan end to be after start.');
    }
  }

  /**
   * Creates a SourceSpan from the given protocol `buffer`. Throws if the buffer
   * has invalid fields.
   */
  static fromProto(buffer: proto.SourceSpan): SourceSpan {
    try {
      const start = buffer.getStart();
      if (start === undefined) {
        throw Error('Expected SourceSpan to have start.');
      }
      const end = buffer.getEnd();
      const url = buffer.getUrl();

      return new SourceSpan(
        buffer.getText(),
        SourceLocation.fromProto(start),
        end ? SourceLocation.fromProto(end) : undefined,
        url !== '' ? new URL(url) : undefined,
        buffer.getContext()
      );
    } catch (error) {
      throw compilerError(error.message);
    }
  }
}
