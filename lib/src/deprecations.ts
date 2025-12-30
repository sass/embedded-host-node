// Copyright 2024 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Deprecation, DeprecationOrId, Options} from './vendor/sass';
import {Version} from './version';

export {deprecations} from './vendor/deprecations';
export {Deprecation, DeprecationOrId, DeprecationStatus} from './vendor/sass';

/**
 * Converts a mixed array of deprecations, IDs, and versions to an array of IDs
 * that's ready to include in a CompileRequest.
 */
export function getDeprecationIds(
  arr: (DeprecationOrId | Version)[],
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
 * Map between active compilations and the deprecation options they use.
 *
 * This is used to determine which options to use when handling host-side
 * deprecation warnings that aren't explicitly tied to a particular compilation.
 */
export const activeDeprecationOptions: Map<Symbol, DeprecationOptions> =
  new Map();

/**
 * Shorthand for the subset of options related to deprecations.
 */
export type DeprecationOptions = Pick<
  Options<'sync'>,
  'fatalDeprecations' | 'futureDeprecations' | 'silenceDeprecations'
>;

/**
 * Handles a host-side deprecation warning, either emitting a warning, throwing
 * an error, or doing nothing depending on the deprecation options used.
 *
 * If no specific deprecation options are passed here, then options will be
 * determined based on the options of the active compilations.
 */
export function warnForHostSideDeprecation(
  message: string,
  deprecation: Deprecation,
  options?: DeprecationOptions,
): void {
  if (
    deprecation.status === 'future' &&
    !isEnabledFuture(deprecation, options)
  ) {
    return;
  }
  const fullMessage = `Deprecation [${deprecation.id}]: ${message}`;
  if (isFatal(deprecation, options)) {
    throw Error(fullMessage);
  }
  if (!isSilent(deprecation, options)) {
    console.warn(fullMessage);
  }
}

/**
 * Checks whether the given deprecation is included in the given list of silent
 * deprecations or is silenced by at least one active compilation.
 */
function isSilent(
  deprecation: Deprecation,
  options?: DeprecationOptions,
): boolean {
  if (!options) {
    for (const potentialOptions of activeDeprecationOptions.values()) {
      if (isSilent(deprecation, potentialOptions)) return true;
    }
    return false;
  }
  return getDeprecationIds(options.silenceDeprecations ?? []).includes(
    deprecation.id,
  );
}

/**
 * Checks whether the given deprecation is included in the given list of future
 * deprecations that should be enabled or is enabled in all active compilations.
 */
function isEnabledFuture(
  deprecation: Deprecation,
  options?: DeprecationOptions,
): boolean {
  if (!options) {
    for (const potentialOptions of activeDeprecationOptions.values()) {
      if (!isEnabledFuture(deprecation, potentialOptions)) return false;
    }
    return activeDeprecationOptions.size > 0;
  }
  return getDeprecationIds(options.futureDeprecations ?? []).includes(
    deprecation.id,
  );
}

/**
 * Checks whether the given deprecation is included in the given list of
 * fatal deprecations or is marked as fatal in all active compilations.
 */
function isFatal(
  deprecation: Deprecation,
  options?: DeprecationOptions,
): boolean {
  if (!options) {
    for (const potentialOptions of activeDeprecationOptions.values()) {
      if (!isFatal(deprecation, potentialOptions)) return false;
    }
    return activeDeprecationOptions.size > 0;
  }
  const versionNumber =
    deprecation.deprecatedIn === null
      ? null
      : deprecation.deprecatedIn.major * 1000000 +
        deprecation.deprecatedIn.minor * 1000 +
        deprecation.deprecatedIn.patch;
  for (const fatal of options.fatalDeprecations ?? []) {
    if (fatal instanceof Version) {
      if (versionNumber === null) continue;
      if (deprecation.obsoleteIn !== null) continue;
      if (
        versionNumber <=
        fatal.major * 1000000 + fatal.minor * 1000 + fatal.patch
      ) {
        return true;
      }
    } else if (typeof fatal === 'string') {
      if (fatal === deprecation.id) return true;
    } else {
      if ((fatal as Deprecation).id === deprecation.id) return true;
    }
  }
  return false;
}
