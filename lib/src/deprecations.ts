// Copyright 2024 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as api from './vendor/sass';

export {Deprecation, DeprecationOrId, DeprecationStatus} from './vendor/sass';

export class Version implements api.Version {
  constructor(
    readonly major: number,
    readonly minor: number,
    readonly patch: number
  ) {}
  static parse(version: string): Version {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (match === null) {
      throw new Error(`Invalid version ${version}`);
    }
    return new Version(
      parseInt(match[1]),
      parseInt(match[2]),
      parseInt(match[3])
    );
  }
}

/**
 * Returns whether the given deprecation was active in the given version.
 */
function isActiveIn(deprecation: api.Deprecation, version: Version) {
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
export function getDeprecationIds(arr: (api.DeprecationOrId|Version)[]): string[] {
  return arr.flatMap((item) => {
    if (item instanceof Version) {
      return Object.values(deprecations).filter((deprecation) => isActiveIn(deprecation, item)).map((deprecation) => deprecation.id);
    } else if (typeof item === "string") {
      return item;
    }
    return item.id;
  });
}

export const deprecations : typeof api.deprecations = {
  'call-string': {
    id: 'call-string',
    status: 'active',
    deprecatedIn: new Version(0, 0, 0),
    obsoleteIn: null,
    description: 'Passing a string directly to meta.call().',
  },
  elseif: {
    id: 'elseif',
    status: 'active',
    deprecatedIn: new Version(1, 3, 2),
    obsoleteIn: null,
    description: '@elseif.',
  },
  'moz-document': {
    id: 'moz-document',
    status: 'active',
    deprecatedIn: new Version(1, 7, 2),
    obsoleteIn: null,
    description: '@-moz-document.',
  },
  'relative-canonical': {
    id: 'relative-canonical',
    status: 'active',
    deprecatedIn: new Version(1, 14, 2),
    obsoleteIn: null,
  },
  'new-global': {
    id: 'new-global',
    status: 'active',
    deprecatedIn: new Version(1, 17, 2),
    obsoleteIn: null,
    description: 'Declaring new variables with !global.',
  },
  'color-module-compat': {
    id: 'color-module-compat',
    status: 'active',
    deprecatedIn: new Version(1, 23, 0),
    obsoleteIn: null,
    description:
      'Using color module functions in place of plain CSS functions.',
  },
  'slash-div': {
    id: 'slash-div',
    status: 'active',
    deprecatedIn: new Version(1, 33, 0),
    obsoleteIn: null,
    description: '/ operator for division.',
  },
  'bogus-combinators': {
    id: 'bogus-combinators',
    status: 'active',
    deprecatedIn: new Version(1, 54, 0),
    obsoleteIn: null,
    description: 'Leading, trailing, and repeated combinators.',
  },
  'strict-unary': {
    id: 'strict-unary',
    status: 'active',
    deprecatedIn: new Version(1, 55, 0),
    obsoleteIn: null,
    description: 'Ambiguous + and - operators.',
  },
  'function-units': {
    id: 'function-units',
    status: 'active',
    deprecatedIn: new Version(1, 56, 0),
    obsoleteIn: null,
    description: 'Passing invalid units to built-in functions.',
  },
  'duplicate-var-flags': {
    id: 'duplicate-var-flags',
    status: 'active',
    deprecatedIn: new Version(1, 62, 0),
    obsoleteIn: null,
    description: 'Using !default or !global multiple times for one variable.',
  },
  'null-alpha': {
    id: 'null-alpha',
    status: 'active',
    deprecatedIn: new Version(1, 62, 3),
    obsoleteIn: null,
    description: 'Passing null as alpha in the JS API.',
  },
  'abs-percent': {
    id: 'abs-percent',
    status: 'active',
    deprecatedIn: new Version(1, 65, 0),
    obsoleteIn: null,
    description: 'Passing percentages to the Sass abs() function.',
  },
  import: {
    id: 'import',
    status: 'future',
    deprecatedIn: null,
    obsoleteIn: null,
    description: '@import rules.',
  },
  'user-authored': {
    id: 'user-authored',
    status: 'user',
    deprecatedIn: null,
    obsoleteIn: null,
  },
};
