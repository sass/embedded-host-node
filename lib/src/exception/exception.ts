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
   * @param [span] - The source span associated with the error.
   * @param [stack] - The stack trace associated with the error.
   */
  constructor(message?: string, readonly span?: SourceSpan, stack?: string) {
    super(message);

    this.name = this.constructor.name;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // TODO(awjin): toString()
}
