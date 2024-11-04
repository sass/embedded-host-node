// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {createRequire} from 'module';
import * as p from 'path';
import {URL} from 'url';
import {inspect} from 'util';
import {create} from '@bufbuild/protobuf';

import {CanonicalizeContext} from './canonicalize-context';
import * as utils from './utils';
import {FileImporter, Importer, Options} from './vendor/sass';
import * as proto from './vendor/embedded_sass_pb';
import {PromiseOr, catchOr, thenOr} from './utils';

const entryPointDirectoryKey = Symbol();

export class NodePackageImporter {
  readonly [entryPointDirectoryKey]: string;

  constructor(entryPointDirectory?: string) {
    entryPointDirectory = entryPointDirectory
      ? p.resolve(entryPointDirectory)
      : require.main?.filename
        ? p.dirname(require.main.filename)
        : // TODO: Find a way to use `import.meta.main` once
          // https://github.com/nodejs/node/issues/49440 is done.
          process.argv[1]
          ? createRequire(process.argv[1]).resolve(process.argv[1])
          : undefined;
    if (!entryPointDirectory) {
      throw new Error(
        'The Node package importer cannot determine an entry point ' +
          'because `require.main.filename` is not defined. ' +
          'Please provide an `entryPointDirectory` to the `NodePackageImporter`.',
      );
    }
    this[entryPointDirectoryKey] = entryPointDirectory;
  }
}

/**
 * A registry of importers defined in the host that can be invoked by the
 * compiler.
 */
export class ImporterRegistry<sync extends 'sync' | 'async'> {
  /** Protocol buffer representations of the registered importers. */
  readonly importers: proto.InboundMessage_CompileRequest_Importer[];

  /** A map from importer IDs to their corresponding importers. */
  private readonly importersById = new Map<number, Importer<sync>>();

  /** A map from file importer IDs to their corresponding importers. */
  private readonly fileImportersById = new Map<number, FileImporter<sync>>();

  /** The next ID to use for an importer. */
  private id = 0;

  constructor(options?: Options<sync>) {
    this.importers = (options?.importers ?? [])
      .map(importer =>
        this.register(
          importer as Importer<sync> | FileImporter<sync> | NodePackageImporter,
        ),
      )
      .concat(
        (options?.loadPaths ?? []).map(path =>
          create(proto.InboundMessage_CompileRequest_ImporterSchema, {
            importer: {case: 'path', value: p.resolve(path)},
          }),
        ),
      );
  }

  /** Converts an importer to a proto without adding it to `this.importers`. */
  register(
    importer: Importer<sync> | FileImporter<sync> | NodePackageImporter,
  ): proto.InboundMessage_CompileRequest_Importer {
    const message = create(
      proto.InboundMessage_CompileRequest_ImporterSchema,
      {},
    );
    if (importer instanceof NodePackageImporter) {
      const importerMessage = create(proto.NodePackageImporterSchema, {
        entryPointDirectory: importer[entryPointDirectoryKey],
      });
      message.importer = {
        case: 'nodePackageImporter',
        value: importerMessage,
      };
    } else if ('canonicalize' in importer) {
      if ('findFileUrl' in importer) {
        throw new Error(
          'Importer may not contain both canonicalize() and findFileUrl(): ' +
            inspect(importer),
        );
      }

      message.importer = {case: 'importerId', value: this.id};
      message.nonCanonicalScheme =
        typeof importer.nonCanonicalScheme === 'string'
          ? [importer.nonCanonicalScheme]
          : (importer.nonCanonicalScheme ?? []);
      this.importersById.set(this.id, importer);
    } else {
      message.importer = {case: 'fileImporterId', value: this.id};
      this.fileImportersById.set(this.id, importer);
    }
    this.id += 1;
    return message;
  }

  /** Handles a canonicalization request. */
  canonicalize(
    request: proto.OutboundMessage_CanonicalizeRequest,
  ): PromiseOr<proto.InboundMessage_CanonicalizeResponse, sync> {
    const importer = this.importersById.get(request.importerId);
    if (!importer) {
      throw utils.compilerError('Unknown CanonicalizeRequest.importer_id');
    }

    const canonicalizeContext = new CanonicalizeContext(
      request.containingUrl ? new URL(request.containingUrl) : null,
      request.fromImport,
    );

    return catchOr(
      () => {
        return thenOr(
          importer.canonicalize(request.url, canonicalizeContext),
          url =>
            create(proto.InboundMessage_CanonicalizeResponseSchema, {
              result:
                url === null
                  ? {case: undefined}
                  : {case: 'url', value: url.toString()},
              containingUrlUnused: !canonicalizeContext.containingUrlAccessed,
            }),
        );
      },
      error =>
        create(proto.InboundMessage_CanonicalizeResponseSchema, {
          result: {case: 'error', value: `${error}`},
        }),
    );
  }

  /** Handles an import request. */
  import(
    request: proto.OutboundMessage_ImportRequest,
  ): PromiseOr<proto.InboundMessage_ImportResponse, sync> {
    const importer = this.importersById.get(request.importerId);
    if (!importer) {
      throw utils.compilerError('Unknown ImportRequest.importer_id');
    }

    return catchOr(
      () => {
        return thenOr(importer.load(new URL(request.url)), result => {
          if (!result)
            return create(proto.InboundMessage_ImportResponseSchema, {});

          if (typeof result.contents !== 'string') {
            throw Error(
              `Invalid argument (contents): must be a string but was: ${
                (result.contents as {}).constructor.name
              }`,
            );
          }

          if (result.sourceMapUrl && !result.sourceMapUrl.protocol) {
            throw Error(
              'Invalid argument (sourceMapUrl): must be absolute but was: ' +
                result.sourceMapUrl,
            );
          }

          return create(proto.InboundMessage_ImportResponseSchema, {
            result: {
              case: 'success',
              value: {
                contents: result.contents,
                syntax: utils.protofySyntax(result.syntax),
                sourceMapUrl: result.sourceMapUrl?.toString() ?? '',
              },
            },
          });
        });
      },
      error =>
        create(proto.InboundMessage_ImportResponseSchema, {
          result: {case: 'error', value: `${error}`},
        }),
    );
  }

  /** Handles a file import request. */
  fileImport(
    request: proto.OutboundMessage_FileImportRequest,
  ): PromiseOr<proto.InboundMessage_FileImportResponse, sync> {
    const importer = this.fileImportersById.get(request.importerId);
    if (!importer) {
      throw utils.compilerError('Unknown FileImportRequest.importer_id');
    }

    const canonicalizeContext = new CanonicalizeContext(
      request.containingUrl ? new URL(request.containingUrl) : null,
      request.fromImport,
    );

    return catchOr(
      () => {
        return thenOr(
          importer.findFileUrl(request.url, canonicalizeContext),
          url => {
            if (!url) {
              return create(proto.InboundMessage_FileImportResponseSchema, {
                containingUrlUnused: !canonicalizeContext.containingUrlAccessed,
              });
            }
            if (url.protocol !== 'file:') {
              throw (
                `FileImporter ${inspect(importer)} returned non-file: URL ` +
                +`"${url}" for URL "${request.url}".`
              );
            }
            return create(proto.InboundMessage_FileImportResponseSchema, {
              result: {case: 'fileUrl', value: url.toString()},
              containingUrlUnused: !canonicalizeContext.containingUrlAccessed,
            });
          },
        );
      },
      error =>
        create(proto.InboundMessage_FileImportResponseSchema, {
          result: {case: 'error', value: `${error}`},
        }),
    );
  }
}
