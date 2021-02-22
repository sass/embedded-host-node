// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {SassException} from './exception/exception';
import {SourceLocation} from './exception/location';
import {SourceSpan} from './exception/span';
import * as proto from './vendor/embedded-protocol/embedded_sass_pb';

export type PromiseOr<T> = T | Promise<T>;

/** Checks for null or undefined. */
export function isNullOrUndefined<T>(object: T): boolean {
  return object === null || object === undefined;
}

/** Constructs a compiler-caused Error. */
export function compilerError(message: string): Error {
  return Error(`Compiler caused error: ${message}.`);
}

/** Constructs a host-caused Error. */
export function hostError(message: string): Error {
  return Error(`Compiler reported error: ${message}.`);
}

/**
 * Creates a SassException from the given protocol `buffer`. Throws if the
 * buffer has invalid fields.
 */
export function deprotifyException(
  buffer: proto.OutboundMessage.CompileResponse.CompileFailure
): SassException {
  const span = buffer.getSpan();

  return new SassException(
    buffer.getMessage(),
    buffer.getFormatted(),
    span ? deprotifySourceSpan(span) : undefined,
    buffer.getStackTrace()
  );
}

// Creates a SourceSpan from the given protocol `buffer`. Throws if the buffer
// has invalid fields.
function deprotifySourceSpan(buffer: proto.SourceSpan): SourceSpan {
  const text = buffer.getText();

  if (buffer.getStart() === undefined) {
    throw compilerError('Expected SourceSpan to have start.');
  }
  const start = deprotifySourceLocation(buffer.getStart()!);

  let end;
  if (buffer.getEnd() === undefined) {
    if (text !== '') {
      throw compilerError('Expected SourceSpan text to be empty.');
    }
  } else {
    end = deprotifySourceLocation(buffer.getEnd()!);
    if (end.offset < start.offset) {
      throw compilerError('Expected SourceSpan end to be after start.');
    }
  }

  const url = buffer.getUrl() === '' ? undefined : buffer.getUrl();

  const context = buffer.getContext() === '' ? undefined : buffer.getContext();

  return {
    text,
    start,
    end,
    url,
    context,
  };
}

// Creates a SourceLocation from the given protocol `buffer`.
function deprotifySourceLocation(
  buffer: proto.SourceSpan.SourceLocation
): SourceLocation {
  return {
    offset: buffer.getOffset(),
    line: buffer.getLine(),
    column: buffer.getColumn(),
  };
}
