// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {promises as fs} from 'fs';
import {resolve} from 'path';
import {fileURLToPath} from 'url';

import {compile, compileString} from './compile';
import {expectEqualPaths} from '../../spec/helpers/utils';
import {RawSourceMap, SourceMapConsumer} from 'source-map-js';

describe('compile', () => {
  describe('success', () => {
    describe('input', () => {
      it('compiles an SCSS string by default', async () => {
        expect(await compileString({source: 'a {b: c}'})).toBe(
          'a {\n  b: c;\n}'
        );
      });

      // TODO(awjin): compiles an SCSS string explicitly
      // TODO(awjin): compiles an indented syntax string
      // TODO(awjin): compiles a plain CSS string

      it('compiles an absolute path', async () => {
        const path = resolve('test.scss');
        await fs.writeFile(path, 'a {b: c}');

        expect(await compile({path})).toBe('a {\n  b: c;\n}');
        await fs.unlink(path);
      });

      it('compiles a relative path', async () => {
        const path = 'test.scss';
        await fs.writeFile(path, 'a {b: c}');

        expect(await compile({path})).toBe('a {\n  b: c;\n}');
        await fs.unlink(path);
      });
    });

    describe('output', () => {
      it('outputs in expanded mode by default', async () => {
        expect(await compileString({source: 'a {b: c}'})).toBe(
          'a {\n  b: c;\n}'
        );
      });

      // TODO(awjin): outputs in expanded mode explicitly
      // TODO(awjin): outputs in compressed mode
      // TODO(awjin): outputs in expanded mode when nested mode is passed
      // TODO(awjin): outputs in expanded mode when compact mode is passed
    });

    describe('sourcemap', () => {
      it('includes a source map', async () => {
        let rawSourceMap: RawSourceMap;
        await compileString({
          source: 'a {b: c}',
          sourceMap: map => (rawSourceMap = map),
        });
        const sourceMap = await new SourceMapConsumer(rawSourceMap!);
        sourceMap.computeColumnSpans();
        const originalPosition = sourceMap.originalPositionFor({
          line: 2,
          column: 2,
        });

        expect(originalPosition.line).toBe(1);
        expect(originalPosition.column).toBe(3);
      });
    });
  });

  describe('failure', () => {
    describe('input', () => {
      it('fails on invalid syntax', async () => {
        try {
          await compileString({source: 'a {'});
        } catch (error) {
          expect(error.message).toBe('expected "}".');
          expect(error.span).toEqual({
            text: '',
            start: {
              offset: 3,
              line: 0,
              column: 3,
            },
            end: {
              offset: 3,
              line: 0,
              column: 3,
            },
            url: undefined,
            context: 'a {',
          });
          expect(error.trace).toBe('- 1:4  root stylesheet\n');
        }
      });

      it('fails on runtime error', async () => {
        try {
          await compileString({source: 'a {b: 1px + 1em}'});
        } catch (error) {
          expect(error.message).toBe('1px and 1em have incompatible units.');
          expect(error.span).toEqual({
            text: '1px + 1em',
            start: {
              offset: 6,
              line: 0,
              column: 6,
            },
            end: {
              offset: 15,
              line: 0,
              column: 15,
            },
            url: undefined,
            context: 'a {b: 1px + 1em}',
          });
          expect(error.trace).toBe('- 1:7  root stylesheet\n');
        }
      });

      it('fails on missing file', async () => {
        try {
          await compile({path: 'test.scss'});
        } catch (error) {
          const message = error.message.split(': ');
          expect(message[0]).toBe('Cannot open file');
          expectEqualPaths(message[1], resolve('test.scss'));
          expect(error.span).toBe(undefined);
          expect(error.trace).toBe(undefined);
        }
      });

      // TODO(awjin): fails on Sass features in CSS
    });

    describe('output', () => {
      it('emits a nicely formatted message', async () => {
        try {
          await compileString({source: 'a {b: 1px + 1em}'});
        } catch (error) {
          expect(error.toString())
            .toBe(`Error: 1px and 1em have incompatible units.
  ╷
1 │ a {b: 1px + 1em}
  │       ^^^^^^^^^
  ╵
  - 1:7  root stylesheet`);
        }
      });

      it('emits multi-line source span', async () => {
        const source = `a {
  b: 1px +
     1em;
}`;
        try {
          await compileString({source});
        } catch (error) {
          expect(error.message).toBe('1px and 1em have incompatible units.');
          expect(error.span).toEqual({
            text: '1px +\n     1em',
            start: {
              offset: 9,
              line: 1,
              column: 5,
            },
            end: {
              offset: 23,
              line: 2,
              column: 8,
            },
            url: undefined,
            context: '  b: 1px +\n     1em;\n',
          });
          expect(error.trace).toBe('- 2:6  root stylesheet\n');
          expect(error.toString())
            .toBe(`Error: 1px and 1em have incompatible units.
  ╷
2 │     b: 1px +
  │ ┌──────^
3 │ │      1em;
  │ └────────^
  ╵
  - 2:6  root stylesheet`);
        }
      });

      it('emits multiple stack trace entries', async () => {
        const source = `@function fail() {
  @return 1px + 1em;
}

a {
  b: fail();
}`;
        try {
          await compileString({source});
        } catch (error) {
          expect(error.trace).toBe('- 2:11  fail()\n- 6:6   root stylesheet\n');
        }
      });

      it('displays URL of string input', async () => {
        const url = 'foo://bar/baz';
        try {
          await compileString({
            source: 'a {b: 1px + 1em}',
            url,
          });
        } catch (error) {
          expect(error.span.url).toBe(url);
          expect(error.trace).toBe(`${url} 1:7  root stylesheet\n`);
        }
      });

      it('displays URL of path input', async () => {
        const path = 'test.scss';
        await fs.writeFile(path, 'a {b: 1px + 1em}');
        try {
          await compile({
            path,
          });
        } catch (error) {
          expectEqualPaths(fileURLToPath(error.span.url), resolve(path));
          expect(error.trace).toBe(`${path} 1:7  root stylesheet\n`);
        } finally {
          await fs.unlink(path);
        }
      });
    });
  });

  // TODO(awjin): logging tests
});
