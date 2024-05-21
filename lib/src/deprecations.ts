// Copyright 2024 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {deprecations} from './vendor/deprecations';
import {Deprecation, DeprecationOrId} from './vendor/sass';
import {Version} from './version';

export {deprecations} from './vendor/deprecations';
export {Deprecation, DeprecationOrId, DeprecationStatus} from './vendor/sass';

/**
 * Returns whether the given deprecation was active in the given version.
 */
function isActiveIn(deprecation: Deprecation, version: Version) {
  const deprecatedIn = deprecation.deprecatedIn;
  if (deprecation.status !== 'active' || !deprecatedIn) return false;
  if (version.major > deprecatedIn.major) return true;
  if (version.major < deprecatedIn.major) return false;
  if (version.minor > deprecatedIn.minor) return true;
  if (version.minor < deprecatedIn.minor) return false;
  return version.patch >= deprecatedIn.patch;
}

/**
 * Converts a mixed array of deprecations, IDs, and versions to an array of IDs
 * that's ready to include in a CompileRequest.
 */
export function getDeprecationIds(
  arr: (DeprecationOrId | Version)[]
): string[] {
  return arr.flatMap(item => {
    if (item instanceof Version) {
      return Object.values(deprecations)
        .filter(deprecation => isActiveIn(deprecation, item))
        .map(deprecation => deprecation.id);
    } else if (typeof item === 'string') {
      return item;
    }
    return item.id;
  });
}
