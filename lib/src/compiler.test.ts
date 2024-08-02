// Copyright 2024 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';
import {chdir} from 'process';
import {AsyncCompiler, initAsyncCompiler} from './compiler/async';
import * as compilerModule from './compiler/utils';
import {Compiler, initCompiler} from './compiler/sync';

const createDispatcher = jest.spyOn(compilerModule, 'createDispatcher');
function getIdHistory(): number[] {
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

  it('calls functions independently', () => {
    const [logger1, logger2] = [jest.fn(), jest.fn()];
    compiler.compileString('@debug ""', {logger: {debug: logger1}});
    compiler.compileString('@debug ""', {logger: {debug: logger2}});
    expect(logger1).toHaveBeenCalledTimes(1);
    expect(logger2).toHaveBeenCalledTimes(1);
  });

  it('handles the removal of the working directory', () => {
    const oldDir = fs.mkdtempSync('sass-spec-');
    chdir(oldDir);
    const tmpCompiler = initCompiler();
    chdir('..');
    fs.rmSync(oldDir, {recursive: true});
    fs.writeFileSync('foo.scss', 'a {b: c}');
    expect(() => tmpCompiler.compile('foo.scss')).not.toThrow();
    tmpCompiler.dispose();
    fs.rmSync('foo.scss');
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

  it('handles the removal of the working directory', async () => {
    const oldDir = fs.mkdtempSync('sass-spec-');
    chdir(oldDir);
    const tmpCompiler = await initAsyncCompiler();
    chdir('..');
    fs.rmSync(oldDir, {recursive: true});
    fs.writeFileSync('foo.scss', 'a {b: c}');
    await expect(tmpCompiler.compileAsync('foo.scss')).resolves.not.toThrow();
    await tmpCompiler.dispose();
    fs.rmSync('foo.scss');
  });

  it('calls functions independently', async () => {
    const [logger1, logger2] = [jest.fn(), jest.fn()];
    await asyncCompiler.compileStringAsync('@debug ""', {
      logger: {debug: logger1},
    });
    await asyncCompiler.compileStringAsync('@debug ""', {
      logger: {debug: logger2},
    });
    expect(logger1).toHaveBeenCalledTimes(1);
    expect(logger2).toHaveBeenCalledTimes(1);
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
