import {getDartSassEmbedded} from './utils';

(async () => {
  try {
    await getDartSassEmbedded('./');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
