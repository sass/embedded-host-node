// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as proto from './vendor/embedded_sass_pb';
import {Exception as SassException, SourceSpan} from './vendor/sass';
import {deprotofySourceSpan} from './deprotofy-span';

export class Exception extends Error implements SassException {
  readonly sassMessage: string;
  readonly sassStack: string;
  readonly span: SourceSpan;

  constructor(failure: proto.OutboundMessage_CompileResponse_CompileFailure) {
    super(failure.formatted);

    this.sassMessage = failure.message;
    this.sassStack = failure.stackTrace;
    this.span = deprotofySourceSpan(failure.span!);
  }

  toString(): string {
    return this.message;
  }
}
