// Copyright 2024 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {DeprecationOrId} from './vendor/sass';
import {Version} from './version';

export {deprecations} from './vendor/deprecations';
export {Deprecation, DeprecationOrId, DeprecationStatus} from './vendor/sass';

/**
 * Converts a mixed array of deprecations, IDs, and versions to an array of IDs
 * that's ready to include in a CompileRequest.
 */
export function getDeprecationIds(
  arr: (DeprecationOrId | Version)[]
): string[] {
  return arr.flatMap(item => {
    if (item instanceof Version) {
      return arr.map(item => item.toString());
    } else if (typeof item === 'string') {
      return item;
    }
    return item.id;
  });
}
