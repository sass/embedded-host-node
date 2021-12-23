// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from 'path';
import {URL} from 'url';
import {inspect} from 'util';

import * as utils from './utils';
import {FileImporter, Importer, Options} from './vendor/sass';
import {
  InboundMessage,
  OutboundMessage,
} from './vendor/embedded-protocol/embedded_sass_pb';
import {catchOr, thenOr, PromiseOr} from './utils';

/**
 * A registry of importers defined in the host that can be invoked by the
 * compiler.
 */
export class ImporterRegistry<sync extends 'sync' | 'async'> {
  /** Protocol buffer representations of the registered importers. */
  readonly importers: InboundMessage.CompileRequest.Importer[];

  /** A map from importer IDs to their corresponding importers. */
  private readonly importersById = new Map<number, Importer<sync>>();

  /** A map from file importer IDs to their corresponding importers. */
  private readonly fileImportersById = new Map<number, FileImporter<sync>>();

  /** The next ID to use for an importer. */
  private id = 0;

  constructor(options?: Options<sync>) {
    this.importers = (options?.importers ?? [])
      .map(importer => this.register(importer))
      .concat(
        (options?.loadPaths ?? []).map(path => {
          const proto = new InboundMessage.CompileRequest.Importer();
          proto.setPath(p.resolve(path));
          return proto;
        })
      );
  }

  /** Converts an importer to a proto without adding it to `this.importers`. */
  register(
    importer: Importer<sync> | FileImporter<sync>
  ): InboundMessage.CompileRequest.Importer {
    const proto = new InboundMessage.CompileRequest.Importer();
    if ('canonicalize' in importer) {
      if ('findFileUrl' in importer) {
        throw new Error(
          'Importer may not contain both canonicalize() and findFileUrl(): ' +
            inspect(importer)
        );
      }

      proto.setImporterId(this.id);
      this.importersById.set(this.id, importer);
    } else {
      proto.setFileImporterId(this.id);
      this.fileImportersById.set(this.id, importer);
    }
    this.id += 1;
    return proto;
  }

  /** Handles a canonicalization request. */
  canonicalize(
    request: OutboundMessage.CanonicalizeRequest
  ): PromiseOr<InboundMessage.CanonicalizeResponse, sync> {
    const importer = this.importersById.get(request.getImporterId());
    if (!importer) {
      throw utils.compilerError('Unknown CanonicalizeRequest.importer_id');
    }

    return catchOr(
      () => {
        return thenOr(
          importer.canonicalize(request.getUrl(), {
            fromImport: request.getFromImport(),
          }),
          url => {
            const proto = new InboundMessage.CanonicalizeResponse();
            if (url !== null) proto.setUrl(url.toString());
            return proto;
          }
        );
      },
      error => {
        const proto = new InboundMessage.CanonicalizeResponse();
        proto.setError(`${error}`);
        return proto;
      }
    );
  }

  /** Handles an import request. */
  import(
    request: OutboundMessage.ImportRequest
  ): PromiseOr<InboundMessage.ImportResponse, sync> {
    const importer = this.importersById.get(request.getImporterId());
    if (!importer) {
      throw utils.compilerError('Unknown ImportRequest.importer_id');
    }

    return catchOr(
      () => {
        return thenOr(importer.load(new URL(request.getUrl())), result => {
          const proto = new InboundMessage.ImportResponse();
          if (result) {
            const success = new InboundMessage.ImportResponse.ImportSuccess();
            success.setContents(result.contents);
            success.setSyntax(utils.protofySyntax(result.syntax));
            if (result.sourceMapUrl) {
              success.setSourceMapUrl(result.sourceMapUrl.toString());
            }
            proto.setSuccess(success);
          }
          return proto;
        });
      },
      error => {
        const proto = new InboundMessage.ImportResponse();
        proto.setError(`${error}`);
        return proto;
      }
    );
  }

  /** Handles a file import request. */
  fileImport(
    request: OutboundMessage.FileImportRequest
  ): PromiseOr<InboundMessage.FileImportResponse, sync> {
    const importer = this.fileImportersById.get(request.getImporterId());
    if (!importer) {
      throw utils.compilerError('Unknown FileImportRequest.importer_id');
    }

    return catchOr(
      () => {
        return thenOr(
          importer.findFileUrl(request.getUrl(), {
            fromImport: request.getFromImport(),
          }),
          url => {
            const proto = new InboundMessage.FileImportResponse();
            if (url) {
              if (url.protocol !== 'file:') {
                throw (
                  `FileImporter ${inspect(importer)} returned non-file: URL ` +
                  +`"${url}" for URL "${request.getUrl()}".`
                );
              }
              proto.setFileUrl(url.toString());
            }
            return proto;
          }
        );
      },
      error => {
        const proto = new InboundMessage.FileImportResponse();
        proto.setError(`${error}`);
        return proto;
      }
    );
  }
}
