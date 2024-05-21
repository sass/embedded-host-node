// Generates the list of deprecations from spec/deprecations.yaml in the
// language repo.

import * as fs from 'fs';
import {parse} from 'yaml';

interface YamlData {
  [key: string]: {
    description: string;
    'dart-sass': {
      status: 'active' | 'future' | 'obsolete';
      deprecated?: string;
      obsolete?: string;
    };
  };
}

const yamlFile = 'build/sass/spec/deprecations.yaml';

/**
 * Converts a version string in the form X.Y.Z to be code calling the Version
 * constructor, or null if the string is undefined.
 */
function toVersionCode(version: string | undefined): string | null {
  if (!version) return null;
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (match === null) {
    throw new Error(`Invalid version ${version}`);
  }
  return `new Version(${match[1]}, ${match[2]}, ${match[3]})`;
}

/**
 * Generates the list of deprecations based on the YAML file in the language
 * repo.
 */
export async function getDeprecations(outDirectory: string) {
  const yamlText = fs.readFileSync(yamlFile, 'utf8');

  const deprecations = parse(yamlText) as YamlData;
  let tsText =
    "import {Deprecations} from './sass';\n" +
    "import {Version} from '../version';\n\n" +
    'export const deprecations: Deprecations = {\n';
  for (const [id, deprecation] of Object.entries(deprecations)) {
    const key = id.includes('-') ? `'${id}'` : id;
    const dartSass = deprecation['dart-sass'];
    tsText +=
      `  ${key}: {\n` +
      `    id: '${id}',\n` +
      `    description: '${deprecation.description}',\n` +
      `    status: '${dartSass.status}',\n` +
      `    deprecatedIn: ${toVersionCode(dartSass.deprecated)},\n` +
      `    obsoleteIn: ${toVersionCode(dartSass.obsolete)},\n` +
      '  },\n';
  }
  tsText +=
    "  'user-authored': {\n" +
    "    id: 'user-authored',\n" +
    "    status: 'user',\n" +
    '    deprecatedIn: null,\n' +
    '    obsoleteIn: null,\n' +
    '  },\n' +
    '}\n';

  fs.writeFileSync(`${outDirectory}/deprecations.ts`, tsText);
}
