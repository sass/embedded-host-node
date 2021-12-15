// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from 'path';
import {Observable} from 'rxjs';

import {AsyncEmbeddedCompiler} from './embedded-compiler/async-compiler';
import {SyncEmbeddedCompiler} from './embedded-compiler/sync-compiler';
import {PacketTransformer} from './embedded-compiler/packet-transformer';
import {MessageTransformer} from './embedded-protocol/message-transformer';
import {Dispatcher, DispatcherHandlers} from './embedded-protocol/dispatcher';
import {deprotifyException} from './embedded-protocol/utils';
import * as proto from './vendor/embedded-protocol/embedded_sass_pb';
import {CompileResult, Options, StringOptions} from './vendor/sass';

export function compile(
  path: string,
  options?: Options<'sync'>
): CompileResult {
  // TODO(awjin): Create logger, importer, function registries.
  return compileRequestSync(newCompilePathRequest(path, options));
}

export function compileString(
  source: string,
  options?: Options<'sync'>
): CompileResult {
  // TODO(awjin): Create logger, importer, function registries.
  return compileRequestSync(newCompileStringRequest(source, options));
}

export function compileAsync(
  path: string,
  options?: Options<'async'>
): Promise<CompileResult> {
  // TODO(awjin): Create logger, importer, function registries.
  return compileRequestAsync(newCompilePathRequest(path, options));
}

export function compileStringAsync(
  source: string,
  options?: StringOptions<'async'>
): Promise<CompileResult> {
  // TODO(awjin): Create logger, importer, function registries.
  return compileRequestAsync(newCompileStringRequest(source, options));
}

// Creates a request for compiling a file.
function newCompilePathRequest(
  path: string,
  options?: Options<'sync' | 'async'>
): proto.InboundMessage.CompileRequest {
  // TODO(awjin): Populate request with importer/function IDs.

  const request = newCompileRequest(options);
  request.setPath(path);
  return request;
}

// Creates a request for compiling a string.
function newCompileStringRequest(
  source: string,
  options?: StringOptions<'sync' | 'async'>
): proto.InboundMessage.CompileRequest {
  // TODO(awjin): Populate request with importer/function IDs.

  const input = new proto.InboundMessage.CompileRequest.StringInput();
  input.setSource(source);

  switch (options?.syntax ?? 'scss') {
    case 'scss':
      input.setSyntax(proto.Syntax.SCSS);
      break;

    case 'indented':
      input.setSyntax(proto.Syntax.INDENTED);
      break;

    case 'css':
      input.setSyntax(proto.Syntax.CSS);
      break;
  }

  if (options?.url) input.setUrl(options.url.toString());

  const request = newCompileRequest(options);
  request.setString(input);
  return request;
}

// Creates a compilation request for the given `options` without adding any
// input-specific options.
function newCompileRequest(
  options?: Options<'sync' | 'async'>
): proto.InboundMessage.CompileRequest {
  const request = new proto.InboundMessage.CompileRequest();
  request.setSourceMap(!!options?.sourceMap);

  for (const path of options?.loadPaths ?? []) {
    const importer = new proto.InboundMessage.CompileRequest.Importer();
    importer.setPath(p.resolve(path));
    request.addImporters(importer);
  }

  return request;
}

// Spins up a compiler, then sends it a compile request. Returns a promise that
// resolves with the CompileResult. Throws if there were any protocol or
// compilation errors. Shuts down the compiler after compilation.
async function compileRequestAsync(
  request: proto.InboundMessage.CompileRequest
): Promise<CompileResult> {
  const embeddedCompiler = new AsyncEmbeddedCompiler();

  try {
    // TODO(awjin): Pass import and function registries' handler functions to
    // dispatcher.
    const dispatcher = createDispatcher<'sync'>(
      embeddedCompiler.stdout$,
      buffer => {
        embeddedCompiler.writeStdin(buffer);
      },
      {
        handleImportRequest: () => {
          throw Error('Custom importers not yet implemented.');
        },
        handleFileImportRequest: () => {
          throw Error('Custom file importers not yet implemented.');
        },
        handleCanonicalizeRequest: () => {
          throw Error('Canonicalize not yet implemented.');
        },
        handleFunctionCallRequest: () => {
          throw Error('Custom functions not yet implemented.');
        },
      }
    );

    // TODO(awjin): Subscribe logger to dispatcher's log events.

    return handleCompileResponse(
      await new Promise<proto.OutboundMessage.CompileResponse>(
        (resolve, reject) =>
          dispatcher.sendCompileRequest(request, (err, response) => {
            if (err) {
              reject(err);
            } else {
              resolve(response!);
            }
          })
      )
    );
  } finally {
    embeddedCompiler.close();
    await embeddedCompiler.exit$;
  }
}

// Spins up a compiler, then sends it a compile request. Returns a promise that
// resolves with the CompileResult. Throws if there were any protocol or
// compilation errors. Shuts down the compiler after compilation.
function compileRequestSync(
  request: proto.InboundMessage.CompileRequest
): CompileResult {
  const embeddedCompiler = new SyncEmbeddedCompiler();

  try {
    // TODO(awjin): Pass import and function registries' handler functions to
    // dispatcher.
    const dispatcher = createDispatcher<'sync'>(
      embeddedCompiler.stdout$,
      buffer => {
        embeddedCompiler.writeStdin(buffer);
      },
      {
        handleImportRequest: () => {
          throw Error('Custom importers not yet implemented.');
        },
        handleFileImportRequest: () => {
          throw Error('Custom file importers not yet implemented.');
        },
        handleCanonicalizeRequest: () => {
          throw Error('Canonicalize not yet implemented.');
        },
        handleFunctionCallRequest: () => {
          throw Error('Custom functions not yet implemented.');
        },
      }
    );

    // TODO(awjin): Subscribe logger to dispatcher's log events.

    let error: unknown;
    let response: proto.OutboundMessage.CompileResponse | undefined;
    dispatcher.sendCompileRequest(request, (error_, response_) => {
      if (error_) {
        error = error_;
      } else {
        response = response_;
      }
    });

    for (;;) {
      if (!embeddedCompiler.yield()) {
        throw new Error('Embedded compiler exited unexpectedly.');
      }

      if (error) throw error;
      if (response) return handleCompileResponse(response);
    }
  } finally {
    embeddedCompiler.close();
    embeddedCompiler.yieldUntilExit();
  }
}

/**
 * Creates a dispatcher that dispatches messages from the given `stdout` stream.
 */
function createDispatcher<sync extends 'sync' | 'async'>(
  stdout: Observable<Buffer>,
  writeStdin: (buffer: Buffer) => void,
  handlers: DispatcherHandlers<sync>
): Dispatcher<sync> {
  const packetTransformer = new PacketTransformer(stdout, writeStdin);

  const messageTransformer = new MessageTransformer(
    packetTransformer.outboundProtobufs$,
    packet => packetTransformer.writeInboundProtobuf(packet)
  );

  return new Dispatcher<sync>(
    messageTransformer.outboundMessages$,
    message => messageTransformer.writeInboundMessage(message),
    handlers
  );
}

/**
 * Converts a `CompileResponse` into a `CompileResult`.
 *
 * Throws a `SassException` if the compilation failed.
 */
function handleCompileResponse(
  response: proto.OutboundMessage.CompileResponse
): CompileResult {
  if (response.getSuccess()) {
    const success = response.getSuccess()!;
    const result: CompileResult = {
      css: success.getCss(),
      loadedUrls: [], // TODO(nex3): Fill this out
    };

    const sourceMap = success.getSourceMap();
    if (sourceMap) result.sourceMap = JSON.parse(sourceMap);
    return result;
  } else if (response.getFailure()) {
    throw deprotifyException(response.getFailure()!);
  } else {
    throw Error('Compiler sent empty CompileResponse.');
  }
}
