import yargs from 'yargs';
import {getDartSassEmbedded, OptionalDependencyName} from './utils';

import * as pkg from '../package.json';

const argv = yargs(process.argv.slice(2))
  .option('package', {
    type: 'string',
    description:
      'Directory name under `npm` directory that contains optional dependencies.',
    demandOption: true,
    choices: Object.keys(pkg.optionalDependencies),
  })
  .parseSync();

(async () => {
  try {
    const packageName = argv.package as OptionalDependencyName;
    const dirName = packageName.split('/')[1];
    await getDartSassEmbedded(`npm/${dirName}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
