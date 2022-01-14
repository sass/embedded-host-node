// Copyright 2022 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {SassBooleanInternal} from '../../value/boolean';
import {SassNull} from '../../value/null';
import {LegacyColor} from './color';
import {LegacyList} from './list';
import {LegacyMap} from './map';
import {LegacyNumber} from './number';
import {LegacyString} from './string';

export const Boolean = SassBooleanInternal;
export const Color = LegacyColor;
export const List = LegacyList;
export const Map = LegacyMap;
export const Null = SassNull;
export const Number = LegacyNumber;
export const String = LegacyString;

// For the `sass.types.Error` object, we just re-export the native Error class.
export const Error = global.Error;
