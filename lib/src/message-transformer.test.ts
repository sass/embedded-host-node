// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Subject, Observable} from 'rxjs';

import {expectObservableToError} from '../../test/utils';
import {MessageTransformer} from './message-transformer';
import * as proto from './vendor/embedded-protocol/embedded_sass_pb';

describe('message transformer', () => {
  let messages: MessageTransformer;

  function validInboundMessage(source: string): proto.InboundMessage {
    return new proto.InboundMessage({
      message: {
        case: 'compileRequest',
        value: new proto.InboundMessage_CompileRequest({
          input: {
            case: 'string',
            value: new proto.InboundMessage_CompileRequest_StringInput({
              source,
            }),
          },
        }),
      },
    });
  }

  describe('encode', () => {
    let encodedProtobufs: Uint8Array[];

    beforeEach(() => {
      encodedProtobufs = [];
      messages = new MessageTransformer(new Observable(), buffer =>
        encodedProtobufs.push(buffer)
      );
    });

    it('encodes an InboundMessage to buffer', () => {
      const message = validInboundMessage('a {b: c}');
      messages.writeInboundMessage(message);
      expect(encodedProtobufs).toEqual([message.toBinary()]);
    });
  });

  describe('decode', () => {
    let protobufs$: Subject<Buffer>;
    let decodedMessages: proto.OutboundMessage[];

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
          expect(decodedMessages[0].message.case).toBe('compileResponse');
          const response = decodedMessages[0].message
            .value as proto.OutboundMessage_CompileResponse;
          expect(response.result.case).toBe('success');
          expect(
            (
              response.result
                .value as proto.OutboundMessage_CompileResponse_CompileSuccess
            ).css
          ).toBe('a {b: c}');
          done();
        },
      });

      protobufs$.next(Buffer.from(message.toBinary()));
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
    });
  });
});
