// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as pkg from '../package.json';

export {Value} from './src/value/value';
export {SassBoolean, sassFalse, sassTrue} from './src/value/boolean';
export {SassColor} from './src/value/color';
export {ListSeparator, SassList} from './src/value/list';
export {SassMap} from './src/value/map';
export {sassNull} from './src/value/null';
export {SassNumber} from './src/value/number';
export {SassString} from './src/value/string';

export {
  render,
  RenderOptions,
  RenderResult,
  RenderError,
} from './src/node-sass/render';

export const info = `sass-embedded\t${pkg.version}`;
