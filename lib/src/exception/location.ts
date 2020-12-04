// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

/**
 * A single point in a source file.
 */
export interface SourceLocation {
  /** 0-based offset of this location within the source file. */
  readonly offset: number;

  /** 0-based line number of this location within the source file. */
  readonly line: number;

  /** 0-based column number of this location within its line. */
  readonly column: number;
}
