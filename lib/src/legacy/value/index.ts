// Copyright 2022 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {SassBooleanInternal} from '../../value/boolean';
import {SassNull} from '../../value/null';
import {LegacyColor} from './color';
import {LegacyList} from './list';
import {LegacyMap} from './map';
import {LegacyNumber} from './number';

export const Boolean = SassBooleanInternal;
export const Color = LegacyColor;
export const List = LegacyList;
export const Map = LegacyMap;
export const Null = SassNull;
export const Number = LegacyNumber;
