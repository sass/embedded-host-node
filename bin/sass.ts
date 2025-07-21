#!/usr/bin/env node

import * as child_process from 'child_process';
import * as path from 'path';
import {compilerCommand} from '../lib/src/compiler-path';

// TODO npm/cmd-shim#152 and yarnpkg/berry#6422 - If and when the package
// managers support it, we should make this a proper shell script rather than a
// JS wrapper.

try {
  child_process.execFileSync(
    compilerCommand[0],
    [...compilerCommand.slice(1), ...process.argv.slice(2)],
    {
      // Node blocks launching .bat and .cmd without a shell due to CVE-2024-27980
      shell: ['.bat', '.cmd'].includes(
        path.extname(compilerCommand[0]).toLowerCase(),
      ),
      stdio: 'inherit',
      windowsHide: true,
    },
  );
} catch (error) {
  if (error.code) {
    throw error;
  } else {
    process.exitCode = error.status;
  }
}
