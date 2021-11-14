// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {RawSourceMap} from 'source-map-js';
import {URL} from 'url';

import {EmbeddedCompiler} from './embedded-compiler/compiler';
import {PacketTransformer} from './embedded-compiler/packet-transformer';
import {MessageTransformer} from './embedded-protocol/message-transformer';
import {Dispatcher} from './embedded-protocol/dispatcher';
import {deprotifyException} from './embedded-protocol/utils';
import * as proto from './vendor/embedded-protocol/embedded_sass_pb';

export type Syntax = 'scss' | 'indented' | 'css';

/**
 * Compiles a path and returns the resulting css. Throws a SassException if the
 * compilation failed.
 */
export async function compile(options: {
  path: string;
  sourceMap?: (sourceMap: RawSourceMap) => void;
  includePaths?: string[];
}): Promise<string> {
  // TODO(awjin): Create logger, importer, function registries.

  const request = newCompileRequest({
    path: options.path,
    sourceMap: !!options.sourceMap,
    includePaths: options.includePaths ?? [],
  });

  const response = await compileRequest(request);
  if (options.sourceMap) {
    options.sourceMap(response.sourceMap!);
  }

  return response.css;
}

/**
 * Compiles a string and returns the resulting css. Throws a SassException if
 * the compilation failed.
 */
export async function compileString(options: {
  source: string;
  sourceMap?: (sourceMap: RawSourceMap) => void;
  url?: URL | string;
  syntax?: Syntax;
  includePaths?: string[];
}): Promise<string> {
  // TODO(awjin): Create logger, importer, function registries.

  const request = newCompileStringRequest({
    source: options.source,
    sourceMap: !!options.sourceMap,
    url: options.url instanceof URL ? options.url.toString() : options.url,
    syntax: options.syntax ?? 'scss',
    includePaths: options.includePaths ?? [],
  });

  const response = await compileRequest(request);
  if (options.sourceMap) {
    options.sourceMap(response.sourceMap!);
  }
  return response.css;
}

// Creates a request for compiling a file.
function newCompileRequest(options: {
  path: string;
  sourceMap: boolean;
  includePaths: string[];
}): proto.InboundMessage.CompileRequest {
  // TODO(awjin): Populate request with importer/function IDs.

  const request = new proto.InboundMessage.CompileRequest();
  request.setPath(options.path);
  request.setSourceMap(options.sourceMap);

  for (const path of options.includePaths) {
    const importer = new proto.InboundMessage.CompileRequest.Importer();
    importer.setPath(path);
    request.addImporters(importer);
  }

  return request;
}

// Creates a request for compiling a string.
function newCompileStringRequest(options: {
  source: string;
  sourceMap: boolean;
  url?: string;
  syntax: Syntax;
  includePaths: string[];
}): proto.InboundMessage.CompileRequest {
  // TODO(awjin): Populate request with importer/function IDs.

  const input = new proto.InboundMessage.CompileRequest.StringInput();
  input.setSource(options.source);

  if (options.syntax === 'scss') {
    input.setSyntax(proto.Syntax['SCSS']);
  } else if (options.syntax === 'indented') {
    input.setSyntax(proto.Syntax['INDENTED']);
  } else if (options.syntax === 'css') {
    input.setSyntax(proto.Syntax['CSS']);
  }

  if (options.url) input.setUrl(options.url.toString());

  const request = new proto.InboundMessage.CompileRequest();
  request.setString(input);
  request.setSourceMap(options.sourceMap);

  for (const path of options.includePaths) {
    const importer = new proto.InboundMessage.CompileRequest.Importer();
    importer.setPath(path);
    request.addImporters(importer);
  }

  return request;
}

// Spins up a compiler, then sends it a compile request. Returns a promise that
// resolves with the CompileResult. Throws if there were any protocol or
// compilation errors. Shuts down the compiler after compilation.
async function compileRequest(
  request: proto.InboundMessage.CompileRequest
): Promise<{
  css: string;
  sourceMap?: RawSourceMap;
}> {
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
