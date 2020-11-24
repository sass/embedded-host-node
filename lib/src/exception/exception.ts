// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {SourceSpan} from './span';
import * as proto from '../vendor/embedded_sass_pb';

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

  /**
   * Creates a SassException from the given protocol `buffer`. Throws if the
   * buffer has invalid fields.
   */
  static fromProto(
    buffer: proto.OutboundMessage.CompileResponse.CompileFailure
  ) {
    const span = buffer.getSpan();
    return new SassException(
      buffer.getMessage(),
      span ? SourceSpan.fromProto(span) : undefined,
      buffer.getStackTrace()
    );
  }

  // TODO(awjin): toString()
}
