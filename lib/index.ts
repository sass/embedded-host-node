// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as pkg from '../package.json';
import {sassFalse, sassTrue} from './src/value/boolean';
import {sassNull} from './src/value/null';

export {ListSeparator, SassList} from './src/value/list';
export {SassArgumentList} from './src/value/argument-list';
export {sassFalse, sassTrue} from './src/value/boolean';
export {SassColor} from './src/value/color';
export {SassFunction} from './src/value/function';
export {SassMap} from './src/value/map';
export {SassMixin} from './src/value/mixin';
export {SassNumber} from './src/value/number';
export {SassString} from './src/value/string';
export {Value} from './src/value';
export {sassNull} from './src/value/null';
export {
  CalculationOperation,
  CalculationOperator,
  CalculationInterpolation,
  SassCalculation,
} from './src/value/calculations';

export * as types from './src/legacy/value';
export {Exception} from './src/exception';
export {
  compile,
  compileString,
  compileAsync,
  compileStringAsync,
  NodePackageImporter,
} from './src/compile';
export {render, renderSync} from './src/legacy';

export const info = `sass-embedded\t${pkg.version}`;

export const Logger = {
  silent: {warn() {}, debug() {}},
};

// Legacy JS API

export const TRUE = sassTrue;
export const FALSE = sassFalse;
export const NULL = sassNull;
