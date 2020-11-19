// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {URL} from 'url';

import {SourceLocation} from './location';

export interface SourceSpan {
  text: string;
  start: SourceLocation;
  end?: SourceLocation;
  url?: URL;
  context: string;
}
