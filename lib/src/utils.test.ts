import {pathToFileURL} from 'url';
import {pathToUrlString} from './utils';

describe('utils', () => {
  describe('pathToUrlString', () => {
    it('encode relative path like `pathToFileURL`', () => {
      const baseURL = pathToFileURL('').toString();
      for (let i = 0; i < 128; i++) {
        const char = String.fromCharCode(i);
        const filename = `${i}-${char}`;
        expect(pathToUrlString(filename)).toEqual(
          pathToFileURL(filename)
            .toString()
            .slice(baseURL.length + 1)
        );
      }
    });
  });
});
