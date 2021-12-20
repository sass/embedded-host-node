// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {URL} from 'url';

import * as proto from './vendor/embedded-protocol/embedded_sass_pb';
import {SourceLocation, SourceSpan} from './vendor/sass';
import {compilerError} from './utils';

// Creates a SourceSpan from the given protocol `buffer`. Throws if the buffer
// has invalid fields.
export function deprotofySourceSpan(buffer: proto.SourceSpan): SourceSpan {
  const text = buffer.getText();

  if (buffer.getStart() === undefined) {
    throw compilerError('Expected SourceSpan to have start.');
  }
  const start = deprotofySourceLocation(buffer.getStart()!);

  let end;
  if (buffer.getEnd() === undefined) {
    if (text !== '') {
      throw compilerError('Expected SourceSpan text to be empty.');
    } else {
      end = start;
    }
  } else {
    end = deprotofySourceLocation(buffer.getEnd()!);
    if (end.offset < start.offset) {
      throw compilerError('Expected SourceSpan end to be after start.');
    }
  }

  const url = buffer.getUrl() === '' ? undefined : new URL(buffer.getUrl());

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
function deprotofySourceLocation(
  buffer: proto.SourceSpan.SourceLocation
): SourceLocation {
  return {
    offset: buffer.getOffset(),
    line: buffer.getLine(),
    column: buffer.getColumn(),
  };
}
