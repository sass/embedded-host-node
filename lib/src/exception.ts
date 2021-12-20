// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as proto from './vendor/embedded-protocol/embedded_sass_pb';
import {Exception as SassException, SourceSpan} from './vendor/sass';
import {deprotofySourceSpan} from './deprotofy-span';

export class Exception extends Error implements SassException {
  readonly sassMessage: string;
  readonly sassStack: string;
  readonly span: SourceSpan;

  constructor(failure: proto.OutboundMessage.CompileResponse.CompileFailure) {
    super(failure.getFormatted());

    this.sassMessage = failure.getMessage();
    this.sassStack = failure.getStackTrace();
    this.span = deprotofySourceSpan(failure.getSpan()!);
  }

  toString() {
    return this.message;
  }
}
