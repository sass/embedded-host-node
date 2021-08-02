// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable, Subject} from 'rxjs';
import {map} from 'rxjs/operators';

import {compilerError, hostError} from '../utils';
import {
  InboundMessage,
  OutboundMessage,
} from '../vendor/embedded-protocol/embedded_sass_pb';

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
 * buffers into OutboundTypedMessages. Any Embedded Protocol violations that can
 * be detected at the message level are encapsulated here and reported as
 * errors.
 *
 * This transformer communicates via In/OutboundTypedMessages instead of raw
 * In/OutboundMessages in order to expose more type information to consumers.
 * This makes the stream of messages from the transformer easier to interact
 * with.
 */
export class MessageTransformer {
  // The decoded messages are written to this Subject. It is publicly exposed
  // as a readonly Observable.
  private readonly outboundMessagesInternal$ =
    new Subject<OutboundTypedMessage>();

  /**
   * The OutboundTypedMessages, decoded from protocol buffers. If any errors are
   * detected while encoding/decoding, this Observable will error out.
   */
  readonly outboundMessages$ = this.outboundMessagesInternal$.pipe();

  constructor(
    private readonly outboundProtobufs$: Observable<Buffer>,
    private readonly writeInboundProtobuf: (buffer: Buffer) => void
  ) {
    this.outboundProtobufs$
      .pipe(map(decode))
      .subscribe(this.outboundMessagesInternal$);
  }

  /**
   * Converts the inbound `message` to a protocol buffer.
   */
  writeInboundMessage(message: InboundTypedMessage): void {
    try {
      this.writeInboundProtobuf(encode(message));
    } catch (error) {
      this.outboundMessagesInternal$.error(error);
    }
  }
}

// Decodes a protobuf `buffer` into an OutboundTypedMessage, ensuring that all
// mandatory message fields are populated. Throws if `buffer` cannot be decoded
// into a valid message, or if the message itself contains a Protocol Error.
function decode(buffer: Buffer): OutboundTypedMessage {
  let message;
  try {
    message = OutboundMessage.deserializeBinary(buffer);
  } catch (error) {
    throw compilerError('Invalid buffer');
  }

  let payload;
  const type = message.getMessageCase();
  switch (type) {
    case OutboundMessage.MessageCase.LOGEVENT:
      payload = message.getLogevent();
      break;
    case OutboundMessage.MessageCase.COMPILERESPONSE:
      if (
        message.getCompileresponse()?.getResultCase() ===
        OutboundMessage.CompileResponse.ResultCase.RESULT_NOT_SET
      ) {
        throw compilerError(
          'OutboundMessage.CompileResponse.result is not set'
        );
      }
      payload = message.getCompileresponse();
      break;
    case OutboundMessage.MessageCase.IMPORTREQUEST:
      payload = message.getImportrequest();
      break;
    case OutboundMessage.MessageCase.FILEIMPORTREQUEST:
      payload = message.getFileimportrequest();
      break;
    case OutboundMessage.MessageCase.CANONICALIZEREQUEST:
      payload = message.getCanonicalizerequest();
      break;
    case OutboundMessage.MessageCase.FUNCTIONCALLREQUEST:
      if (
        message.getFunctioncallrequest()?.getIdentifierCase() ===
        OutboundMessage.FunctionCallRequest.IdentifierCase.IDENTIFIER_NOT_SET
      ) {
        throw compilerError(
          'OutboundMessage.FunctionCallRequest.identifier is not set'
        );
      }
      payload = message.getFunctioncallrequest();
      break;
    case OutboundMessage.MessageCase.ERROR:
      throw hostError(`${message.getError()?.getMessage()}`);
    case OutboundMessage.MessageCase.MESSAGE_NOT_SET:
      throw compilerError('OutboundMessage.message is not set');
    default:
      throw compilerError(`Unknown message type ${message.toString()}`);
  }

  if (!payload) throw compilerError('OutboundMessage missing payload');
  return {
    payload,
    type,
  };
}

// Encodes an InboundTypedMessage into a protocol buffer.
function encode(message: InboundTypedMessage): Buffer {
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
