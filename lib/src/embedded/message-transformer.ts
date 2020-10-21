// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Subject, Observable} from 'rxjs';
import {map} from 'rxjs/operators';

import {InboundMessage, OutboundMessage} from '../vendor/embedded_sass_pb';

export type InboundRequestType = InboundMessage.MessageCase.COMPILEREQUEST;

export type InboundRequest = InboundMessage.CompileRequest;

export type InboundResponseType =
  | InboundMessage.MessageCase.IMPORTRESPONSE
  | InboundMessage.MessageCase.FILEIMPORTRESPONSE
  | InboundMessage.MessageCase.CANONICALIZERESPONSE
  | InboundMessage.MessageCase.FUNCTIONCALLRESPONSE;

export type InboundResponse =
  | InboundMessage.ImportResponse
  | InboundMessage.FileImportResponse
  | InboundMessage.CanonicalizeResponse
  | InboundMessage.FunctionCallResponse;

export type OutboundRequestType =
  | OutboundMessage.MessageCase.IMPORTREQUEST
  | OutboundMessage.MessageCase.FILEIMPORTREQUEST
  | OutboundMessage.MessageCase.CANONICALIZEREQUEST
  | OutboundMessage.MessageCase.FUNCTIONCALLREQUEST;

export type OutboundRequest =
  | OutboundMessage.ImportRequest
  | OutboundMessage.FileImportRequest
  | OutboundMessage.CanonicalizeRequest
  | OutboundMessage.FunctionCallRequest;

export type OutboundResponseType = OutboundMessage.MessageCase.COMPILERESPONSE;

export type OutboundResponse = OutboundMessage.CompileResponse;

export type OutboundEventType = OutboundMessage.MessageCase.LOGEVENT;

export type OutboundEvent = OutboundMessage.LogEvent;

export type InboundTypedMessage = {
  payload: InboundRequest | InboundResponse;
  type: InboundRequestType | InboundResponseType;
};

export type OutboundTypedMessage = {
  payload: OutboundRequest | OutboundResponse | OutboundEvent;
  type: OutboundRequestType | OutboundResponseType | OutboundEventType;
};

/**
 * Encodes InboundTypedMessages into protocol buffers and decodes protocol
 * buffers into OutboundTypedMssages. Any Embedded Protocol violations that can
 * be detected at the message level are encapsulated here and reported as
 * errors.
 */
export class MessageTransformer {
  /**
   * The OutboundTypedMessages (decoded from protocol buffers). Throws an error
   * if a Protocol Error is detected.
   */
  readonly read$ = this.rawRead$.pipe(
    map(buffer => toOutboundTypedMessage(buffer))
  );

  /** Receives InboundTypedMessages and encodes them into protocol buffers. */
  readonly write$ = new Subject<InboundTypedMessage>();

  constructor(
    private readonly rawRead$: Observable<Buffer>,
    private readonly rawWrite$: Subject<Buffer>
  ) {
    this.write$.subscribe(message => this.rawWrite$.next(toBuffer(message)));
  }

  /** Cleans up all Observables. */
  close() {
    this.write$.complete();
  }
}

// Decodes a protocol buffer into an OutboundTypedMessage, ensuring that all
// mandatory message fields are populated. Throws if buffer cannot be decoded
// into a valid message, of if the message itself contains a Protocol Error.
function toOutboundTypedMessage(buffer: Buffer): OutboundTypedMessage {
  let message;
  try {
    message = OutboundMessage.deserializeBinary(buffer);
  } catch {
    throw compilerError('Invalid buffer.');
  }

  let payload;
  const type = message.getMessageCase();

  switch (type) {
    case OutboundMessage.MessageCase.LOGEVENT:
      payload = message.getLogevent()!;
      break;
    case OutboundMessage.MessageCase.COMPILERESPONSE: {
      if (
        message.getCompileresponse()!.getResultCase() ===
        OutboundMessage.CompileResponse.ResultCase.RESULT_NOT_SET
      ) {
        throw compilerError(
          'OutboundMessage.CompileResponse.result is not set.'
        );
      }
      payload = message.getCompileresponse()!;
      break;
    }
    case OutboundMessage.MessageCase.IMPORTREQUEST:
      payload = message.getImportrequest()!;
      break;
    case OutboundMessage.MessageCase.FILEIMPORTREQUEST:
      payload = message.getFileimportrequest()!;
      break;
    case OutboundMessage.MessageCase.CANONICALIZEREQUEST:
      payload = message.getCanonicalizerequest()!;
      break;
    case OutboundMessage.MessageCase.FUNCTIONCALLREQUEST: {
      if (
        message.getFunctioncallrequest()!.getIdentifierCase() ===
        OutboundMessage.FunctionCallRequest.IdentifierCase.IDENTIFIER_NOT_SET
      ) {
        throw compilerError(
          'OutboundMessage.FunctionCallRequest.identifier is not set.'
        );
      }
      payload = message.getFunctioncallrequest()!;
      break;
    }
    case OutboundMessage.MessageCase.ERROR:
      throw hostError(`${message.getError()!.getMessage()}`);
    case OutboundMessage.MessageCase.MESSAGE_NOT_SET: {
      throw compilerError('OutboundMessage.message is not set.');
    }
    default: {
      throw compilerError(`Unknown message type ${message.toString()}.`);
    }
  }

  return {
    payload,
    type,
  };
}

// Converts the given inbound message to a protocol buffer.
function toBuffer(message: InboundTypedMessage): Buffer {
  const inboundMessage = new InboundMessage();
  switch (message.type) {
    case InboundMessage.MessageCase.COMPILEREQUEST:
      inboundMessage.setCompilerequest(
        message.payload as InboundMessage.CompileRequest
      );
      break;
    case InboundMessage.MessageCase.IMPORTRESPONSE:
      inboundMessage.setImportresponse(
        message.payload as InboundMessage.ImportResponse
      );
      break;
    case InboundMessage.MessageCase.FILEIMPORTRESPONSE:
      inboundMessage.setFileimportresponse(
        message.payload as InboundMessage.FileImportResponse
      );
      break;
    case InboundMessage.MessageCase.CANONICALIZERESPONSE:
      inboundMessage.setCanonicalizeresponse(
        message.payload as InboundMessage.CanonicalizeResponse
      );
      break;
    case InboundMessage.MessageCase.FUNCTIONCALLRESPONSE:
      inboundMessage.setFunctioncallresponse(
        message.payload as InboundMessage.FunctionCallResponse
      );
      break;
  }
  return Buffer.from(inboundMessage.serializeBinary());
}

function hostError(message: string) {
  return Error(`Compiler reported error: ${message}`);
}

function compilerError(message: string) {
  return Error(`Compiler caused error: ${message}`);
}
