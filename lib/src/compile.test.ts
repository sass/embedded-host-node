// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {promises as fs} from 'fs';
import {resolve} from 'path';
import {fileURLToPath, URL} from 'url';

import {InboundMessage} from './vendor/embedded_sass_pb';
import {newCompileRequest, newCompileStringRequest, compile} from './compile';
import {
  expectEqualPaths,
  getCompileFailure,
  getCompileSuccess,
  getSourceMap,
  sourceLocation,
  sourceSpan,
} from '../../spec/helpers/utils';

describe('compile', () => {
  it('throws an error upon protocol error', async () => {
    const request = new InboundMessage.CompileRequest();

    await expectAsync(compile(request)).toBeRejectedWithError(
      'Compiler reported error: Missing mandatory field CompileRequest.input.'
    );
  });

  describe('success', () => {
    describe('input', () => {
      it('compiles an SCSS string by default', async () => {
        const request = newCompileStringRequest({source: 'a {b: c}'});
        const success = getCompileSuccess(await compile(request));

        expect(success.getCss()).toBe('a {\n  b: c;\n}');
      });

      // TODO(awjin): compiles an SCSS string explicitly
      // TODO(awjin): compiles an indented syntax string
      // TODO(awjin): compiles a plain CSS string

      it('compiles an absolute path', async () => {
        const path = `${resolve('test.scss')}`;
        await fs.writeFile(path, 'a {b: c}');
        const request = newCompileRequest({path});
        const success = getCompileSuccess(await compile(request));

        expect(success.getCss()).toBe('a {\n  b: c;\n}');
        await fs.unlink(path);
      });

      it('compiles a relative path', async () => {
        const path = 'test.scss';
        await fs.writeFile(path, 'a {b: c}');
        const request = newCompileRequest({path});
        const success = getCompileSuccess(await compile(request));

        expect(success.getCss()).toBe('a {\n  b: c;\n}');
        await fs.unlink(path);
      });
    });

    describe('output', () => {
      it('outputs in expanded mode by default', async () => {
        const request = newCompileStringRequest({source: 'a {b: c}'});
        const success = getCompileSuccess(await compile(request));

        expect(success.getCss()).toBe('a {\n  b: c;\n}');
      });

      // TODO(awjin): outputs in expanded mode explicitly
      // TODO(awjin): outputs in compressed mode
      // TODO(awjin): outputs in expanded mode when nested mode is passed
      // TODO(awjin): outputs in expanded mode when compact mode is passed
    });

    describe('sourcemap', () => {
      it("doesn't include a source map by default", async () => {
        const request = newCompileStringRequest({source: 'a {b: c}'});
        const success = getCompileSuccess(await compile(request));

        expect(success.getSourceMap()).toBe('');
      });

      it("doesn't include a source map explicitly", async () => {
        const request = newCompileStringRequest({
          source: 'a {b: c}',
          sourceMap: false,
        });
        const success = getCompileSuccess(await compile(request));

        expect(success.getSourceMap()).toBe('');
      });

      it('includes a source map', async () => {
        const request = newCompileStringRequest({
          source: 'a {b: c}',
          sourceMap: true,
        });
        const sourceMap = await getSourceMap(await compile(request));
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
        const request = newCompileStringRequest({source: 'a {'});
        const failure = getCompileFailure(await compile(request));

        expect(failure.getMessage()).toBe('expected "}".');
        expect(failure.getSpan()).toEqual(
          sourceSpan({
            text: '',
            start: sourceLocation(3, 0, 3),
            end: sourceLocation(3, 0, 3),
            url: '',
            context: 'a {',
          })
        );
        expect(failure.getStackTrace()).toBe('- 1:4  root stylesheet\n');
      });

      it('fails on runtime error', async () => {
        const request = newCompileStringRequest({source: 'a {b: 1px + 1em}'});
        const failure = getCompileFailure(await compile(request));

        expect(failure.getMessage()).toBe('Incompatible units em and px.');
        expect(failure.getSpan()).toEqual(
          sourceSpan({
            text: '1px + 1em',
            start: sourceLocation(6, 0, 6),
            end: sourceLocation(15, 0, 15),
            url: '',
            context: 'a {b: 1px + 1em}',
          })
        );
        expect(failure.getStackTrace()).toBe('- 1:7  root stylesheet\n');
      });

      it('fails on missing file', async () => {
        const request = newCompileRequest({path: 'test.scss'});
        const failure = getCompileFailure(await compile(request));

        const message = failure.getMessage().split(': ');
        expect(message[0]).toBe('Cannot open file');
        expectEqualPaths(message[1], `${resolve('test.scss')}`);
        expect(failure.getStackTrace()).toBe('');
      });

      // TODO(awjin): fails on Sass features in CSS
    });

    describe('output', () => {
      it('emits multi-line source span', async () => {
        const source = `a {
  b: 1px +
     1em;
}`;
        const request = newCompileStringRequest({source});
        const failure = getCompileFailure(await compile(request));

        expect(failure.getMessage()).toBe('Incompatible units em and px.');
        expect(failure.getSpan()).toEqual(
          sourceSpan({
            text: '1px +\n     1em',
            start: sourceLocation(9, 1, 5),
            end: sourceLocation(23, 2, 8),
            url: '',
            context: '  b: 1px +\n     1em;\n',
          })
        );
        expect(failure.getStackTrace()).toBe('- 2:6  root stylesheet\n');
      });

      it('emits multiple stack trace entries', async () => {
        const source = `@function fail() {
  @return 1px + 1em;
}

a {
  b: fail();
}`;
        const request = newCompileStringRequest({source});
        const failure = getCompileFailure(await compile(request));

        expect(failure.getStackTrace()).toBe(
          '- 2:11  fail()\n- 6:6   root stylesheet\n'
        );
      });

      it('displays URL of string input', async () => {
        const request = newCompileStringRequest({
          source: 'a {b: 1px + 1em}',
          url: new URL('foo://bar/baz'),
        });
        const failure = getCompileFailure(await compile(request));

        expect(failure.getSpan()?.getUrl()).toBe('foo://bar/baz');
        expect(failure.getStackTrace()).toBe(
          'foo://bar/baz 1:7  root stylesheet\n'
        );
      });

      it('displays URL of path input', async () => {
        const path = 'test.scss';
        await fs.writeFile(path, 'a {b: 1px + 1em}');
        const request = newCompileRequest({path});
        const failure = getCompileFailure(await compile(request));

        expectEqualPaths(
          fileURLToPath(failure.getSpan()!.getUrl()),
          resolve(path)
        );
        expect(failure.getStackTrace()).toBe(`${path} 1:7  root stylesheet\n`);
        await fs.unlink('test.scss');
      });
    });
  });

  // TODO(awjin): logging tests
});
