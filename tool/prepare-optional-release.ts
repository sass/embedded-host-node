import {getDartSassEmbedded} from './utils';

(async () => {
  try {
    const dirName = `${process.env.npm_config_platform}-${process.env.npm_config_arch}`;
    await getDartSassEmbedded(`npm/${dirName}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
