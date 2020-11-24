// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {compilerError} from '../utils';
import * as proto from '../vendor/embedded_sass_pb';

/**
 * A single point in a source file.
 */
export class SourceLocation {
  /**
   * @param offset - 0-based offset of this location within the source file.
   * @param line - 0-based line number of this location within the source file.
   * @param column - 0-based column number of this location within its line.
   */
  constructor(
    readonly offset: number,
    readonly line: number,
    readonly column: number
  ) {}

  /**
   * Creates a SourceLocation from the given protocol `buffer`. Throws if the
   * buffer has invalid fields.
   */
  static fromProto(buffer: proto.SourceSpan.SourceLocation) {
    try {
      return new SourceLocation(
        buffer.getOffset(),
        buffer.getLine(),
        buffer.getColumn()
      );
    } catch (error) {
      throw compilerError(error.message);
    }
  }
}
