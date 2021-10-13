// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {promises as fs} from 'fs';
import * as p from 'path';
import {RawSourceMap} from 'source-map';
import {pathToFileURL} from 'url';

import * as sandbox from '../../../spec/helpers/sandbox';
import {expectEqualIgnoringWhitespace} from '../../../spec/helpers/utils';
import {compileString} from '../compile';
import {render, RenderError, RenderOptions, RenderResult} from './render';

describe('render', () => {
  function expectRenderResult(
    renderOptions: RenderOptions,
    runExpectations: (result: RenderResult) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      render(renderOptions, (error, result) => {
        if (error || result === undefined) {
          reject('Expected successful render');
          return;
        }
        runExpectations(result);
        resolve();
      });
    });
  }

  function expectRenderError(
    renderOptions: RenderOptions,
    runExpectations: (error: RenderError) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      render(renderOptions, error => {
        if (error === undefined) {
          reject('Expected render error');
          return;
        }
        runExpectations(error);
        resolve();
      });
    });
  }

  describe('input', () => {
    it('renders a file from an absolute path', async () => {
      await sandbox.run(async () => {
        await fs.writeFile('test.scss', 'a {b: c}');

        await expectRenderResult({file: p.resolve('test.scss')}, result => {
          expectEqualIgnoringWhitespace(result.css.toString(), 'a {b: c;}');
        });
      });
    });

    it('renders a file from a relative path', async () => {
      await sandbox.run(async () => {
        await fs.writeFile('test.scss', 'a {b: c}');

        await expectRenderResult({file: 'test.scss'}, result => {
          expectEqualIgnoringWhitespace(result.css.toString(), 'a {b: c;}');
        });
      });
    });

    it('renders a string', done => {
      render({data: 'a {b: c}'}, (_, result) => {
        expectEqualIgnoringWhitespace(result!.css.toString(), 'a {b: c;}');
        done();
      });
    });

    it('enforces that one of data and file must be set', done => {
      render({file: ''}, error => {
        expect(error!.message).toBe(
          'Either options.data or options.file must be set.'
        );
        done();
      });
    });

    describe('both data and file', () => {
      it('uses the data parameter as the source', async () => {
        await sandbox.run(async () => {
          await fs.writeFile('test.scss', 'a {b: c}');

          await expectRenderResult(
            {data: 'x {y: z}', file: 'test.scss'},
            result => {
              expectEqualIgnoringWhitespace(result.css.toString(), 'x {y: z;}');
            }
          );
        });
      });

      it("doesn't require the file path to exist", done => {
        render(
          {data: 'a {b: c}', file: p.resolve('non-existent.scss')},
          (_, result) => {
            expectEqualIgnoringWhitespace(result!.css.toString(), 'a {b: c;}');
            done();
          }
        );
      });

      it('imports relative to the file path', async () => {
        await sandbox.run(async () => {
          await fs.mkdir('subdir');
          await fs.writeFile(p.join('subdir', 'importee.scss'), 'a {b: c}');

          await expectRenderResult(
            {
              data: '@import "importee"',
              file: p.join('subdir', 'test.scss'),
            },
            result => {
              expectEqualIgnoringWhitespace(result.css.toString(), 'a {b: c;}');
            }
          );
        });
      });

      it('reports errors from the file path', done => {
        render({data: 'x {y: }', file: 'test.scss'}, error => {
          expect(error!.toString()).toBe(
            `Error: Expected expression.
  ╷
1 │ x {y: }
  │       ^
  ╵
  test.scss 1:7  root stylesheet`
          );
          done();
        });
      });
    });
  });

  describe('imports', () => {
    it('supports relative imports for a file', async () => {
      await sandbox.run(async () => {
        const importerPath = 'importer.scss';
        await fs.writeFile(importerPath, '@import "test"');
        await fs.writeFile('test.scss', 'a {b: c}');

        await expectRenderResult({file: importerPath}, result => {
          expectEqualIgnoringWhitespace(result.css.toString(), 'a {b: c;}');
        });
      });
    });

    it('supports relative imports for a file from a relative path', async () => {
      await sandbox.run(async () => {
        await fs.mkdir('subdir');
        const importerPath = p.join('subdir', 'importer.scss');
        await fs.writeFile(importerPath, '@import "../test"');
        await fs.writeFile('test.scss', 'a {b: c}');

        await expectRenderResult({file: importerPath}, result => {
          expectEqualIgnoringWhitespace(result.css.toString(), 'a {b: c;}');
        });
      });
    });

    it('supports absolute path imports', async () => {
      await sandbox.run(async () => {
        await fs.writeFile('test.scss', 'a {b: c}');

        await expectRenderResult(
          {data: `@import "${pathToFileURL(p.resolve('test.scss'))}"`},
          result => {
            expectEqualIgnoringWhitespace(result.css.toString(), 'a {b: c;}');
          }
        );
      });
    });

    it('supports import only files', async () => {
      await sandbox.run(async () => {
        await fs.writeFile('foo.scss', 'a {b: regular}');
        await fs.writeFile('foo.import.scss', 'a {b: import-only}');

        await expectRenderResult({data: '@import "foo"'}, result => {
          expectEqualIgnoringWhitespace(
            result.css.toString(),
            'a {b: import-only;}'
          );
        });
      });
    });

    it('supports mixed @use and @import', async () => {
      await sandbox.run(async () => {
        await fs.writeFile('foo.scss', 'a {b: regular}');
        await fs.writeFile('foo.import.scss', 'a {b: import-only}');

        await expectRenderResult(
          {
            data: '@use "foo"; @import "foo";',
          },
          result => {
            expectEqualIgnoringWhitespace(
              result.css.toString(),
              'a {b: regular;} a {b: import-only;}'
            );
          }
        );
      });
    });

    // TODO(awjin): Support reading env vars from the Jest process.
    it.skip('supports SASS_PATH', async () => {
      await sandbox.run(
        async () => {
          await fs.mkdir('dir1');
          await fs.mkdir('dir2');
          await fs.writeFile('dir1/test1.scss', 'a {b: c}');
          await fs.writeFile('dir2/test2.scss', 'x {y: z}');

          await expectRenderResult(
            {data: "@import 'test1'; @import 'test2';"},
            result => {
              expectEqualIgnoringWhitespace(
                result.css.toString(),
                'a {b: c;} x {y: z;}'
              );
            }
          );
        },
        {sassPathDirs: ['dir1', 'dir2']}
      );
    });
  });

  describe('output', () => {
    it('has expanded output style by default', async () => {
      await sandbox.run(async () => {
        await fs.writeFile('test.scss', 'a {b: c}');

        await expectRenderResult({file: 'test.scss'}, result => {
          expect(result.css.toString()).toBe('a {\n  b: c;\n}');
        });
      });
    });

    it('includes the filename', async () => {
      await sandbox.run(async () => {
        await fs.writeFile('test.scss', 'a {b: c}');

        await expectRenderResult({file: 'test.scss'}, result => {
          expect(result.stats.entry).toBe('test.scss');
        });
      });
    });

    it('includes data without a filename', done => {
      render({data: 'a {b: c}'}, (_, result) => {
        expect(result!.stats.entry).toBe('data');
        done();
      });
    });

    it('includes timing information', done => {
      render({data: 'a {b: c}'}, (_, result) => {
        const start = result!.stats.start;
        const end = result!.stats.end;
        expect(start).toBeLessThanOrEqual(end);
        expect(result!.stats.duration).toBe(end - start);
        done();
      });
    });
  });

  describe('source maps', () => {
    // Gets the source map from within a RenderResult.
    function getSourceMap(result?: RenderResult): RawSourceMap {
      if (result === undefined) throw Error('Expected render result.');
      if (result.map === undefined)
        throw Error('Expected render result to contain a sourceMap.');
      return JSON.parse(result.map.toString());
    }

    describe('basic invocation', () => {
      const outFile = 'out.css';
      let expectedMap: RawSourceMap;
      let map: RawSourceMap;
      let css: string;

      beforeAll(async () => {
        const data = 'a {b: c}';

        await compileString({
          source: data,
          sourceMap: map => {
            expectedMap = map;
          },
        });

        await new Promise<void>(resolve => {
          render(
            {
              data,
              sourceMap: true,
              outFile,
            },
            (_, result) => {
              css = result!.css.toString();
              map = getSourceMap(result);
              resolve();
            }
          );
        });
      });

      it('includes correct mappings', () => {
        expect(map.mappings).toEqual(expectedMap!.mappings);
      });

      it('includes the name of the output file', () => {
        expect(map.file).toBe(outFile);
      });

      it('includes stdin as a source', () => {
        expect(map.sources).toEqual(['stdin']);
      });

      it('includes a source map comment', () => {
        expect(css.endsWith(`\n\n/*# sourceMappingURL=${outFile}.map */`)).toBe(
          true
        );
      });
    });

    describe('sources list', () => {
      it('contains a relative path to an input file', async () => {
        await sandbox.run(async () => {
          await fs.writeFile('test.scss', 'a {b: c}');

          await expectRenderResult(
            {
              file: 'test.scss',
              sourceMap: true,
              outFile: 'out.css',
            },
            result => {
              expect(getSourceMap(result).sources).toEqual(['test.scss']);
            }
          );
        });
      });

      it('makes the path relative to outFile', async () => {
        await sandbox.run(async () => {
          await fs.writeFile('test.scss', 'a {b: c}');

          await expectRenderResult(
            {
              file: 'test.scss',
              sourceMap: true,
              outFile: 'dir/out.css',
            },
            result => {
              expect(getSourceMap(result).sources).toEqual([
                p.join('..', 'test.scss'),
              ]);
            }
          );
        });
      });

      it("contains an imported file's path", async () => {
        await sandbox.run(async () => {
          await fs.writeFile('test.scss', '@import "other";\na {b: c}');
          await fs.writeFile('other.scss', 'x {y: z}');

          await expectRenderResult(
            {
              file: 'test.scss',
              sourceMap: true,
              outFile: 'out.css',
            },
            result => {
              expect(getSourceMap(result).sources).toEqual([
                'other.scss',
                'test.scss',
              ]);
            }
          );
        });
      });
    });

    describe('no sourceMap', () => {
      it('supports sourceMap === undefined', done => {
        render({data: 'a {b: c}', outFile: 'out.css'}, (_, result) => {
          expect(result!.map).toBe(undefined);
          expect(result!.css.toString()).not.toContain('/*#');
          done();
        });
      });

      it('supports sourceMap === false', done => {
        render(
          {
            data: 'a {b: c}',
            sourceMap: false,
            outFile: 'out.css',
          },
          (_, result) => {
            expect(result!.map).toBe(undefined);
            expect(result!.css.toString()).not.toContain('/*#');
            done();
          }
        );
      });

      it('supports outFile  === undefined', done => {
        render({data: 'a {b: c}', sourceMap: true}, (_, result) => {
          expect(result!.map).toBe(undefined);
          expect(result!.css.toString()).not.toContain('/*#');
          done();
        });
      });
    });

    describe('string sourceMap and no outFile', () => {
      it('emits a source map', done => {
        render({data: 'a {b: c}', sourceMap: 'out.css.map'}, (_, result) => {
          expect(getSourceMap(result).sources).toEqual(['stdin']);
          done();
        });
      });

      it('derives the target URL from the input file', async () => {
        await sandbox.run(async () => {
          await fs.writeFile('test.scss', 'a {b: c}');

          await expectRenderResult(
            {
              file: 'test.scss',
              sourceMap: 'out.css.map',
            },
            result => {
              expect(getSourceMap(result).file).toBe('test.css');
            }
          );
        });
      });

      it('derives the target URL from the input file without an extension', async () => {
        await sandbox.run(async () => {
          await fs.writeFile('test', 'a {b: c}');

          await expectRenderResult(
            {
              file: 'test',
              sourceMap: 'out.css.map',
            },
            result => {
              expect(getSourceMap(result).file).toBe('test.css');
            }
          );
        });
      });

      it('derives the target URL from stdin', done => {
        render({data: 'a {b: c}', sourceMap: 'out.css.map'}, (_, result) => {
          expect(getSourceMap(result).file).toBe('stdin.css');
          done();
        });
      });
    });

    it("doesn't include a source map comment with omitSourceMapUrl", done => {
      render(
        {
          data: 'a {b: c}',
          sourceMap: true,
          outFile: 'out.css',
          omitSourceMapUrl: true,
        },
        (_, result) => {
          expect(result!.map).not.toBe(undefined);
          expect(result!.css.toString()).not.toContain('/*#');
          done();
        }
      );
    });

    describe('string sourceMap', () => {
      it('uses it in the source map comment', done => {
        render(
          {
            data: 'a {b: c}',
            sourceMap: 'map',
            outFile: 'out.css',
          },
          (_, result) => {
            expect(result!.map).not.toBe(undefined);
            expect(
              result!.css.toString().endsWith('\n\n/*# sourceMappingURL=map */')
            ).toBe(true);
            done();
          }
        );
      });

      it('makes the source map comment relative to the outfile', done => {
        render(
          {
            data: 'a {b: c}',
            sourceMap: 'map',
            outFile: 'dir/out.css',
          },
          (_, result) => {
            expect(result!.map).not.toBe(undefined);
            expect(
              result!.css
                .toString()
                .endsWith('\n\n/*# sourceMappingURL=../map */')
            ).toBe(true);
            done();
          }
        );
      });

      it('makes the file field relative to the source map location', done => {
        render(
          {
            data: 'a {b: c}',
            sourceMap: 'dir/map',
            outFile: 'out.css',
          },
          (_, result) => {
            expect(getSourceMap(result).file).toBe('../out.css');
            done();
          }
        );
      });

      it('makes the source map comment relative even if the path is absolute', done => {
        render(
          {
            data: 'a {b: c}',
            sourceMap: p.resolve('map'),
            outFile: 'out.css',
          },
          (_, result) => {
            expect(result!.map).not.toBe(undefined);
            expect(
              result!.css.toString().endsWith('\n\n/*# sourceMappingURL=map */')
            ).toBe(true);
            done();
          }
        );
      });

      it('makes the sources list relative to the map location', async () => {
        await sandbox.run(async () => {
          await fs.writeFile('test.scss', 'a {b: c}');

          await expectRenderResult(
            {
              file: 'test.scss',
              sourceMap: 'map',
              outFile: 'out.css',
            },
            result => {
              expect(getSourceMap(result).sources).toEqual(['test.scss']);
            }
          );
        });
      });
    });

    it('includes the source map in the CSS with sourceMapEmbed', done => {
      render(
        {
          data: 'a {b: c}',
          sourceMap: true,
          outFile: 'out.css',
          sourceMapEmbed: true,
        },
        (_, result) => {
          const embeddedString = result!.css
            .toString()
            .match(
              /\/\*# sourceMappingURL=data:application\/json;base64,(.+) \*\/$/
            )![1];
          const embeddedMap = JSON.parse(
            Buffer.from(embeddedString, 'base64').toString()
          );
          const map = getSourceMap(result);
          expect(embeddedMap).toEqual(map);
          done();
        }
      );
    });

    describe('sourceMapRoot', () => {
      it('includes the root as-is in the map', done => {
        render(
          {
            data: 'a {b: c}',
            sourceMap: true,
            outFile: 'out.css',
            sourceMapRoot: 'some random string',
          },
          (_, result) => {
            expect(getSourceMap(result).sourceRoot).toBe('some random string');
            done();
          }
        );
      });

      it("doesn't modify the source URLs", async () => {
        await sandbox.run(async () => {
          const root = 'root';
          await fs.writeFile('test.scss', 'a {b: c}');

          await expectRenderResult(
            {
              file: 'test.scss',
              sourceMap: true,
              outFile: 'out.css',
              sourceMapRoot: root,
            },
            result => {
              const map = getSourceMap(result);
              expect(map.sourceRoot).toBe(root);
              expect(map.sources).toEqual(['test.scss']);
            }
          );
        });
      });
    });
  });

  describe('errors', () => {
    function expectMessageAndToString(
      error: RenderError | undefined,
      message: string
    ) {
      if (error === undefined) throw Error('Expected render error.');
      expect(error!.message).toBe(message);
      expect(error!.toString()).toBe(`Error: ${message}`);
    }

    describe('parse error', () => {
      const data = 'a {b: }';

      it('has the correct error for a file', async () => {
        await sandbox.run(async () => {
          await fs.writeFile('test.scss', data);

          await expectRenderError({file: 'test.scss'}, error => {
            expectMessageAndToString(
              error,
              `Expected expression.
  ╷
1 │ a {b: }
  │       ^
  ╵
  test.scss 1:7  root stylesheet`
            );
            expect(error?.line).toBe(1);
            expect(error?.column).toBe(7);
            expect(error?.file).toBe(p.resolve('test.scss'));
            expect(error?.status).toBe(1);
          });
        });
      });

      it('has the correct error for a string', done => {
        render({data}, error => {
          expectMessageAndToString(
            error,
            `Expected expression.
  ╷
1 │ a {b: }
  │       ^
  ╵
  stdin 1:7  root stylesheet`
          );
          expect(error?.line).toBe(1);
          expect(error?.column).toBe(7);
          expect(error?.file).toBe('stdin');
          expect(error?.status).toBe(1);
          done();
        });
      });
    });

    describe('runtime error', () => {
      const data = 'a {b: 1 % a}';

      it('has the correct error for a file', async () => {
        await sandbox.run(async () => {
          await fs.writeFile('test.scss', data);

          await expectRenderError({file: 'test.scss'}, error => {
            expectMessageAndToString(
              error,
              `Undefined operation "1 % a".
  ╷
1 │ a {b: 1 % a}
  │       ^^^^^
  ╵
  test.scss 1:7  root stylesheet`
            );
            expect(error?.line).toBe(1);
            expect(error?.column).toBe(7);
            expect(error?.file).toBe(p.resolve('test.scss'));
            expect(error?.status).toBe(1);
          });
        });
      });

      it('has the correct error for a string', done => {
        render({data}, error => {
          expectMessageAndToString(
            error,
            `Undefined operation "1 % a".
  ╷
1 │ a {b: 1 % a}
  │       ^^^^^
  ╵
  stdin 1:7  root stylesheet`
          );
          expect(error?.line).toBe(1);
          expect(error?.column).toBe(7);
          expect(error?.file).toBe('stdin');
          expect(error?.status).toBe(1);
          done();
        });
      });
    });
  });
});
