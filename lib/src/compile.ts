// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {URL} from 'url';

import {EmbeddedCompiler} from './embedded/compiler';
import {Dispatcher} from './embedded/dispatcher';
import {MessageTransformer} from './embedded/message-transformer';
import {PacketTransformer} from './embedded/packet-transformer';
import {InboundMessage, OutboundMessage} from './vendor/embedded_sass_pb';

/**
 * Creates a request for compiling a file.
 */
export function newCompileRequest(options: {
  path: string;
  sourceMap?: boolean;
}): InboundMessage.CompileRequest {
  // TODO(awjin): Support complete protocol (importers, functions, etc.)
  const request = new InboundMessage.CompileRequest();
  request.setPath(options.path);
  request.setSourceMap(!!options.sourceMap);

  return request;
}

/**
 * Creates a request for compiling a string.
 */
export function newCompileStringRequest(options: {
  source: string;
  sourceMap?: boolean;
  url?: URL;
}): InboundMessage.CompileRequest {
  // TODO(awjin): Support complete protocol (importers, functions, etc.)
  const input = new InboundMessage.CompileRequest.StringInput();
  input.setSource(options.source);
  if (options.url) input.setUrl(options.url.toString());

  const request = new InboundMessage.CompileRequest();
  request.setString(input);
  request.setSourceMap(!!options.sourceMap);

  return request;
}

/**
 * Spins up a compiler, then sends it a compile request. Returns a promise that
 * resolves with the compilation result. After resolving, shuts down the
 * compiler.
 */
export function compile(
  request: InboundMessage.CompileRequest
): Promise<OutboundMessage.CompileResponse> {
  // TODO(awjin):
  // - Accept logger, importers, and functions, then create registries for each.
  // - Populate request with importer/function IDs.
  // - Subscribe logger to dispatcher's log events.

  const embeddedCompiler = new EmbeddedCompiler();

  const packetTransformer = new PacketTransformer(
    embeddedCompiler.stdout$,
    buffer => embeddedCompiler.writeStdin(buffer)
  );

  const messageTransformer = new MessageTransformer(
    packetTransformer.outboundProtobufs$,
    packet => packetTransformer.writeInboundProtobuf(packet)
  );

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

  return dispatcher
    .sendCompileRequest(request)
    .finally(() => embeddedCompiler.close());
}
