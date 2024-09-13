// Copyright 2024 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Deprecation, DeprecationOrId} from './vendor/sass';
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
  return arr.map(item => {
    if (item instanceof Version) {
      return item.toString();
    } else if (typeof item === 'string') {
      return item;
    }
    return item.id;
  });
}

/**
 * Shorthand for the subset of options related to deprecations.
 */
export type DeprecationOptions = {
  fatalDeprecations?: (DeprecationOrId | Version)[];
  futureDeprecations?: DeprecationOrId[];
  silenceDeprecations?: DeprecationOrId[];
};

/**
 * Handles a host-side deprecation warning, either emitting a warning, throwing
 * and error, or doing nothing depending on the deprecation options used.
 */
export function warnForHostSideDeprecation(
  message: string,
  deprecation: Deprecation,
  options?: DeprecationOptions
): void {
  if (
    deprecation.status === 'future' &&
    !getDeprecationIds(options?.futureDeprecations ?? []).includes(
      deprecation.id
    )
  ) {
    return;
  }
  const fullMessage = `Deprecation [${deprecation.id}]: ${message}`;
  if (isFatal(deprecation, options)) {
    throw Error(fullMessage);
  }
  if (
    !getDeprecationIds(options?.silenceDeprecations ?? []).includes(
      deprecation.id
    )
  ) {
    console.warn(fullMessage);
  }
}

/**
 * Checks whether the given deprecation is included in the given list of
 * fatal deprecations.
 */
function isFatal(
  deprecation: Deprecation,
  options?: DeprecationOptions
): boolean {
  const versionNumber =
    deprecation.deprecatedIn === null
      ? null
      : deprecation.deprecatedIn.major * 1000000 +
        deprecation.deprecatedIn.minor * 1000 +
        deprecation.deprecatedIn.patch;
  for (const fatal of options?.fatalDeprecations ?? []) {
    if (fatal instanceof Version) {
      if (versionNumber === null) continue;
      if (
        versionNumber <=
        fatal.major * 1000000 + fatal.minor * 1000 + fatal.patch
      ) {
        return true;
      }
    } else if (typeof fatal === 'string') {
      if (fatal === deprecation.id) return true;
    } else {
      if (fatal.id === deprecation.id) return true;
    }
  }
  return false;
}
