// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {from, Subject, Observable} from 'rxjs';
import {InboundMessage, OutboundMessage} from '../../vendor/embedded_sass_pb';

/**
 * Encodes InboundMessages into protocol buffers and decodes protocol buffers
 * into OutboundMessages. Any Embedded Protocol violations that can be detected
 * at the message level are encapsulated here and reported as errors.
 */
export class MessageTransformer {
  // The decoded messages and errors are written to these Subjects. They are
  // publicly exposed as readonly Observables to prevent memory leaks.
  private readonly readInternal$ = new Subject<OutboundMessage>();
  private readonly errorInternal$ = new Subject<Error>();

  /** The OutboundMessages (decoded from protocol buffers). */
  readonly read$ = from(this.readInternal$);

  /** Receives InboundMessages and encodes them into protocol buffers. */
  readonly write$ = new Subject<InboundMessage>();

  /** Any errors encountered while encoding/decoding messages. */
  readonly error$ = from(this.errorInternal$);

  constructor(
    private readonly rawRead$: Observable<Buffer>,
    private readonly rawWrite$: Subject<Buffer>
  ) {
    this.rawRead$.subscribe(buffer => this.decode(buffer));
    this.write$.subscribe(message => this.encode(message));
  }

  // Decodes a buffer into an OutboundMessage.
  private decode(buffer: Buffer) {
    try {
      const message = toMessage(buffer);
      this.readInternal$.next(message);
    } catch (error) {
      this.errorInternal$.next(error);
    }
  }

  // Encodes an InboundMessage into a buffer.
  private encode(message: InboundMessage) {
    try {
      const buffer = Buffer.from(message.serializeBinary());
      this.rawWrite$.next(buffer);
    } catch (error) {
      this.errorInternal$.next(error);
    }
  }

  /** Cleans up all Observables. */
  close() {
    this.readInternal$.complete();
    this.write$.complete();
    this.errorInternal$.complete();
  }
}

// Decodes a protocol buffer into an OutboundMessage, ensuring that all
// mandatory message fields are populated. Throws if buffer cannot be decoded
// into a valid message.
function toMessage(buffer: Buffer): OutboundMessage {
  let message;
  try {
    message = OutboundMessage.deserializeBinary(buffer);
  } catch {
    throw compilerError('Invalid buffer.');
  }

  switch (message.getMessageCase()) {
    case OutboundMessage.MessageCase.ERROR:
    case OutboundMessage.MessageCase.LOGEVENT:
    case OutboundMessage.MessageCase.CANONICALIZEREQUEST:
    case OutboundMessage.MessageCase.IMPORTREQUEST:
    case OutboundMessage.MessageCase.FILEIMPORTREQUEST:
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
      break;
    }

    case OutboundMessage.MessageCase.FUNCTIONCALLREQUEST: {
      if (
        message.getFunctioncallrequest()!.getIdentifierCase() ===
        OutboundMessage.FunctionCallRequest.IdentifierCase.IDENTIFIER_NOT_SET
      ) {
        throw compilerError(
          'OutboundMessage.FunctionCallRequest.identifier is not set.'
        );
      }
      break;
    }

    case OutboundMessage.MessageCase.MESSAGE_NOT_SET: {
      throw compilerError('OutboundMessage.message is not set.');
    }

    default: {
      throw compilerError(`Unknown message type ${message.toString()}.`);
    }
  }

  return message;
}

function compilerError(message: string) {
  return new Error(`Compiler caused error: ${message}`);
}
