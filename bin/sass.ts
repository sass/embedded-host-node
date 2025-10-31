#!/usr/bin/env node

import * as child_process from 'child_process';
import * as path from 'path';

import {compilerCommand} from '../lib/src/compiler-path';

// TODO npm/cmd-shim#152 and yarnpkg/berry#6422 - If and when the package
// managers support it, we should make this a proper shell script rather than a
// JS wrapper.

try {
  let command = compilerCommand[0];
  let args = [...compilerCommand.slice(1), ...process.argv.slice(2)];
  const options: child_process.ExecFileSyncOptions = {
    stdio: 'inherit',
    windowsHide: true,
  };

  // Node forbids launching .bat and .cmd without a shell due to CVE-2024-27980,
  // and DEP0190 forbids passing an argument list *with* shell: true. To work
  // around this, we have to manually concatenate the arguments.
  if (['.bat', '.cmd'].includes(path.extname(command).toLowerCase())) {
    command = `${command} ${args.join(' ')}`;
    args = [];
    options.shell = true;
  }

  child_process.execFileSync(command, args, options);
} catch (error) {
  if (error.code) {
    throw error;
  } else {
    process.exitCode = error.status;
  }
}
