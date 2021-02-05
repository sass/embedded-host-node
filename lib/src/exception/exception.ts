// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {SourceSpan} from './span';

/**
 * An exception thrown by Sass.
 */
export class SassException extends Error {
  /**
   * @param message - The error message.
   * @param formatted - The formatted error message. Includes the message, span,
   *                    and trace.
   * @param [span] - The source span associated with the error.
   * @param [trace] - The trace associated with the error.
   */
  constructor(
    readonly message: string,
    private readonly formatted: string,
    readonly span?: SourceSpan,
    readonly trace?: string
  ) {
    super(message);

    if (trace === '') this.trace = undefined;

    // Inject the entire Sass error into the JS stack trace.
    this.stack = this.stack?.replace(
      new RegExp(`Error: ${message}`),
      this.formatted
    );
  }

  toString() {
    return this.formatted;
  }
}
