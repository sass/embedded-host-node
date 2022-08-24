import yargs from 'yargs';
import {
  getDartSassEmbedded,
  nodePlatformToDartPlatform,
  nodeArchToDartArch,
} from './utils';

import * as pkg from '../package.json';

const argv = yargs(process.argv.slice(2))
  .option('package', {
    type: 'string',
    description:
      'Directory name under `npm` directory that contains optional dependencies.',
    demandOption: true,
    choices: Object.keys(pkg.optionalDependencies).map(
      name => name.split('sass-embedded-')[1]
    ),
  })
  .parseSync();

(async () => {
  try {
    const [platform, arch] = argv.package.split('-');
    await getDartSassEmbedded(
      `npm/${argv.package}`,
      nodePlatformToDartPlatform(platform),
      nodeArchToDartArch(arch)
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
