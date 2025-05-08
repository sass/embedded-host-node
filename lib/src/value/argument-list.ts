// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {List, OrderedMap, isOrderedMap} from 'immutable';

import {ListSeparator, SassList} from './list';
import {Value} from './index';

export class SassArgumentList extends SassList {
  /**
   * The `FunctionCallRequest`-scoped ID of this argument list, used to tell the
   * compiler which argument lists have had their keywords accessed during a
   * function call.
   *
   * The special undefined indicates an argument list constructed in the host.
   *
   * This is marked as public so that the protofier can access it, but it's not
   * part of the package's public API and should not be accessed by user code.
   * It may be renamed or removed without warning in the future.
   */
  readonly id: number | undefined;

  /**
   * If this argument list is constructed in the compiler, this is the unique
   * context that the host uses to determine which compilation this argument
   * list belongs to.
   *
   * This is marked as public so that the protofier can access it, but it's not
   * part of the package's public API and should not be accessed by user code.
   * It may be renamed or removed without warning in the future.
   */
  readonly compileContext: symbol | undefined;

  /**
   * The argument list's keywords. This isn't exposed directly so that we can
   * set `keywordsAccessed` when the user reads it.
   *
   * This is marked as public so that the protofier can access it, but it's not
   * part of the package's public API and should not be accessed by user code.
   * It may be renamed or removed without warning in the future.
   */
  readonly keywordsInternal: OrderedMap<string, Value>;

  private _keywordsAccessed = false;

  /**
   * Whether the `keywords` getter has been accessed.
   *
   * This is marked as public so that the protofier can access it, but it's not
   * part of the package's public API and should not be accessed by user code.
   * It may be renamed or removed without warning in the future.
   */
  get keywordsAccessed(): boolean {
    return this._keywordsAccessed;
  }

  get keywords(): OrderedMap<string, Value> {
    this._keywordsAccessed = true;
    return this.keywordsInternal;
  }

  constructor(
    contents: Value[] | List<Value>,
    keywords: Record<string, Value> | OrderedMap<string, Value>,
    separator?: ListSeparator,
    id?: number,
    compileContext?: symbol,
  ) {
    super(contents, {separator});
    this.keywordsInternal = isOrderedMap(keywords)
      ? keywords
      : OrderedMap(keywords);
    this.id = id;
    this.compileContext = compileContext;
  }
}
