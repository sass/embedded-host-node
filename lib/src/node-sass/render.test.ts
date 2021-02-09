// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from 'path';
import {promises as fs} from 'fs';
import {RawSourceMap} from 'source-map';

import * as sandbox from '../../../spec/helpers/sandbox';
import {expectEqualIgnoringWhitespace} from '../../../spec/helpers/utils';
import {compileString} from '../compile';
import {render, RenderError, RenderResult} from './render';

describe('render', () => {
  const sassPathWithoutExtension = 'test';
  const sassPath = `${sassPathWithoutExtension}.scss`;

  describe('input', () => {
    it('renders a file from an absolute path', async done => {
      await sandbox.run(async () => {
        await fs.writeFile(sassPath, 'a {b: c}');
        await render({file: p.resolve(sassPath)}, (_, result) => {
          expectEqualIgnoringWhitespace(result!.css.toString(), 'a {b: c;}');
        });
      });
      done();
    });

    it('renders a file from a relative path', async done => {
      await sandbox.run(async () => {
        await fs.writeFile(sassPath, 'a {b: c}');
        await render({file: sassPath}, (_, result) => {
          expectEqualIgnoringWhitespace(result!.css.toString(), 'a {b: c;}');
        });
      });
      done();
    });

    it('renders a string', async done => {
      render({data: 'a {b: c}'}, (_, result) => {
        expectEqualIgnoringWhitespace(result!.css.toString(), 'a {b: c;}');
        done();
      });
    });

    it('enforces that one of data and file must be set', async done => {
      render({}, error => {
        expect(error!.message).toBe(
          'Either options.data or options.file must be set.'
        );
        done();
      });
    });

    describe('both data and file', () => {
      it('uses the data parameter as the source', async done => {
        await sandbox.run(async () => {
          await fs.writeFile(sassPath, 'a {b: c}');
          await render({data: 'x {y: z}', file: sassPath}, (_, result) => {
            expectEqualIgnoringWhitespace(result!.css.toString(), 'x {y: z;}');
          });
        });
        done();
      });

      it("doesn't require the file path to exist", async done => {
        render(
          {data: 'a {b: c}', file: p.resolve('non-existent.scss')},
          (_, result) => {
            expectEqualIgnoringWhitespace(result!.css.toString(), 'a {b: c;}');
            done();
          }
        );
      });

      it('imports relative to the file path', async done => {
        await sandbox.run(async () => {
          await fs.mkdir('subdir');
          await fs.writeFile(p.join('subdir', 'importee.scss'), 'a {b: c}');
          await render(
            {
              data: '@import "importee"',
              file: p.join('subdir', sassPath),
            },
            (_, result) => {
              expectEqualIgnoringWhitespace(
                result!.css.toString(),
                'a {b: c;}'
              );
            }
          );
        });
        done();
      });

      it('reports errors from the file path', async done => {
        render({data: 'x {y: }', file: sassPath}, error => {
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
    it('supports relative imports for a file', async done => {
      await sandbox.run(async () => {
        const importerPath = 'importer.scss';
        await fs.writeFile(
          importerPath,
          `@import "${sassPathWithoutExtension}"`
        );
        await fs.writeFile(sassPath, 'a {b: c}');
        await render({file: importerPath}, (_, result) => {
          expectEqualIgnoringWhitespace(result!.css.toString(), 'a {b: c;}');
        });
      });
      done();
    });

    it('supports relative imports for a file from a relative path', async done => {
      await sandbox.run(async () => {
        await fs.mkdir('subdir');
        const importerPath = p.join('subdir', 'importer.scss');
        await fs.writeFile(
          importerPath,
          `@import "../${sassPathWithoutExtension}"`
        );
        await fs.writeFile(sassPath, 'a {b: c}');
        await render({file: importerPath}, (_, result) => {
          expectEqualIgnoringWhitespace(result!.css.toString(), 'a {b: c;}');
        });
      });
      done();
    });

    it('supports absolute path imports', async done => {
      await sandbox.run(async () => {
        await fs.writeFile(sassPath, 'a {b: c}');
        await render(
          {data: `@import "${p.resolve(sassPath)}"`},
          (_, result) => {
            expectEqualIgnoringWhitespace(result!.css.toString(), 'a {b: c;}');
          }
        );
      });
      done();
    });

    it('supports import only files', async done => {
      await sandbox.run(async () => {
        await fs.writeFile('foo.scss', 'a {b: regular}');
        await fs.writeFile('foo.import.scss', 'a {b: import-only}');
        await render({data: '@import "foo"'}, (_, result) => {
          expectEqualIgnoringWhitespace(
            result!.css.toString(),
            'a {b: import-only;}'
          );
        });
      });
      done();
    });

    it('supports mixed @use and @import', async done => {
      await sandbox.run(async () => {
        await fs.writeFile('foo.scss', 'a {b: regular}');
        await fs.writeFile('foo.import.scss', 'a {b: import-only}');
        await render(
          {
            data: '@use "foo"; @import "foo";',
          },
          (_, result) => {
            expectEqualIgnoringWhitespace(
              result!.css.toString(),
              'a {b: regular;} a {b: import-only;}'
            );
          }
        );
      });
      done();
    });

    it('supports SASS_PATH', async done => {
      await sandbox.run(
        async () => {
          await fs.mkdir('dir1');
          await fs.mkdir('dir2');
          await fs.writeFile('dir1/test1.scss', 'a {b: c}');
          await fs.writeFile('dir2/test2.scss', 'x {y: z}');
          await render(
            {data: "@import 'test1'; @import 'test2';"},
            async (_, result) => {
              expectEqualIgnoringWhitespace(
                result!.css.toString(),
                'a {b: c;} x {y: z;}'
              );
            }
          );
        },
        {sassPathDirs: ['dir1', 'dir2']}
      );
      done();
    });
  });

  describe('output', () => {
    it('has expanded output style by default', async done => {
      await sandbox.run(async () => {
        await fs.writeFile(sassPath, 'a {b: c}');
        await render({file: sassPath}, (_, result) => {
          expect(result!.css.toString()).toBe('a {\n  b: c;\n}');
        });
      });
      done();
    });

    it('includes the filename', async done => {
      await sandbox.run(async () => {
        await fs.writeFile(sassPath, 'a {b: c}');
        await render({file: sassPath}, (_, result) => {
          expect(result!.stats.entry).toBe(sassPath);
        });
      });
      done();
    });

    it('includes data without a filename', async done => {
      render({data: 'a {b: c}'}, (_, result) => {
        expect(result!.stats.entry).toBe('data');
        done();
      });
    });

    it('includes timing information', async done => {
      render({data: 'a {b: c}'}, (_, result) => {
        const start = result!.stats.start;
        const end = result!.stats.end;
        expect(start).toBeInstanceOf(Number);
        expect(end).toBeInstanceOf(Number);
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
      let expectedMap;
      let map;
      let css;

      beforeAll(async done => {
        const data = 'a {b: c}';

        await compileString({
          source: data,
          sourceMap: map => {
            expectedMap = map;
          },
        });

        render(
          {
            data,
            sourceMap: true,
            outFile,
          },
          (_, result) => {
            css = result!.css.toString();
            map = getSourceMap(result);
            done();
          }
        );
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
      it('contains a relative path to an input file', async done => {
        await sandbox.run(async () => {
          await fs.writeFile(sassPath, 'a {b: c}');
          await render(
            {
              file: sassPath,
              sourceMap: true,
              outFile: 'out.css',
            },
            (_, result) => {
              expect(getSourceMap(result).sources).toEqual([sassPath]);
            }
          );
        });
        done();
      });

      it('makes the path relative to outFile', async done => {
        await sandbox.run(async () => {
          await fs.writeFile(sassPath, 'a {b: c}');
          await render(
            {
              file: sassPath,
              sourceMap: true,
              outFile: 'dir/out.css',
            },
            (_, result) => {
              expect(getSourceMap(result).sources).toEqual([
                p.join('..', sassPath),
              ]);
            }
          );
        });
        done();
      });

      it("contains an imported file's path", async done => {
        await sandbox.run(async () => {
          await fs.writeFile(sassPath, '@import "other";\na {b: c}');
          await fs.writeFile('other.scss', 'x {y: z}');
          await render(
            {
              file: sassPath,
              sourceMap: true,
              outFile: 'out.css',
            },
            (_, result) => {
              expect(getSourceMap(result).sources).toEqual([
                sassPath,
                'other.scss',
              ]);
            }
          );
        });
        done();
      });
    });

    describe('no sourceMap', () => {
      it('supports sourceMap === undefined', async done => {
        render({data: 'a {b: c}', outFile: 'out.css'}, (_, result) => {
          expect(result!.map).toBe(undefined);
          expect(result!.css.toString()).not.toContain('/*#');
          done();
        });
      });

      it('supports sourceMap === false', async done => {
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

      it('supports outFile  === undefined', async done => {
        render({data: 'a {b: c}', sourceMap: true}, (_, result) => {
          expect(result!.map).toBe(undefined);
          expect(result!.css.toString()).not.toContain('/*#');
          done();
        });
      });
    });

    describe('string sourceMap and no outFile', () => {
      it('emits a source map', async done => {
        render({data: 'a {b: c}', sourceMap: 'out.css.map'}, (_, result) => {
          expect(getSourceMap(result).sources).toEqual(['stdin']);
          done();
        });
      });

      it('derives the target URL from the input file', async done => {
        await sandbox.run(async () => {
          await fs.writeFile(sassPath, 'a {b: c}');
          await render(
            {
              file: sassPath,
              sourceMap: 'out.css.map',
            },
            (_, result) => {
              expect(getSourceMap(result).file).toBe(
                `${sassPathWithoutExtension}.css`
              );
            }
          );
        });
        done();
      });

      it('derives the target URL from the input file without an extension', async done => {
        await sandbox.run(async () => {
          await fs.writeFile(sassPathWithoutExtension, 'a {b: c}');
          await render(
            {
              file: sassPathWithoutExtension,
              sourceMap: 'out.css.map',
            },
            (_, result) => {
              expect(getSourceMap(result).file).toBe(
                `${sassPathWithoutExtension}.css`
              );
            }
          );
        });
        done();
      });

      it('derives the target URL from stdin', async done => {
        render({data: 'a {b: c}', sourceMap: 'out.css.map'}, (_, result) => {
          expect(getSourceMap(result).file).toBe('stdin.css');
          done();
        });
      });
    });

    it("doesn't include a source map comment with omitSourceMapUrl", async done => {
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
      it('uses it in the source map comment', async done => {
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

      it('makes the source map comment relative to the outfile', async done => {
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

      it('makes the file field relative to the source map location', async done => {
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

      it('makes the source map comment relative even if the path is absolute', async done => {
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

      it('makes the sources list relative to the map location', async done => {
        await sandbox.run(async () => {
          await fs.writeFile(sassPath, 'a {b: c}');
          await render(
            {
              file: sassPath,
              sourceMap: 'map',
              outFile: 'out.css',
            },
            (_, result) => {
              expect(getSourceMap(result).sources).toEqual([sassPath]);
            }
          );
        });
        done();
      });
    });

    it('includes the source map in the CSS with sourceMapEmbed', async done => {
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
      it('includes the root as-is in the map', async done => {
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

      it("doesn't modify the source URLs", async done => {
        await sandbox.run(async () => {
          const root = 'root';
          await fs.writeFile(sassPath, 'a {b: c}');
          await render(
            {
              file: sassPath,
              sourceMap: true,
              outFile: 'out.css',
              sourceMapRoot: root,
            },
            (_, result) => {
              const map = getSourceMap(result);
              expect(map.sourceRoot).toBe(root);
              expect(map.sources).toEqual([sassPath]);
            }
          );
        });
        done();
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

      it('has the correct error for a file', async done => {
        await fs.writeFile(p.resolve('asdf'), data);
        await sandbox.run(async () => {
          await fs.writeFile(sassPath, data);
          await render({file: sassPath}, error => {
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
            expect(error?.file).toBe(p.resolve(sassPath));
            expect(error?.status).toBe(1);
          });
        });
        done();
      });

      it('has the correct error for a string', async done => {
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

      it('has the correct error for a file', async done => {
        await sandbox.run(async () => {
          await fs.writeFile(sassPath, data);
          await render({file: sassPath}, error => {
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
            expect(error?.file).toBe(p.resolve(sassPath));
            expect(error?.status).toBe(1);
          });
        });
        done();
      });

      it('has the correct error for a string', async done => {
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
