// Copyright 2024 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

export class CanonicalizeContext {
  readonly fromImport: boolean;

  private readonly _containingUrl: URL | null;

  get containingUrl(): URL | null {
    this._containingUrlAccessed = true;
    return this._containingUrl;
  }

  private _containingUrlAccessed = false;

  /**
   * Whether the `containingUrl` getter has been accessed.
   *
   * This is marked as public so that the importer registry can access it, but
   * it's not part of the package's public API and should not be accessed by
   * user code. It may be renamed or removed without warning in the future.
   */
  get containingUrlAccessed(): boolean {
    return this._containingUrlAccessed;
  }

  constructor(containingUrl: URL | null, fromImport: boolean) {
    this._containingUrl = containingUrl;
    this.fromImport = fromImport;
  }
}
