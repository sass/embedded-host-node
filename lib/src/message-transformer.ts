// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable, Subject} from 'rxjs';
import {map} from 'rxjs/operators';
import * as varint from 'varint';

import {compilerError} from './utils';
import {InboundMessage, OutboundMessage} from './vendor/embedded_sass_pb';

/**
 * Encodes InboundMessages into protocol buffers and decodes protocol buffers
 * into OutboundMessages.
 */
export class MessageTransformer {
  // The decoded messages are written to this Subject. It is publicly exposed
  // as a readonly Observable.
  private readonly outboundMessagesInternal$ = new Subject<
    [number, OutboundMessage]
  >();

  /**
   * The OutboundMessages, decoded from protocol buffers. If this fails to
   * decode a message, it will emit an error.
   */
  readonly outboundMessages$ = this.outboundMessagesInternal$.pipe();

  constructor(
    private readonly outboundProtobufs$: Observable<Uint8Array>,
    private readonly writeInboundProtobuf: (buffer: Uint8Array) => void
  ) {
    this.outboundProtobufs$
      .pipe(map(decode))
      .subscribe(this.outboundMessagesInternal$);
  }

  /**
   * Converts the inbound `compilationId` and `message` to a protocol buffer.
   */
  writeInboundMessage([compilationId, message]: [
    number,
    InboundMessage,
  ]): void {
    const compilationIdLength = varint.encodingLength(compilationId);
    const encodedMessage = message.toBinary();
    const buffer = new Uint8Array(compilationIdLength + encodedMessage.length);
    varint.encode(compilationId, buffer);
    buffer.set(encodedMessage, compilationIdLength);

    try {
      this.writeInboundProtobuf(buffer);
    } catch (error) {
      this.outboundMessagesInternal$.error(error);
    }
  }
}

// Decodes a protobuf `buffer` into a compilation ID and an OutboundMessage,
// ensuring that all mandatory message fields are populated. Throws if `buffer`
// cannot be decoded into a valid message, or if the message itself contains a
// Protocol Error.
function decode(buffer: Uint8Array): [number, OutboundMessage] {
  let compilationId: number;
  try {
    compilationId = varint.decode(buffer);
  } catch (error) {
    throw compilerError(`Invalid compilation ID varint: ${error}`);
  }

  try {
    return [
      compilationId,
      OutboundMessage.fromBinary(
        new Uint8Array(buffer.buffer, varint.decode.bytes)
      ),
    ];
  } catch (error) {
    throw compilerError(`Invalid protobuf: ${error}`);
  }
}
