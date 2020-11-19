// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {SourceSpan} from './span';

export class SassException extends Error {
  span?: SourceSpan;

  constructor(options: {message: string; span?: SourceSpan; stack?: string}) {
    super(options.message);

    this.name = this.constructor.name;

    this.span = options.span;

    if (options.stack) {
      this.stack = options.stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
