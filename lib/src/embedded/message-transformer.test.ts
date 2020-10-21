// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {MessageTransformer} from './message-transformer';
import {Subject, Observable} from 'rxjs';
import {
  InboundMessage,
  OutboundMessage,
  ProtocolError,
} from '../vendor/embedded_sass_pb';

describe('message transformer', () => {
  describe('encode', () => {
    let encoded$: Subject<Buffer>;
    let transformer: MessageTransformer;

    beforeEach(() => {
      encoded$ = new Subject<Buffer>();
      transformer = new MessageTransformer(new Observable<Buffer>(), encoded$);
    });

    afterEach(() => {
      encoded$.complete();
      transformer.close();
    });

    it('encodes an InboundMessage to buffer', async done => {
      const message = validInboundMessage('a {b: c}');
      encoded$.subscribe(buffer => {
        expect(buffer).toEqual(Buffer.from(message.serializeBinary()));
        done();
      });
      transformer.write$.next({
        payload: message.getCompilerequest()!,
        type: InboundMessage.MessageCase.COMPILEREQUEST,
      });
    });
  });

  describe('decode', () => {
    let toDecode$: Subject<Buffer>;
    let transformer: MessageTransformer;

    beforeEach(() => {
      toDecode$ = new Subject<Buffer>();
      transformer = new MessageTransformer(toDecode$, new Subject<Buffer>());
    });

    afterEach(() => {
      toDecode$.complete();
      transformer.close();
    });

    it('decodes buffer to OutboundMessage', async done => {
      const message = validInboundMessage('a {b: c}');
      transformer.read$.subscribe(message => {
        const response = message.payload as OutboundMessage.CompileResponse;
        expect(response.getSuccess()?.getCss()).toBe('a {b: c}');
        const type = message.type;
        expect(type).toEqual(OutboundMessage.MessageCase.COMPILERESPONSE);
        done();
      });
      toDecode$.next(Buffer.from(message.serializeBinary()));
    });

    describe('protocol error', () => {
      it('fails on invalid buffer', async done => {
        expectError(
          transformer,
          'Compiler caused error: Invalid buffer.',
          done
        );
        toDecode$.next(Buffer.from([-1]));
      });

      it('fails on empty message', async done => {
        expectError(
          transformer,
          'Compiler caused error: OutboundMessage.message is not set.',
          done
        );
        toDecode$.next(Buffer.from(new OutboundMessage().serializeBinary()));
      });

      it('fails on compile response with missing result', async done => {
        const response = new OutboundMessage.CompileResponse();
        const message = new OutboundMessage();
        message.setCompileresponse(response);
        expectError(
          transformer,
          'Compiler caused error: OutboundMessage.CompileResponse.result is not set.',
          done
        );
        toDecode$.next(Buffer.from(message.serializeBinary()));
      });

      it('fails on function call request with missing identifier', async done => {
        const request = new OutboundMessage.FunctionCallRequest();
        const message = new OutboundMessage();
        message.setFunctioncallrequest(request);
        expectError(
          transformer,
          'Compiler caused error: OutboundMessage.FunctionCallRequest.identifier is not set.',
          done
        );
        toDecode$.next(Buffer.from(message.serializeBinary()));
      });

      it('fails if message contains a protocol error', async done => {
        const errorMessage = 'sad';
        const error = new ProtocolError();
        error.setMessage(errorMessage);
        const message = new OutboundMessage();
        message.setError(error);
        expectError(
          transformer,
          `Compiler reported error: ${errorMessage}`,
          done
        );
        toDecode$.next(Buffer.from(message.serializeBinary()));
      });
    });
  });
});

function validInboundMessage(source: string): InboundMessage {
  const input = new InboundMessage.CompileRequest.StringInput();
  input.setSource(source);
  const request = new InboundMessage.CompileRequest();
  request.setString(input);
  const message = new InboundMessage();
  message.setCompilerequest(request);
  return message;
}

function expectError(
  transformer: MessageTransformer,
  errorMessage: string,
  done: Function
) {
  transformer.read$.subscribe(
    () => fail('expected error'),
    error => {
      expect(error.message).toEqual(errorMessage);
      done();
    }
  );
}
