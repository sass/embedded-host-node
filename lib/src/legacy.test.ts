// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {promises as fs} from 'fs';
import * as p from 'path';
import {RawSourceMap} from 'source-map-js';
import {pathToFileURL} from 'url';

import * as sandbox from '../../test/sandbox';
import {LegacyException, LegacyOptions, LegacyResult} from './vendor/sass';
import {compileStringAsync} from './compile';
import {expectEqualIgnoringWhitespace} from '../../test/utils';
import {pathToUrlString} from './utils';
import {render} from './legacy';

describe('render', () => {
  function expectLegacyResult(
    renderOptions: LegacyOptions<'async'>,
    runExpectations: (result: LegacyResult) => void
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

  function expectLegacyException(
    renderOptions: LegacyOptions<'async'>,
    runExpectations: (error: LegacyException) => void
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
      await sandbox.run(async dir => {
        await fs.writeFile(dir('test.scss'), 'a {b: c}');

        await expectLegacyResult(
          {file: p.resolve(dir('test.scss'))},
          result => {
            expectEqualIgnoringWhitespace(result.css.toString(), 'a {b: c;}');
          }
        );
      });
    });

    it('renders a file from a relative path', async () => {
      await sandbox.run(async dir => {
        await fs.writeFile(dir('test.scss'), 'a {b: c}');

        await expectLegacyResult({file: dir('test.scss')}, result => {
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

    describe('enforces that one of data and file must be set', () => {
      it('when neither is set', done => {
        render({} as LegacyOptions<'async'>, error => {
          expect(error!.message).toBe(
            'Either options.data or options.file must be set.'
          );
          done();
        });
      });

      it('when file is empty', done => {
        render({file: ''}, error => {
          expect(error!.message).toBe(
            'Either options.data or options.file must be set.'
          );
          done();
        });
      });
    });

    describe('both data and file', () => {
      it('uses the data parameter as the source', async () => {
        await sandbox.run(async dir => {
          await fs.writeFile(dir('test.scss'), 'a {b: c}');

          await expectLegacyResult(
            {data: 'x {y: z}', file: dir('test.scss')},
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
        await sandbox.run(async dir => {
          await fs.mkdir(dir('subdir'));
          await fs.writeFile(dir('subdir', 'importee.scss'), 'a {b: c}');

          await expectLegacyResult(
            {
              data: '@import "importee"',
              file: dir('subdir', 'test.scss'),
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

    it('renders a string with indented syntax', done => {
      render(
        {
          data: 'a\n\tb: c',
          indentedSyntax: true,
        },
        (_, result) => {
          expectEqualIgnoringWhitespace(result!.css.toString(), 'a {b: c;}');
          done();
        }
      );
    });

    it('renders a file with indented syntax', async () => {
      await sandbox.run(async dir => {
        await fs.writeFile(dir('test.sass'), 'a\n\tb: c');

        await expectLegacyResult({file: dir('test.sass')}, result => {
          expectEqualIgnoringWhitespace(result.css.toString(), 'a {b: c;}');
        });
      });
    });
  });

  describe('imports', () => {
    it('supports relative imports for a file', async () => {
      await sandbox.run(async dir => {
        const importerPath = dir('importer.scss');
        await fs.writeFile(importerPath, '@import "test"');
        await fs.writeFile(dir('test.scss'), 'a {b: c}');

        await expectLegacyResult({file: importerPath}, result => {
          expectEqualIgnoringWhitespace(result.css.toString(), 'a {b: c;}');
        });
      });
    });

    it('supports relative imports for a file from a relative path', async () => {
      await sandbox.run(async dir => {
        await fs.mkdir(dir('subdir'));
        const importerPath = dir('subdir', 'importer.scss');
        await fs.writeFile(importerPath, '@import "../test"');
        await fs.writeFile(dir('test.scss'), 'a {b: c}');

        await expectLegacyResult({file: importerPath}, result => {
          expectEqualIgnoringWhitespace(result.css.toString(), 'a {b: c;}');
        });
      });
    });

    it('supports absolute path imports', async () => {
      await sandbox.run(async dir => {
        await fs.writeFile(dir('test.scss'), 'a {b: c}');

        await expectLegacyResult(
          {data: `@import "${pathToFileURL(p.resolve(dir('test.scss')))}"`},
          result => {
            expectEqualIgnoringWhitespace(result.css.toString(), 'a {b: c;}');
          }
        );
      });
    });

    it('supports imports relative to includePaths', async () => {
      await sandbox.run(async dir => {
        await fs.mkdir(dir('dir1'));
        await fs.mkdir(dir('dir2'));
        await fs.mkdir(dir('entryDir'));

        const file1Path = dir('dir1', 'file1.scss');
        await fs.writeFile(file1Path, 'a {b: c}');

        const file2Path = dir('dir2', 'file2.scss');
        await fs.writeFile(file2Path, 'd {e: f}');

        const entryFile = dir('entryDir', 'entry.scss');
        await fs.writeFile(
          entryFile,
          `
            @import 'file1.scss';
            @import 'file2.scss';
          `
        );

        await expectLegacyResult(
          {
            file: entryFile,
            includePaths: [dir('dir1'), dir('dir2')],
          },
          result => {
            expectEqualIgnoringWhitespace(
              result.css.toString(),
              'a { b: c; } d {e: f; }'
            );
          }
        );
      });
    });

    it('supports import only files', async () => {
      await sandbox.run(async dir => {
        await fs.writeFile(dir('foo.scss'), 'a {b: regular}');
        await fs.writeFile(dir('foo.import.scss'), 'a {b: import-only}');

        await expectLegacyResult(
          {data: `@import "${pathToUrlString(dir('foo'))}"`},
          result => {
            expectEqualIgnoringWhitespace(
              result.css.toString(),
              'a {b: import-only;}'
            );
          }
        );
      });
    });

    it('supports mixed @use and @import', async () => {
      await sandbox.run(async dir => {
        await fs.writeFile(dir('foo.scss'), 'a {b: regular}');
        await fs.writeFile(dir('foo.import.scss'), 'a {b: import-only}');

        await expectLegacyResult(
          {
            data: `
              @use "${pathToUrlString(dir('foo'))}";
              @import "${pathToUrlString(dir('foo'))}";
            `,
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
        async dir => {
          await fs.mkdir(dir('dir1'));
          await fs.mkdir(dir('dir2'));
          await fs.writeFile(dir('dir1/test1.scss'), 'a {b: c}');
          await fs.writeFile(dir('dir2/test2.scss'), 'x {y: z}');

          await expectLegacyResult(
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
      await sandbox.run(async dir => {
        await fs.writeFile(dir('test.scss'), 'a {b: c}');

        await expectLegacyResult({file: dir('test.scss')}, result => {
          expect(result.css.toString()).toBe('a {\n  b: c;\n}');
        });
      });
    });

    it('includes the filename', async () => {
      await sandbox.run(async dir => {
        await fs.writeFile(dir('test.scss'), 'a {b: c}');

        await expectLegacyResult({file: dir('test.scss')}, result => {
          expect(result.stats.entry).toBe(dir('test.scss'));
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
    // Gets the source map from within a LegacyResult.
    function getSourceMap(result?: LegacyResult): RawSourceMap {
      if (result === undefined) throw Error('Expected render result.');
      if (result.map === undefined) {
        throw Error('Expected render result to contain a sourceMap.');
      }
      return JSON.parse(result.map.toString());
    }

    describe('basic invocation', () => {
      const outFile = 'out.css';
      let expectedMap: RawSourceMap;
      let map: RawSourceMap;
      let css: string;

      beforeAll(async () => {
        const data = 'a {b: c}';

        expectedMap = (await compileStringAsync(data, {sourceMap: true}))
          .sourceMap!;

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
        await sandbox.run(async dir => {
          await fs.writeFile(dir('test.scss'), 'a {b: c}');

          await expectLegacyResult(
            {
              file: dir('test.scss'),
              sourceMap: true,
              outFile: dir('out.css'),
            },
            result => {
              expect(getSourceMap(result).sources).toEqual(['test.scss']);
            }
          );
        });
      });

      it('makes the path relative to outFile', async () => {
        await sandbox.run(async dir => {
          await fs.writeFile(dir('test.scss'), 'a {b: c}');

          await expectLegacyResult(
            {
              file: dir('test.scss'),
              sourceMap: true,
              outFile: dir('dir/out.css'),
            },
            result => {
              expect(getSourceMap(result).sources).toEqual(['../test.scss']);
            }
          );
        });
      });

      it("contains an imported file's path", async () => {
        await sandbox.run(async dir => {
          await fs.writeFile(dir('test.scss'), '@import "other";\na {b: c}');
          await fs.writeFile(dir('other.scss'), 'x {y: z}');

          await expectLegacyResult(
            {
              file: dir('test.scss'),
              sourceMap: true,
              outFile: dir('out.css'),
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
        await sandbox.run(async dir => {
          await fs.writeFile(dir('test.scss'), 'a {b: c}');

          await expectLegacyResult(
            {
              file: dir('test.scss'),
              sourceMap: dir('out.css.map'),
            },
            result => {
              expect(getSourceMap(result).file).toBe('test.css');
            }
          );
        });
      });

      it('derives the target URL from the input file without an extension', async () => {
        await sandbox.run(async dir => {
          await fs.writeFile(dir('test'), 'a {b: c}');

          await expectLegacyResult(
            {
              file: dir('test'),
              sourceMap: dir('out.css.map'),
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
        await sandbox.run(async dir => {
          await fs.writeFile(dir('test.scss'), 'a {b: c}');

          await expectLegacyResult(
            {
              file: dir('test.scss'),
              sourceMap: dir('map'),
              outFile: dir('out.css'),
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
        await sandbox.run(async dir => {
          const root = 'root';
          await fs.writeFile(dir('test.scss'), 'a {b: c}');

          await expectLegacyResult(
            {
              file: dir('test.scss'),
              sourceMap: true,
              outFile: dir('out.css'),
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
      error: LegacyException | undefined,
      message: string
    ) {
      if (error === undefined) throw Error('Expected render error.');
      expect(error!.message).toBe(message);
      expect(error!.toString()).toBe(`Error: ${message}`);
    }

    describe('parse error', () => {
      const data = 'a {b: }';

      it('has the correct error for a file', async () => {
        await sandbox.run(async dir => {
          await fs.writeFile(dir('test.scss'), data);

          await expectLegacyException({file: dir('test.scss')}, error => {
            expectMessageAndToString(
              error,
              `Expected expression.
  ╷
1 │ a {b: }
  │       ^
  ╵
  ${p.relative('.', dir('test.scss'))} 1:7  root stylesheet`
            );
            expect(error?.line).toBe(1);
            expect(error?.column).toBe(7);
            expect(error?.file).toBe(p.resolve(dir('test.scss')));
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
  - 1:7  root stylesheet`
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
        await sandbox.run(async dir => {
          await fs.writeFile(dir('test.scss'), data);

          await expectLegacyException({file: dir('test.scss')}, error => {
            expectMessageAndToString(
              error,
              `Undefined operation "1 % a".
  ╷
1 │ a {b: 1 % a}
  │       ^^^^^
  ╵
  ${p.relative('.', dir('test.scss'))} 1:7  root stylesheet`
            );
            expect(error?.line).toBe(1);
            expect(error?.column).toBe(7);
            expect(error?.file).toBe(p.resolve(dir('test.scss')));
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
  - 1:7  root stylesheet`
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
