// Workaround https://github.com/color-js/color.js/issues/707

import * as fs from 'fs';

export function fixColorJsTypes(): void {
  const file = 'node_modules/colorjs.io/package.json';
  const pkg = JSON.parse(fs.readFileSync(file, {encoding: 'utf8'}));
  if (
    pkg.types === undefined &&
    fs.existsSync('node_modules/colorjs.io/types')
  ) {
    console.log(`Patching '${file}'.`);
    pkg.types = './types';
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2));
  }
}
