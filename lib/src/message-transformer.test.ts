// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Subject, Observable} from 'rxjs';

import {expectObservableToError} from '../../test/utils';
import {MessageTransformer, OutboundTypedMessage} from './message-transformer';
import {
  InboundMessage,
  OutboundMessage,
  ProtocolError,
} from './vendor/embedded-protocol/embedded_sass_pb';

describe('message transformer', () => {
  let messages: MessageTransformer;

  function validInboundMessage(source: string): InboundMessage {
    const input = new InboundMessage.CompileRequest.StringInput();
    input.setSource(source);
    const request = new InboundMessage.CompileRequest();
    request.setString(input);
    const message = new InboundMessage();
    message.setCompileRequest(request);
    return message;
  }

  describe('encode', () => {
    let encodedProtobufs: Buffer[];

    beforeEach(() => {
      encodedProtobufs = [];
      messages = new MessageTransformer(new Observable(), buffer =>
        encodedProtobufs.push(buffer)
      );
    });

    it('encodes an InboundMessage to buffer', () => {
      const message = validInboundMessage('a {b: c}');

      messages.writeInboundMessage({
        payload: message.getCompileRequest()!,
        type: InboundMessage.MessageCase.COMPILE_REQUEST,
      });

      expect(encodedProtobufs).toEqual([
        Buffer.from(message.serializeBinary()),
      ]);
    });
  });

  describe('decode', () => {
    let protobufs$: Subject<Buffer>;
    let decodedMessages: OutboundTypedMessage[];

    beforeEach(() => {
      protobufs$ = new Subject();
      messages = new MessageTransformer(protobufs$, () => {});
      decodedMessages = [];
    });

    it('decodes buffer to OutboundMessage', done => {
      const message = validInboundMessage('a {b: c}');

      messages.outboundMessages$.subscribe({
        next: message => decodedMessages.push(message),
        complete: () => {
          expect(decodedMessages.length).toBe(1);
          const response = decodedMessages[0]
            .payload as OutboundMessage.CompileResponse;
          expect(response.getSuccess()?.getCss()).toBe('a {b: c}');
          const type = decodedMessages[0].type;
          expect(type).toEqual(OutboundMessage.MessageCase.COMPILE_RESPONSE);
          done();
        },
      });

      protobufs$.next(Buffer.from(message.serializeBinary()));
      protobufs$.complete();
    });

    describe('protocol error', () => {
      it('fails on invalid buffer', done => {
        expectObservableToError(
          messages.outboundMessages$,
          'Compiler caused error: Invalid buffer.',
          done
        );

        protobufs$.next(Buffer.from([-1]));
      });

      it('fails on empty message', done => {
        expectObservableToError(
          messages.outboundMessages$,
          'Compiler caused error: OutboundMessage.message is not set.',
          done
        );

        protobufs$.next(Buffer.from(new OutboundMessage().serializeBinary()));
      });

      it('fails on compile response with missing result', done => {
        expectObservableToError(
          messages.outboundMessages$,
          'Compiler caused error: OutboundMessage.CompileResponse.result is not set.',
          done
        );

        const response = new OutboundMessage.CompileResponse();
        const message = new OutboundMessage();
        message.setCompileResponse(response);
        protobufs$.next(Buffer.from(message.serializeBinary()));
      });

      it('fails on function call request with missing identifier', done => {
        expectObservableToError(
          messages.outboundMessages$,
          'Compiler caused error: OutboundMessage.FunctionCallRequest.identifier is not set.',
          done
        );

        const request = new OutboundMessage.FunctionCallRequest();
        const message = new OutboundMessage();
        message.setFunctionCallRequest(request);
        protobufs$.next(Buffer.from(message.serializeBinary()));
      });

      it('fails if message contains a protocol error', done => {
        const errorMessage = 'sad';
        expectObservableToError(
          messages.outboundMessages$,
          `Compiler reported error: ${errorMessage}.`,
          done
        );

        const error = new ProtocolError();
        error.setMessage(errorMessage);
        const message = new OutboundMessage();
        message.setError(error);
        protobufs$.next(Buffer.from(message.serializeBinary()));
      });
    });
  });
});
