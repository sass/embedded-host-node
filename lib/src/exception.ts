// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as proto from './vendor/embedded-protocol/embedded_sass_pb';
import {SourceSpan} from './vendor/sass';
import {deprotofySourceSpan} from './deprotofy-span';

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

    if (formatted === '') this.formatted = `Error: ${message}`;
    if (trace === '') this.trace = undefined;

    // Inject the entire Sass error into the JS stack trace.
    this.stack = this.stack?.replace(
      new RegExp(`^Error: ${message}`),
      this.formatted
    );
  }

  toString() {
    return this.formatted;
  }
}

/**
 * Creates a SassException from the given protocol `buffer`. Throws if the
 * buffer has invalid fields.
 */
export function deprotofyException(
  buffer: proto.OutboundMessage.CompileResponse.CompileFailure
): SassException {
  const span = buffer.getSpan();

  return new SassException(
    buffer.getMessage(),
    buffer.getFormatted(),
    span ? deprotofySourceSpan(span) : undefined,
    buffer.getStackTrace()
  );
}
