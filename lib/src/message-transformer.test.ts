// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable, Subject, Subscription} from 'rxjs';
import * as varint from 'varint';
import {create, toBinary} from '@bufbuild/protobuf';

import {expectObservableToError} from '../../test/utils';
import {MessageTransformer} from './message-transformer';
import * as proto from './vendor/embedded_sass_pb';

describe('message transformer', () => {
  let messages: MessageTransformer;

  function validInboundMessage(source: string): proto.InboundMessage {
    return create(proto.InboundMessageSchema, {
      message: {
        case: 'compileRequest',
        value: {
          input: {
            case: 'string',
            value: {
              source,
            },
          },
        },
      },
    });
  }

  describe('encode', () => {
    let encodedProtobufs: Uint8Array[];

    beforeEach(() => {
      encodedProtobufs = [];
      messages = new MessageTransformer(new Observable(), buffer =>
        encodedProtobufs.push(buffer),
      );
    });

    it('encodes an InboundMessage to buffer', () => {
      const message = validInboundMessage('a {b: c}');
      messages.writeInboundMessage([1234, message]);
      expect(encodedProtobufs).toEqual([
        Uint8Array.from([
          ...varint.encode(1234),
          ...toBinary(proto.InboundMessageSchema, message),
        ]),
      ]);
    });
  });

  describe('decode', () => {
    let protobufs$: Subject<Uint8Array>;
    let decodedMessages: Array<[number, proto.OutboundMessage]>;

    beforeEach(() => {
      protobufs$ = new Subject();
      messages = new MessageTransformer(protobufs$, () => {});
      decodedMessages = [];
    });

    it('decodes buffer to OutboundMessage', done => {
      messages.outboundMessages$.subscribe({
        next: message => decodedMessages.push(message),
        complete: () => {
          expect(decodedMessages.length).toBe(1);
          const [id, message] = decodedMessages[0];
          expect(id).toBe(1234);
          expect(message.message.case).toBe('compileResponse');
          const response = message.message
            .value as proto.OutboundMessage_CompileResponse;
          expect(response.result.case).toBe('success');
          expect(
            (
              response.result
                .value as proto.OutboundMessage_CompileResponse_CompileSuccess
            ).css,
          ).toBe('a {b: c}');
          done();
        },
      });

      protobufs$.next(
        Uint8Array.from([
          ...varint.encode(1234),
          ...toBinary(
            proto.InboundMessageSchema,
            validInboundMessage('a {b: c}'),
          ),
        ]),
      );
      protobufs$.complete();
    });

    describe('protocol error', () => {
      it('fails on invalid buffer', done => {
        expectObservableToError(
          messages.outboundMessages$,
          'Compiler caused error: Invalid compilation ID varint: RangeError: ' +
            'Could not decode varint.',
          done,
        );

        protobufs$.next(Buffer.from([-1]));
      });
    });
  });

  describe('outboundMessagesFor', () => {
    let protobufs$: Subject<Uint8Array>;

    beforeEach(() => {
      protobufs$ = new Subject();
      messages = new MessageTransformer(protobufs$, () => {});
    });

    function sendLogEvent(compilationId: number, text: string): void {
      protobufs$.next(
        Uint8Array.from([
          ...varint.encode(compilationId),
          ...toBinary(
            proto.OutboundMessageSchema,
            create(proto.OutboundMessageSchema, {
              message: {case: 'logEvent', value: {message: text}},
            }),
          ),
        ]),
      );
    }

    function collect(compilationId: number): {
      texts: string[];
      subscription: Subscription;
    } {
      const texts: string[] = [];
      const subscription = messages
        .outboundMessagesFor(compilationId)
        .subscribe(message =>
          texts.push(
            (message.message.value as proto.OutboundMessage_LogEvent).message,
          ),
        );
      return {texts, subscription};
    }

    it("emits only the compilation's messages", () => {
      const first = collect(1);
      const second = collect(2);

      sendLogEvent(1, 'a');
      sendLogEvent(2, 'b');
      sendLogEvent(3, 'c');
      sendLogEvent(1, 'd');

      expect(first.texts).toEqual(['a', 'd']);
      expect(second.texts).toEqual(['b']);
    });

    it('routes a reused compilation ID to its new subscriber', () => {
      const previous = collect(1);
      sendLogEvent(1, 'a');
      previous.subscription.unsubscribe();

      const next = collect(1);
      sendLogEvent(1, 'b');

      expect(previous.texts).toEqual(['a']);
      expect(next.texts).toEqual(['b']);
    });

    it('errors every compilation when a message fails to decode', () => {
      const errors: unknown[] = [];
      for (const compilationId of [1, 2]) {
        messages
          .outboundMessagesFor(compilationId)
          .subscribe({error: error => errors.push(error)});
      }

      protobufs$.next(Buffer.from([-1]));
      messages
        .outboundMessagesFor(3)
        .subscribe({error: error => errors.push(error)});

      expect(errors).toHaveLength(3);
    });

    it('completes every compilation when the compiler exits', () => {
      let completed = 0;
      for (const compilationId of [1, 2]) {
        messages
          .outboundMessagesFor(compilationId)
          .subscribe({complete: () => completed++});
      }

      protobufs$.complete();
      messages.outboundMessagesFor(3).subscribe({complete: () => completed++});

      expect(completed).toBe(3);
    });
  });
});
