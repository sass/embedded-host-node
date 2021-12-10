// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from 'path';

import {EmbeddedCompiler} from './embedded-compiler/compiler';
import {PacketTransformer} from './embedded-compiler/packet-transformer';
import {MessageTransformer} from './embedded-protocol/message-transformer';
import {Dispatcher} from './embedded-protocol/dispatcher';
import {deprotifyException} from './embedded-protocol/utils';
import * as proto from './vendor/embedded-protocol/embedded_sass_pb';
import {CompileResult, Options, StringOptions} from './vendor/sass';

export function compileAsync(
  path: string,
  options?: Options<'async'>
): Promise<CompileResult> {
  // TODO(awjin): Create logger, importer, function registries.
  return compileRequest(newCompilePathRequest(path, options));
}

export function compileStringAsync(
  source: string,
  options?: StringOptions<'async'>
): Promise<CompileResult> {
  // TODO(awjin): Create logger, importer, function registries.
  return compileRequest(newCompileStringRequest(source, options));
}

// Creates a request for compiling a file.
function newCompilePathRequest(
  path: string,
  options?: Options<'async'>
): proto.InboundMessage.CompileRequest {
  // TODO(awjin): Populate request with importer/function IDs.

  const request = newCompileRequest(options);
  request.setPath(path);
  return request;
}

// Creates a request for compiling a string.
function newCompileStringRequest(
  source: string,
  options?: StringOptions<'async'>
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
  options?: Options<'async'>
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
async function compileRequest(
  request: proto.InboundMessage.CompileRequest
): Promise<CompileResult> {
  const embeddedCompiler = new EmbeddedCompiler();

  try {
    const packetTransformer = new PacketTransformer(
      embeddedCompiler.stdout$,
      buffer => embeddedCompiler.writeStdin(buffer)
    );

    const messageTransformer = new MessageTransformer(
      packetTransformer.outboundProtobufs$,
      packet => packetTransformer.writeInboundProtobuf(packet)
    );

    // TODO(awjin): Pass import and function registries' handler functions to
    // dispatcher.
    const dispatcher = new Dispatcher(
      messageTransformer.outboundMessages$,
      message => messageTransformer.writeInboundMessage(message),
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

    const response = await dispatcher.sendCompileRequest(request);

    if (response.getSuccess()) {
      const success = response.getSuccess()!;
      const sourceMap = success.getSourceMap();
      if (request.getSourceMap() && sourceMap === undefined) {
        throw Error('Compiler did not provide sourceMap.');
      }
      return {
        css: success.getCss(),
        loadedUrls: [], // TODO(nex3): Fill this out
        sourceMap: sourceMap ? JSON.parse(sourceMap) : undefined,
      };
    } else if (response.getFailure()) {
      throw deprotifyException(response.getFailure()!);
    } else {
      throw Error('Compiler sent empty CompileResponse.');
    }
  } finally {
    embeddedCompiler.close();
    await embeddedCompiler.exit$;
  }
}
