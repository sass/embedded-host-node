// Copyright 2024 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as api from './vendor/sass';

export class Version implements api.Version {
  constructor(
    readonly major: number,
    readonly minor: number,
    readonly patch: number,
  ) {}
  static parse(version: string): Version {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (match === null) {
      throw new Error(`Invalid version ${version}`);
    }
    return new Version(
      parseInt(match[1]),
      parseInt(match[2]),
      parseInt(match[3]),
    );
  }
  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }
}
