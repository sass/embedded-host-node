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

    it('encode percent encoded string like `pathToFileURL`', () => {
      const baseURL = pathToFileURL('').toString();
      for (let i = 0; i < 128; i++) {
        const lowercase = `%${i < 10 ? '0' : ''}${i.toString(16)}`;
        expect(pathToUrlString(lowercase)).toEqual(
          pathToFileURL(lowercase)
            .toString()
            .slice(baseURL.length + 1)
        );
        const uppercase = lowercase.toUpperCase();
        expect(pathToUrlString(uppercase)).toEqual(
          pathToFileURL(uppercase)
            .toString()
            .slice(baseURL.length + 1)
        );
      }
    });
  });
});
