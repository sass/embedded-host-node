// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {URL} from 'url';

import * as proto from './vendor/embedded_sass_pb';
import {SourceSpan} from './vendor/sass';
import {compilerError} from './utils';

// Creates a SourceSpan from the given protocol `buffer`. Throws if the buffer
// has invalid fields.
export function deprotofySourceSpan(buffer: proto.SourceSpan): SourceSpan {
  const text = buffer.text;

  if (buffer.start === undefined) {
    throw compilerError('Expected SourceSpan to have start.');
  }

  let end;
  if (buffer.end === undefined) {
    if (text !== '') {
      throw compilerError('Expected SourceSpan text to be empty.');
    } else {
      end = buffer.start;
    }
  } else {
    end = buffer.end;
    if (end.offset < buffer.start.offset) {
      throw compilerError('Expected SourceSpan end to be after start.');
    }
  }

  const url = buffer.url === '' ? undefined : new URL(buffer.url);

  const context = buffer.context === '' ? undefined : buffer.context;

  return {
    text,
    start: buffer.start,
    end,
    url,
    context,
  };
}
