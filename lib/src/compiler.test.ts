// Copyright 2023 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as compilerModule from './compiler';
import {Compiler, initCompiler} from './sync-compiler';
import {AsyncCompiler, initAsyncCompiler} from './async-compiler';

const createDispatcher = jest.spyOn(compilerModule, 'createDispatcher');
function getIdHistory() {
  return createDispatcher.mock.calls.map(([id]) => id);
}

afterEach(() => {
  createDispatcher.mockClear();
});

describe('compiler', () => {
  let compiler: Compiler;
  const importers = [
    {
      canonicalize: () => new URL('foo:bar'),
      load: () => ({
        contents: compiler.compileString('').css,
        syntax: 'scss' as const,
      }),
    },
  ];

  beforeEach(() => {
    compiler = initCompiler();
  });

  afterEach(() => {
    compiler.dispose();
  });

  describe('compilation ID', () => {
    it('resets after callback compilations complete', () => {
      compiler.compileString('@import "foo"', {importers});
      compiler.compileString('');
      expect(getIdHistory()).toEqual([1, 2, 1]);
    });

    it('keeps working after failed compilations', () => {
      expect(() => compiler.compileString('invalid')).toThrow();
      compiler.compileString('@import "foo"', {importers});
      expect(getIdHistory()).toEqual([1, 1, 2]);
    });
  });
});

describe('asyncCompiler', () => {
  let asyncCompiler: AsyncCompiler;

  beforeEach(async () => {
    asyncCompiler = await initAsyncCompiler();
  });

  afterEach(async () => {
    await asyncCompiler.dispose();
  });

  describe('compilation ID', () => {
    it('resets after concurrent compilations complete', async () => {
      await Promise.all(
        Array.from({length: 10}, () => asyncCompiler.compileStringAsync(''))
      );
      await asyncCompiler.compileStringAsync('');
      expect(getIdHistory()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1]);
    });

    it('keeps working after failed compilations', async () => {
      await expect(
        asyncCompiler.compileStringAsync('invalid')
      ).rejects.toThrow();
      await Promise.all([
        asyncCompiler.compileStringAsync(''),
        asyncCompiler.compileStringAsync(''),
      ]);
      expect(getIdHistory()).toEqual([1, 1, 2]);
    });
  });
});
