// Copyright 2022 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {strict as assert} from 'assert';
import * as fs from 'fs';
import * as p from 'path';
import * as util from 'util';

import {resolvePath} from './resolve-path';
import {
  PromiseOr,
  SyncBoolean,
  fileUrlToPathCrossPlatform,
  isErrnoException,
  thenOr,
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
import {
  legacyFileUrlToPath,
  legacyImporterProtocol,
  legacyImporterProtocolPrefix,
  pathToLegacyFileUrl,
} from './utils';

/**
 * A special URL protocol we use to signal when a stylesheet has finished
 * loading. This allows us to determine which stylesheet is "current" when
 * resolving a new load, which in turn allows us to pass in an accurate `prev`
 * parameter to the legacy callback.
 */
export const endOfLoadProtocol = 'sass-embedded-legacy-load-done:';

/**
 * The `file:` URL protocol with [legacyImporterProtocolPrefix] at the beginning.
 */
export const legacyImporterFileProtocol = 'legacy-importer-file:';

/**
 * A random namespace for `sass:meta`, so we can use `meta.load-css()` at the end
 * of the file to signal that a load has finished without polluting a namespace
 * a user might actually use.
 */
export const metaNamespace = `---${Math.random().toString(36).substring(2)}`;

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
    options: {fromImport: boolean; containingUrl: URL | null}
  ): PromiseOr<URL | null, sync> {
    if (url.startsWith(endOfLoadProtocol)) return new URL(url);

    // Emulate a base importer instead of using a real base importer,
    // because we want to mark containingUrl as used, which is impossible
    // in a real base importer.
    if (options.containingUrl !== null) {
      try {
        const absoluteUrl = new URL(url, options.containingUrl).toString();
        const resolved = this.canonicalize(absoluteUrl, {
          fromImport: options.fromImport,
          containingUrl: null,
        });
        if (resolved !== null) return resolved;
      } catch (error: unknown) {
        if (
          error instanceof TypeError &&
          isErrnoException(error) &&
          error.code === 'ERR_INVALID_URL'
        ) {
          // ignore
        } else {
          throw error;
        }
      }
    }

    if (
      url.startsWith(legacyImporterProtocolPrefix) ||
      url.startsWith(legacyImporterProtocol)
    ) {
      // A load starts with `legacyImporterProtocolPrefix` if and only if it's a
      // relative load for the current importer rather than an absolute load.
      // For the most part, we want to ignore these, but for `file:` URLs
      // specifically we want to resolve them on the filesystem to ensure
      // locality.
      const urlWithoutPrefix = url.substring(
        legacyImporterProtocolPrefix.length
      );
      if (urlWithoutPrefix.startsWith('file:')) {
        let resolved: string | null = null;

        try {
          const path = fileUrlToPathCrossPlatform(urlWithoutPrefix);
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
          return pathToLegacyFileUrl(resolved);
        }
      }

      return null;
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
            return new URL(`${legacyImporterProtocolPrefix}${url}`);
          } else {
            return new URL(legacyImporterProtocol + encodeURI(url));
          }
        } else {
          if (p.isAbsolute(result.file)) {
            const resolved = resolvePath(result.file, options.fromImport);
            return resolved ? pathToLegacyFileUrl(resolved) : null;
          }

          const prefixes = [...this.loadPaths, '.'];
          if (prev.path) prefixes.unshift(p.dirname(prev.url));

          for (const prefix of prefixes) {
            const resolved = resolvePath(
              p.join(prefix, result.file),
              options.fromImport
            );
            if (resolved !== null) return pathToLegacyFileUrl(resolved);
          }
          return null;
        }
      }),
      result => {
        if (result !== null) {
          const path = result.protocol === legacyImporterFileProtocol;
          this.prev.push({
            url: path ? legacyFileUrlToPath(result) : url,
            path,
          });
          return result;
        } else {
          for (const loadPath of this.loadPaths) {
            const resolved = resolvePath(
              p.join(loadPath, url),
              options.fromImport
            );
            if (resolved !== null) return pathToLegacyFileUrl(resolved);
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

    if (canonicalUrl.protocol === legacyImporterFileProtocol) {
      const syntax = canonicalUrl.pathname.endsWith('.sass')
        ? 'indented'
        : canonicalUrl.pathname.endsWith('.css')
          ? 'css'
          : 'scss';

      let contents =
        this.lastContents ??
        fs.readFileSync(legacyFileUrlToPath(canonicalUrl), 'utf-8');
      this.lastContents = undefined;
      if (syntax === 'css') {
        this.prev.pop();
      } else {
        contents = this.wrapContents(contents, syntax);
      }

      return {contents, syntax, sourceMapUrl: canonicalUrl};
    }

    const lastContents = this.lastContents!;
    assert.notEqual(lastContents, undefined);
    this.lastContents = undefined;
    return {
      contents: this.wrapContents(lastContents, 'scss'),
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
          if (result === null) {
            if (n === this.callbacks.length - 1) return null;
            return invokeNthCallback(n + 1);
          }
          if (
            'contents' in result &&
            result.contents &&
            typeof result.contents !== 'string'
          ) {
            throw new Error(
              `Invalid argument (contents): must be a string but was: ${
                (result.contents as {}).constructor.name
              }`
            );
          }
          return result;
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

  // Modifies {@link contents} to ensure that we know when a load has completed
  // so we can pass the correct `prev` argument to callbacks.
  private wrapContents(contents: string, syntax: 'scss' | 'indented'): string {
    const url = `"${endOfLoadProtocol}${endOfLoadCount++}"`;
    if (syntax === 'scss') {
      return (
        `@use "sass:meta" as ${metaNamespace};` +
        contents +
        `\n;@include ${metaNamespace}.load-css(${url});`
      );
    } else {
      return (
        `@use "sass:meta" as ${metaNamespace}\n` +
        contents +
        `\n@include ${metaNamespace}.load-css(${url})`
      );
    }
  }
}
