// Copyright 2024 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {deprecations} from './vendor/deprecations';
import {
  Deprecation,
  DeprecationOrId,
  DeprecationSelector,
  DeprecationSelectorDifference,
  Deprecations,
  Options,
} from './vendor/sass';
import {Version, compareVersions} from './version';

export {deprecations} from './vendor/deprecations';
export {Deprecation, DeprecationOrId, DeprecationStatus} from './vendor/sass';

/**
 * A normalized representation of a {@link DeprecationSelector} which can easily
 * be passed to a compile request or checked for a given deprecation.
 */
interface NormalizedDeprecationSelector {
  /** Sass implementation versions selected by this selector. */
  versions?: Version[];

  /** Deprecation IDs selected by this selector. */
  include?: Set<keyof Deprecations>;

  /** Deprecation IDs excluded by this selector. */
  exclude?: Set<keyof Deprecations>;
}

Object.defineProperty(deprecations, 'dartSass2', {
  value: {
    include: Version.parse('1.105.0'),
    exclude: ['color-module-compat', 'import', 'global-builtin', 'if-function'],
  },
  enumerable: false,
  writable: false,
});

/**
 * Normalized a {@link DeprecationSelector} to a form that's easier to include
 * in a CompileRequest.
 */
export function normalizeDeprecationSelector(
  selector: DeprecationSelector,
): NormalizedDeprecationSelector {
  if (Array.isArray(selector)) {
    const result: NormalizedDeprecationSelector = {
      versions: [],
      include: new Set(),
      exclude: new Set(),
    };
    for (const element of selector) {
      const normalized = normalizeDeprecationSelector(element);
      if (normalized.versions) result.versions!.push(...normalized.versions);
      for (const id of normalized.include ?? []) {
        result.include!.add(id);
        result.exclude!.delete(id);
      }
      for (const id of normalized.exclude ?? []) {
        result.exclude!.add(id);
      }
    }
    return result;
  }

  if (selector instanceof Version) {
    return {versions: [selector]};
  } else if (typeof selector === 'string') {
    return {include: new Set([selector])};
  } else if ('id' in selector) {
    return {include: new Set([selector.id])};
  } else {
    const difference = selector as DeprecationSelectorDifference;
    const result = normalizeDeprecationSelector(difference.include);
    result.exclude ??= new Set();
    for (const id of getDeprecationIds(difference.exclude)) {
      result.exclude.add(id);
    }
    return result;
  }
}

/**
 * Converts a mixed array of deprecations, IDs, and versions to an array of IDs
 * that's ready to include in a CompileRequest.
 */
export function getDeprecationIds(
  arr: DeprecationOrId | DeprecationOrId[],
): (keyof Deprecations)[] {
  if (!Array.isArray(arr)) arr = [arr];
  return arr.map(item => (typeof item === 'string' ? item : item.id));
}

/**
 * Map between active compilations and the deprecation options they use.
 *
 * This is used to determine which options to use when handling host-side
 * deprecation warnings that aren't explicitly tied to a particular compilation.
 */
export const activeDeprecationOptions: Map<symbol, DeprecationOptions> =
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

  const fatalDeprecations = normalizeDeprecationSelector(
    options.fatalDeprecations ?? [],
  );
  if (deprecation.deprecatedIn && !deprecation.obsoleteIn) {
    for (const version of fatalDeprecations.versions ?? []) {
      if (compareVersions(deprecation.deprecatedIn, version) <= 0) return true;
    }
  }

  return !!(
    fatalDeprecations.include?.has(deprecation.id) &&
    !fatalDeprecations.exclude?.has(deprecation.id)
  );
}
