// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {URL} from 'url';

import * as proto from './vendor/embedded_sass_pb';
import {SourceLocation} from './exception/location';
import {SourceSpan} from './exception/span';

export type PromiseOr<T> = T | Promise<T>;

export function deprotifySourceSpan(span: proto.SourceSpan): SourceSpan {
  return {
    text: span.getText(),
    start: deprotifySourceLocation(span.getStart()!),
    end: span.getEnd() ? deprotifySourceLocation(span.getEnd()!) : undefined,
    url: span.getUrl() !== '' ? new URL(span.getUrl()) : undefined,
    context: span.getContext(),
  };
}

export function deprotifySourceLocation(
  location: proto.SourceSpan.SourceLocation
): SourceLocation {
  return {
    offset: location.getOffset(),
    line: location.getLine(),
    column: location.getColumn(),
  };
}
