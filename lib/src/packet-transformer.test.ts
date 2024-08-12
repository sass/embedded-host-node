// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable, Subject} from 'rxjs';

import {PacketTransformer} from './packet-transformer';

describe('packet transformer', () => {
  let packets: PacketTransformer;

  describe('encode', () => {
    let encodedBuffers: Buffer[];

    beforeEach(() => {
      encodedBuffers = [];
      packets = new PacketTransformer(new Observable(), buffer =>
        encodedBuffers.push(buffer)
      );
    });

    it('encodes an empty message', () => {
      packets.writeInboundProtobuf(Buffer.from([]));

      expect(encodedBuffers).toEqual([Buffer.from([0])]);
    });

    it('encodes a message of length 1', () => {
      packets.writeInboundProtobuf(Buffer.from([123]));

      expect(encodedBuffers).toEqual([Buffer.from([1, 123])]);
    });

    it('encodes a message of length greater than 256', () => {
      packets.writeInboundProtobuf(Buffer.alloc(300, 1));

      expect(encodedBuffers).toEqual([
        Buffer.from([172, 2, ...new Array(300).fill(1)]),
      ]);
    });

    it('encodes multiple messages', () => {
      packets.writeInboundProtobuf(Buffer.from([10]));
      packets.writeInboundProtobuf(Buffer.from([20, 30]));
      packets.writeInboundProtobuf(Buffer.from([40, 50, 60]));

      expect(encodedBuffers).toEqual([
        Buffer.from([1, 10]),
        Buffer.from([2, 20, 30]),
        Buffer.from([3, 40, 50, 60]),
      ]);
    });
  });

  describe('decode', () => {
    let rawBuffers$: Subject<Buffer>;

    function expectDecoding(expected: Buffer[], done: () => void): void {
      const actual: Buffer[] = [];
      packets.outboundProtobufs$.subscribe({
        next: protobuf => actual.push(protobuf),
        error: () => fail('expected correct decoding'),
        complete: () => {
          expect(actual).toEqual(expected);
          done();
        },
      });
    }

    beforeEach(() => {
      rawBuffers$ = new Subject();
      packets = new PacketTransformer(rawBuffers$, () => {});
    });

    describe('empty message', () => {
      it('decodes a single chunk', done => {
        expectDecoding([Buffer.from([])], done);

        rawBuffers$.next(Buffer.from([0]));
        rawBuffers$.complete();
      });

      it('decodes a chunk that contains more data', done => {
        expectDecoding([Buffer.from([]), Buffer.from([100])], done);

        rawBuffers$.next(Buffer.from([0, 1, 100]));
        rawBuffers$.complete();
      });
    });

    describe('longer message', () => {
      it('decodes a single chunk', done => {
        expectDecoding([Buffer.from(Buffer.from([1, 2, 3, 4]))], done);

        rawBuffers$.next(Buffer.from([4, 1, 2, 3, 4]));
        rawBuffers$.complete();
      });

      it('decodes multiple chunks', done => {
        expectDecoding([Buffer.alloc(300, 1)], done);

        rawBuffers$.next(Buffer.from([172]));
        rawBuffers$.next(Buffer.from([2, 1]));
        rawBuffers$.next(Buffer.from(Buffer.alloc(299, 1)));
        rawBuffers$.complete();
      });

      it('decodes one chunk per byte', done => {
        expectDecoding([Buffer.alloc(300, 1)], done);

        for (const byte of [172, 2, ...Buffer.alloc(300, 1)]) {
          rawBuffers$.next(Buffer.from([byte]));
        }
        rawBuffers$.complete();
      });

      it('decodes a chunk that contains more data', done => {
        expectDecoding([Buffer.from([1, 2, 3, 4]), Buffer.from([0])], done);

        rawBuffers$.next(Buffer.from([4, 1, 2, 3, 4, 1, 0]));
        rawBuffers$.complete();
      });

      it('decodes a full chunk of length greater than 256', done => {
        expectDecoding([Buffer.from(new Array(300).fill(1))], done);

        rawBuffers$.next(Buffer.from([172, 2, ...new Array(300).fill(1)]));
        rawBuffers$.complete();
      });
    });

    describe('multiple messages', () => {
      it('decodes a single chunk', done => {
        expectDecoding(
          [Buffer.from([1, 2, 3, 4]), Buffer.from([101, 102])],
          done
        );

        rawBuffers$.next(Buffer.from([4, 1, 2, 3, 4, 2, 101, 102]));
        rawBuffers$.complete();
      });

      it('decodes multiple chunks', done => {
        expectDecoding([Buffer.from([1, 2, 3, 4]), Buffer.alloc(300, 1)], done);

        rawBuffers$.next(Buffer.from([4]));
        rawBuffers$.next(Buffer.from([1, 2, 3, 4, 172]));
        rawBuffers$.next(Buffer.from([2, ...Buffer.alloc(300, 1)]));
        rawBuffers$.complete();
      });

      it('decodes one chunk per byte', done => {
        expectDecoding([Buffer.from([1, 2, 3, 4]), Buffer.alloc(300, 1)], done);

        for (const byte of [4, 1, 2, 3, 4, 172, 2, ...Buffer.alloc(300, 1)]) {
          rawBuffers$.next(Buffer.from([byte]));
        }
        rawBuffers$.complete();
      });
    });
  });
});
