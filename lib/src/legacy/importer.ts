// Copyright 2022 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {strict as assert} from 'assert';
import * as p from 'path';
import * as util from 'util';
import {pathToFileURL} from 'url';

import {resolvePath} from './resolve-path';
import {
  PromiseOr,
  SyncBoolean,
  fileUrlToPathCrossPlatform,
  thenOr,
} from '../utils';
import {
  FileImporter,
  Importer,
  ImporterResult,
  LegacyAsyncImporter,
  LegacyImporter,
  LegacyImporterResult,
  LegacyImporterThis,
  LegacyPluginThis,
  LegacySyncImporter,
} from '../vendor/sass';
import {legacyFileUrlToPath, pathToLegacyFileUrl} from './utils';

/**
 * A wrapper around a `LegacyImporter` callback that exposes it as a new-API
 * `Importer`, delegating to `LegacyImportersWrapper`.
 */
export class LegacyImporterWrapper<sync extends 'sync' | 'async'>
  implements Importer<sync>
{
  constructor(private readonly wrapper: LegacyImportersWrapper<sync>) {}

  canonicalize(
    url: string,
    options: {fromImport: boolean; containingUrl: URL | null}
  ): PromiseOr<URL | null, sync> {
    return this.wrapper.canonicalize(url, options);
  }

  load(canonicalUrl: URL): ImporterResult | null {
    return this.wrapper.load(canonicalUrl);
  }
}

/**
 * A wrapper around a `LegacyImporter` callback that exposes it as a new-API
 * `FileImporter`, delegating to `LegacyImportersWrapper`.
 */
export class LegacyFileImporterWrapper<sync extends 'sync' | 'async'>
  implements FileImporter<sync>
{
  constructor(private readonly wrapper: LegacyImportersWrapper<sync>) {}

  findFileUrl(
    url: string,
    options: {fromImport: boolean; containingUrl: URL | null}
  ): PromiseOr<URL | null, sync> {
    return this.wrapper.findFileUrl(url, options);
  }
}

/**
 * A wrapper around a `LegacyImporter` callback that exposes it as a pair of
 * new-API `Importer` and `FileImporter`.
 */
export class LegacyImportersWrapper<sync extends 'sync' | 'async'> {
  private id = 0;
  private importerResult?: ImporterResult;
  private fileUrl?: URL;

  constructor(
    private readonly self: LegacyPluginThis,
    private readonly callbacks: Array<LegacyImporter<sync>>,
    private readonly loadPaths: string[],
    private readonly sync: SyncBoolean<sync>
  ) {}

  importers() {
    return [
      new LegacyImporterWrapper(this),
      new LegacyFileImporterWrapper(this),
    ];
  }

  canonicalize(
    url: string,
    options: {fromImport: boolean; containingUrl: URL | null}
  ): PromiseOr<URL | null, sync> {
    const containingUrl = options.containingUrl;
    if (containingUrl === null) {
      return null;
    }

    const path = /^[A-Za-z][+\-.0-9A-Za-z]+:/.test(url)
      ? decodeURI(url)
      : decodeURIComponent(url);
    const parentPathOrUndefined = legacyFileUrlToPath(containingUrl);
    const parentPath = parentPathOrUndefined ?? 'stdin';

    if (parentPathOrUndefined !== undefined) {
      const absolutePath = url.startsWith('file:')
        ? fileUrlToPathCrossPlatform(url)
        : p.resolve(p.dirname(parentPath), path);
      const resolved = resolvePath(absolutePath, options.fromImport);
      if (resolved !== null) {
        this.fileUrl = pathToFileURL(resolved);
        return null;
      }
    }

    return thenOr(this.invokeCallbacks(path, parentPath, options), result => {
      if (result instanceof Error) throw result;
      if (result === null) return null;

      if (typeof result !== 'object') {
        throw (
          'Expected importer to return an object, got ' +
          `${util.inspect(result)}.`
        );
      }

      if ('contents' in result || !('file' in result)) {
        const canonicalUrl = pathToLegacyFileUrl(
          'file' in result
            ? (result as {file: string}).file
            : p.join(p.dirname(parentPath), path)
        );
        if (!('file' in result)) {
          canonicalUrl.searchParams.set('id', '' + this.id++);
        }
        this.importerResult = {
          contents: result.contents || '',
          syntax: canonicalUrl.pathname.endsWith('.sass')
            ? 'indented'
            : canonicalUrl.pathname.endsWith('.css')
              ? 'css'
              : 'scss',
          sourceMapUrl: canonicalUrl,
        };
        return canonicalUrl;
      }

      if ('file' in result) {
        if (p.isAbsolute(result.file)) {
          const resolved = resolvePath(result.file, options.fromImport);
          if (resolved !== null) {
            this.fileUrl = pathToFileURL(resolved);
            return null;
          }
        }

        const prefixes = [p.dirname(parentPath), ...this.loadPaths, '.'];
        for (const prefix of prefixes) {
          const resolved = resolvePath(
            p.join(prefix, result.file),
            options.fromImport
          );
          if (resolved !== null) {
            this.fileUrl = pathToFileURL(resolved);
            return null;
          }
        }
      }

      return null;
    });
  }

  load(_canonicalUrl: URL): ImporterResult | null {
    if (this.importerResult === undefined) {
      return null;
    }

    const importerResult = this.importerResult;
    delete this.importerResult;
    return importerResult;
  }

  findFileUrl(
    _url: string,
    options: {fromImport: boolean; containingUrl: URL | null}
  ): URL | null {
    options.containingUrl;
    if (this.fileUrl === undefined) {
      return null;
    }

    const fileUrl = this.fileUrl;
    delete this.fileUrl;
    return fileUrl;
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
}
