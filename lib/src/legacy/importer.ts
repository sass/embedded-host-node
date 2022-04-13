// Copyright 2022 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {strict as assert} from 'assert';
import {pathToFileURL, URL as NodeURL} from 'url';
import * as fs from 'fs';
import * as p from 'path';
import * as util from 'util';

import {resolvePath} from './resolve-path';
import {
  fileUrlToPathCrossPlatform,
  isErrnoException,
  thenOr,
  PromiseOr,
  SyncBoolean,
} from '../utils';
import {
  Importer,
  ImporterResult,
  LegacyAsyncImporter,
  LegacyImporter,
  LegacyImporterResult,
  LegacyImporterThis,
  LegacyPluginThis,
  LegacySyncImporter,
} from '../vendor/sass';

/**
 * A special URL protocol we use to signal when a stylesheet has finished
 * loading. This allows us to determine which stylesheet is "current" when
 * resolving a new load, which in turn allows us to pass in an accurate `prev`
 * parameter to the legacy callback.
 */
export const endOfLoadProtocol = 'sass-embedded-legacy-load-done:';

/**
 * The URL protocol to use for URLs canonicalized using `LegacyImporterWrapper`.
 */
export const legacyImporterProtocol = 'legacy-importer:';

// A count of `endOfLoadProtocol` imports that have been generated. Each one
// must be a different URL to ensure that the importer results aren't cached.
let endOfLoadCount = 0;

// The interface for previous URLs that were passed to
// `LegacyImporterWrapper.callbacks`.
interface PreviousUrl {
  // The URL itself. This is actually an absolute path if `path` is true.
  url: string;

  // Whether `url` is an absolute path.
  path: boolean;
}

/**
 * A wrapper around a `LegacyImporter` callback that exposes it as a new-API
 * `Importer`.
 */
export class LegacyImporterWrapper<sync extends 'sync' | 'async'>
  implements Importer<sync>
{
  // A stack of previous URLs passed to `this.callbacks`.
  private readonly prev: PreviousUrl[] = [];

  // The `contents` field returned by the last successful invocation of
  // `this.callbacks`, if it returned one.
  private lastContents: string | undefined;

  // Whether we're expecting the next call to `canonicalize()` to be a relative
  // load. The legacy importer API doesn't handle these loads in the same way as
  // the modern API, so we always return `null` in this case.
  private expectingRelativeLoad = true;

  constructor(
    private readonly self: LegacyPluginThis,
    private readonly callbacks: Array<LegacyImporter<sync>>,
    private readonly loadPaths: string[],
    initialPrev: string,
    private readonly sync: SyncBoolean<sync>
  ) {
    const path = initialPrev !== 'stdin';
    this.prev.push({url: path ? p.resolve(initialPrev) : 'stdin', path});
  }

  canonicalize(
    url: string,
    options: {fromImport: boolean}
  ): PromiseOr<URL | null, sync> {
    if (url.startsWith(endOfLoadProtocol)) return new URL(url);

    // Since there's only ever one modern importer in legacy mode, we can be
    // sure that all normal loads are preceded by exactly one relative load.
    if (this.expectingRelativeLoad) {
      if (url.startsWith('file:')) {
        let resolved: string | null = null;

        try {
          const path = fileUrlToPathCrossPlatform(url);
          resolved = resolvePath(path, options.fromImport);
        } catch (error: unknown) {
          if (
            error instanceof TypeError &&
            isErrnoException(error) &&
            (error.code === 'ERR_INVALID_URL' ||
              error.code === 'ERR_INVALID_FILE_URL_PATH')
          ) {
            // It's possible for `url` to represent an invalid path for the
            // current platform. For example, `@import "/foo/bar/baz"` will
            // resolve to `file:///foo/bar/baz` which is an invalid URL on
            // Windows. In that case, we treat it as though the file doesn't
            // exist so that the user's custom importer can still handle the
            // URL.
          } else {
            throw error;
          }
        }

        if (resolved !== null) {
          this.prev.push({url: resolved, path: true});
          return pathToFileURL(resolved);
        }
      }

      this.expectingRelativeLoad = false;
      return null;
    } else {
      this.expectingRelativeLoad = true;
    }

    const prev = this.prev[this.prev.length - 1];
    return thenOr(
      thenOr(this.invokeCallbacks(url, prev.url, options), result => {
        if (result instanceof Error) throw result;
        if (result === null) return null;

        if (typeof result !== 'object') {
          throw (
            'Expected importer to return an object, got ' +
            `${util.inspect(result)}.`
          );
        }

        if ('contents' in result || !('file' in result)) {
          this.lastContents = result.contents ?? '';

          if ('file' in result) {
            return new URL(
              legacyImporterProtocol +
                encodeURI((result as {file: string}).file)
            );
          } else if (/^[A-Za-z+.-]+:/.test(url)) {
            return new URL(url);
          } else {
            return new URL(legacyImporterProtocol + encodeURI(url));
          }
        } else {
          if (p.isAbsolute(result.file)) {
            const resolved = resolvePath(result.file, options.fromImport);
            return resolved ? pathToFileURL(resolved) : null;
          }

          const prefixes = [...this.loadPaths, '.'];
          if (prev.path) prefixes.unshift(p.dirname(prev.url));

          for (const prefix of prefixes) {
            const resolved = resolvePath(
              p.join(prefix, result.file),
              options.fromImport
            );
            if (resolved !== null) return pathToFileURL(resolved);
          }
          return null;
        }
      }),
      result => {
        if (result !== null) {
          const path = result.protocol === 'file:';
          this.prev.push({
            url: path ? fileUrlToPathCrossPlatform(result as NodeURL) : url,
            path,
          });
          return result;
        } else {
          for (const loadPath of this.loadPaths) {
            const resolved = resolvePath(
              p.join(loadPath, url),
              options.fromImport
            );
            if (resolved !== null) return pathToFileURL(resolved);
          }
          return null;
        }
      }
    );
  }

  load(canonicalUrl: URL): ImporterResult | null {
    if (canonicalUrl.protocol === endOfLoadProtocol) {
      this.prev.pop();
      return {
        contents: '',
        syntax: 'scss',
        sourceMapUrl: new URL(endOfLoadProtocol),
      };
    }

    if (canonicalUrl.protocol === 'file:') {
      const syntax = canonicalUrl.pathname.endsWith('.sass')
        ? 'indented'
        : canonicalUrl.pathname.endsWith('.css')
        ? 'css'
        : 'scss';

      let contents =
        this.lastContents ??
        fs.readFileSync(
          fileUrlToPathCrossPlatform(canonicalUrl as NodeURL),
          'utf-8'
        );
      this.lastContents = undefined;
      if (syntax === 'scss') {
        contents += this.endOfLoadImport;
      } else if (syntax === 'indented') {
        contents += `\n@import "${endOfLoadProtocol}${endOfLoadCount++}"`;
      } else {
        this.prev.pop();
      }

      return {contents, syntax, sourceMapUrl: canonicalUrl};
    }

    const lastContents = this.lastContents;
    assert.notEqual(lastContents, undefined);
    this.lastContents = undefined;
    return {
      contents: lastContents + this.endOfLoadImport,
      syntax: 'scss',
      sourceMapUrl: canonicalUrl,
    };
  }

  // Invokes each callback in `this.callbacks` until one returns a non-null
  // `LegacyImporterResult`, then returns that result. Returns `null` if all
  // callbacks return `null`.
  private invokeCallbacks(
    url: string,
    prev: string,
    {fromImport}: {fromImport: boolean}
  ): PromiseOr<LegacyImporterResult, sync> {
    assert(this.callbacks.length > 0);

    const self: LegacyImporterThis = {...this.self, fromImport};
    self.options = {...self.options, context: self};

    const invokeNthCallback = (
      n: number
    ): PromiseOr<LegacyImporterResult, sync> =>
      thenOr(
        this.invokeCallback(this.callbacks[n], self, url, prev),
        result => {
          if (result !== null) return result;
          if (n === this.callbacks.length - 1) return null;
          return invokeNthCallback(n + 1);
        }
      );

    return invokeNthCallback(0);
  }

  // Invokes `callback` and converts its return value into a `PromiseOr`.
  private invokeCallback(
    callback: LegacyImporter<sync>,
    self: LegacyImporterThis,
    url: string,
    prev: string
  ): PromiseOr<LegacyImporterResult, sync> {
    if (this.sync) {
      return (callback as LegacySyncImporter).call(self, url, prev);
    }

    return new Promise(resolve => {
      // The cast here is necesary to work around microsoft/TypeScript#33815.
      const syncResult = (callback as LegacyAsyncImporter).call(
        self,
        url,
        prev,
        resolve
      );

      if (syncResult !== undefined) resolve(syncResult);
    }) as PromiseOr<LegacyImporterResult, sync>;
  }

  // The `@import` statement to inject after the contents of files to ensure
  // that we know when a load has completed so we can pass the correct `prev`
  // argument to callbacks.
  private get endOfLoadImport() {
    return `\n;@import "${endOfLoadProtocol}${endOfLoadCount++}";`;
  }
}
