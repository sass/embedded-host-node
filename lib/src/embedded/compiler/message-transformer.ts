// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {from, Subject, Observable} from 'rxjs';
import {
  InboundMessage,
  OutboundMessage,
  ProtocolError,
} from '../../vendor/embedded_sass_pb';
import {protocolError} from './utils';

/**
 * Encodes InboundMessages into protocol buffers and decodes OutboundMessages
 * from protocol buffers. Any Embedded Protocol violations that can be detected
 * at the message level are encapsulated here and reported as ProtocolErrors.
 */
export class MessageTransformer {
  // The decoded messages and protocol errors are written to these Subjects.
  // They are publicly exposed as readonly Observables to prevent memory leaks.
  private readonly readInternal$ = new Subject<OutboundMessage>();
  private readonly protocolErrorInternal$ = new Subject<ProtocolError>();

  /**
   * The OutboundMessages (decoded from protocol buffers). These are guaranteed
   * to be valid, since invalid messages are reported as ProtocolErrors.
   */
  readonly read$ = from(this.readInternal$);

  /**
   * Receives InboundMessages and encodes them into protocol buffers. Errors
   * encountered during encoding are reported as ProtocolErrors.
   */
  readonly write$ = new Subject<InboundMessage>();

  /** The ProtocolErrors encountered while encoding/decoding messages. */
  readonly protocolError$ = from(this.protocolErrorInternal$);

  constructor(
    private readonly rawRead$: Observable<Buffer>,
    private readonly rawWrite$: Subject<Buffer>
  ) {
    this.rawRead$.subscribe(buffer => this.decode(buffer));
    this.write$.subscribe(message => this.encode(message));
  }

  // Decodes a buffer into an OutboundMessage.
  private decode(buffer: Buffer) {
    let message;
    try {
      message = toMessage(buffer);
    } catch (error) {
      this.protocolErrorInternal$.next(error);
    }
    this.readInternal$.next(message);
  }

  // Encodes an InboundMessage into a protocol buffer.
  private encode(message: InboundMessage) {
    let buffer;
    try {
      buffer = toBuffer(message);
    } catch (error) {
      this.protocolErrorInternal$.next(error);
    }
    this.rawWrite$.next(buffer);
  }

  /** Cleans up all Observables. */
  close() {
    this.readInternal$.complete();
    this.write$.complete();
    this.protocolErrorInternal$.complete();
  }
}

// Encodes an InboundMessage into a protocol buffer. Throws a ProtocolError
// if any errors are encountered.
function toBuffer(message: InboundMessage): Buffer {
  try {
    return Buffer.from(message.serializeBinary());
  } catch (error) {
    throw protocolError(
      ProtocolError.ErrorType.INTERNAL,
      'Could not serialize buffer'
    );
  }
}

// Decodes an OutboundMessage from a protocol buffer. Throws a ProtocolError
// if any errors are encountered.
function toMessage(buffer: Buffer): OutboundMessage {
  let message;

  try {
    message = OutboundMessage.deserializeBinary(buffer);
  } catch (error) {
    throw protocolError(ProtocolError.ErrorType.PARSE, 'Invalid buffer');
  }

  // Ensure that the InboundMessage contains a valid message, and that all
  // mandatory fields are populated.
  switch (message.getMessageCase()) {
    case OutboundMessage.MessageCase.COMPILERESPONSE: {
      const response = message.getCompileresponse()!;
      if (!response.getId()) {
        throw protocolError(
          ProtocolError.ErrorType.PARAMS,
          'OutboundMessage.CompileResponse.id is not set'
        );
      }
      if (
        response.getResultCase() ===
        OutboundMessage.CompileResponse.ResultCase.RESULT_NOT_SET
      ) {
        throw protocolError(
          ProtocolError.ErrorType.PARAMS,
          'OutboundMessage.CompileResponse.result is not set'
        );
      }
      break;
    }

    case OutboundMessage.MessageCase.LOGEVENT: {
      const event = message.getLogevent()!;
      if (!event.getCompilationId()) {
        throw protocolError(
          ProtocolError.ErrorType.PARAMS,
          'OutboundMessage.LogEvent.compilationId is not set'
        );
      }
      break;
    }

    case OutboundMessage.MessageCase.CANONICALIZEREQUEST: {
      const request = message.getCanonicalizerequest()!;
      if (!request.getCompilationId()) {
        throw protocolError(
          ProtocolError.ErrorType.PARAMS,
          'OutboundMessage.CanonicalizeRequest.compilationId is not set'
        );
      }
      if (!request.getImporterId()) {
        throw protocolError(
          ProtocolError.ErrorType.PARAMS,
          'OutboundMessage.CanonicalizeRequest.importerId is not set'
        );
      }
      break;
    }

    case OutboundMessage.MessageCase.IMPORTREQUEST: {
      const request = message.getImportrequest()!;
      if (!request.getCompilationId()) {
        throw protocolError(
          ProtocolError.ErrorType.PARAMS,
          'OutboundMessage.ImportRequest.compilationId is not set'
        );
      }
      if (!request.getImporterId()) {
        throw protocolError(
          ProtocolError.ErrorType.PARAMS,
          'OutboundMessage.ImportRequest.importerId is not set'
        );
      }
      break;
    }

    case OutboundMessage.MessageCase.FILEIMPORTREQUEST: {
      const request = message.getFileimportrequest()!;
      if (!request.getCompilationId()) {
        throw protocolError(
          ProtocolError.ErrorType.PARAMS,
          'OutboundMessage.FileImportRequest.compilationId is not set'
        );
      }
      if (!request.getImporterId()) {
        throw protocolError(
          ProtocolError.ErrorType.PARAMS,
          'OutboundMessage.FileImportRequest.importerId is not set'
        );
      }
      break;
    }

    case OutboundMessage.MessageCase.FUNCTIONCALLREQUEST: {
      const request = message.getFunctioncallrequest()!;
      if (!request.getCompilationId()) {
        throw protocolError(
          ProtocolError.ErrorType.PARAMS,
          'OutboundMessage.FunctionCallRequest.compilationId is not set'
        );
      }
      if (
        request.getIdentifierCase() ===
        OutboundMessage.FunctionCallRequest.IdentifierCase.IDENTIFIER_NOT_SET
      ) {
        throw protocolError(
          ProtocolError.ErrorType.PARAMS,
          'OutboundMessage.FunctionCallRequest.identifier is not set'
        );
      }
      break;
    }

    case OutboundMessage.MessageCase.MESSAGE_NOT_SET: {
      throw protocolError(
        ProtocolError.ErrorType.PARSE,
        'OutboundMessage.message is not set.'
      );
    }

    default: {
      throw protocolError(
        ProtocolError.ErrorType.PARSE,
        `Unknown message type: ${message.toString()}`
      );
    }
  }

  return message;
}
