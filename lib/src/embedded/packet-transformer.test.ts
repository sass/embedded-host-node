// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Subject, Observable} from 'rxjs';

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

    it('encodes an empty message', async () => {
      packets.writeInboundProtobuf(Buffer.from([]));
      expect(encodedBuffers).toEqual([Buffer.from([0, 0, 0, 0])]);
    });

    it('encodes a message of length 1', async () => {
      packets.writeInboundProtobuf(Buffer.from([123]));
      expect(encodedBuffers).toEqual([Buffer.from([1, 0, 0, 0, 123])]);
    });

    it('encodes a message of length greater than 256', async () => {
      packets.writeInboundProtobuf(Buffer.alloc(300, 1));
      expect(encodedBuffers).toEqual([
        Buffer.from([44, 1, 0, 0, ...new Array(300).fill(1)]),
      ]);
    });

    it('encodes multiple messages', async () => {
      packets.writeInboundProtobuf(Buffer.from([10]));
      packets.writeInboundProtobuf(Buffer.from([20, 30]));
      packets.writeInboundProtobuf(Buffer.from([40, 50, 60]));
      expect(encodedBuffers).toEqual([
        Buffer.from([1, 0, 0, 0, 10]),
        Buffer.from([2, 0, 0, 0, 20, 30]),
        Buffer.from([3, 0, 0, 0, 40, 50, 60]),
      ]);
    });
  });

  describe('decode', () => {
    let rawBuffers$: Subject<Buffer>;
    let decodedProtobufs: Buffer[];

    beforeEach(() => {
      rawBuffers$ = new Subject();
      packets = new PacketTransformer(rawBuffers$, () => {});
      decodedProtobufs = [];
    });

    describe('empty message', () => {
      it('decodes a single chunk', async done => {
        packets.outboundProtobufs$.subscribe(
          protobuf => decodedProtobufs.push(protobuf),
          () => {},
          () => {
            expect(decodedProtobufs).toEqual([Buffer.from([])]);
            done();
          }
        );
        rawBuffers$.next(Buffer.from([0, 0, 0, 0]));
        rawBuffers$.complete();
      });

      it('decodes multiple chunks', async done => {
        packets.outboundProtobufs$.subscribe(
          protobuf => decodedProtobufs.push(protobuf),
          () => {},
          () => {
            expect(decodedProtobufs).toEqual([Buffer.from([])]);
            done();
          }
        );
        rawBuffers$.next(Buffer.from([0, 0]));
        rawBuffers$.next(Buffer.from([0, 0]));
        rawBuffers$.complete();
      });

      it('decodes one chunk per byte', async done => {
        packets.outboundProtobufs$.subscribe(
          protobuf => decodedProtobufs.push(protobuf),
          () => {},
          () => {
            expect(decodedProtobufs).toEqual([Buffer.from([])]);
            done();
          }
        );
        rawBuffers$.next(Buffer.from([0]));
        rawBuffers$.next(Buffer.from([0]));
        rawBuffers$.next(Buffer.from([0]));
        rawBuffers$.next(Buffer.from([0]));
        rawBuffers$.complete();
      });

      it('decodes a chunk that contains more data', async done => {
        packets.outboundProtobufs$.subscribe(
          protobuf => decodedProtobufs.push(protobuf),
          () => {},
          () => {
            expect(decodedProtobufs).toEqual([
              Buffer.from([]),
              Buffer.from([100]),
            ]);
            done();
          }
        );
        rawBuffers$.next(Buffer.from([0, 0, 0, 0, 1, 0, 0, 0, 100]));
        rawBuffers$.complete();
      });
    });

    describe('longer message', () => {
      it('decodes a single chunk', async done => {
        packets.outboundProtobufs$.subscribe(
          protobuf => decodedProtobufs.push(protobuf),
          () => {},
          () => {
            expect(decodedProtobufs).toEqual([Buffer.from([1, 2, 3, 4])]);
            done();
          }
        );
        rawBuffers$.next(Buffer.from([4, 0, 0, 0, 1, 2, 3, 4]));
        rawBuffers$.complete();
      });

      it('decodes multiple chunks', async done => {
        packets.outboundProtobufs$.subscribe(
          protobuf => decodedProtobufs.push(protobuf),
          () => {},
          () => {
            expect(decodedProtobufs).toEqual([Buffer.from([1, 2, 3, 4])]);
            done();
          }
        );
        rawBuffers$.next(Buffer.from([4, 0]));
        rawBuffers$.next(Buffer.from([0, 0, 1, 2]));
        rawBuffers$.next(Buffer.from([3, 4]));
        rawBuffers$.complete();
      });

      it('decodes one chunk per byte', async done => {
        packets.outboundProtobufs$.subscribe(
          protobuf => decodedProtobufs.push(protobuf),
          () => {},
          () => {
            expect(decodedProtobufs).toEqual([Buffer.from([1, 2, 3, 4])]);
            done();
          }
        );
        for (const byte of [4, 0, 0, 0, 1, 2, 3, 4]) {
          rawBuffers$.next(Buffer.from([byte]));
        }
        rawBuffers$.complete();
      });

      it('decodes a chunk that contains more data', async done => {
        packets.outboundProtobufs$.subscribe(
          protobuf => decodedProtobufs.push(protobuf),
          () => {},
          () => {
            expect(decodedProtobufs).toEqual([Buffer.from([1, 2, 3, 4])]);
            done();
          }
        );
        rawBuffers$.next(Buffer.from([4, 0, 0, 0, 1, 2, 3, 4, 1, 0, 0, 0]));
        rawBuffers$.complete();
      });

      it('decodes a chunk of length greater than 256', async done => {
        packets.outboundProtobufs$.subscribe(
          protobuf => decodedProtobufs.push(protobuf),
          () => {},
          () => {
            expect(decodedProtobufs).toEqual([
              Buffer.from(new Array(300).fill(1)),
            ]);
            done();
          }
        );
        rawBuffers$.next(Buffer.from([44, 1, 0, 0, ...new Array(300).fill(1)]));
        rawBuffers$.complete();
      });
    });

    describe('multiple messages', () => {
      it('decodes a single chunk', async done => {
        packets.outboundProtobufs$.subscribe(
          protobuf => decodedProtobufs.push(protobuf),
          () => {},
          () => {
            expect(decodedProtobufs).toEqual([
              Buffer.from([1, 2, 3, 4]),
              Buffer.from([101, 102]),
            ]);
            done();
          }
        );
        rawBuffers$.next(
          Buffer.from([4, 0, 0, 0, 1, 2, 3, 4, 2, 0, 0, 0, 101, 102])
        );
        rawBuffers$.complete();
      });

      it('decodes multiple chunks', async done => {
        packets.outboundProtobufs$.subscribe(
          protobuf => decodedProtobufs.push(protobuf),
          () => {},
          () => {
            expect(decodedProtobufs).toEqual([
              Buffer.from([1, 2, 3, 4]),
              Buffer.from([101, 102]),
            ]);
            done();
          }
        );
        rawBuffers$.next(Buffer.from([4, 0]));
        rawBuffers$.next(Buffer.from([0, 0, 1, 2, 3, 4, 2, 0]));
        rawBuffers$.next(Buffer.from([0, 0, 101, 102]));
        rawBuffers$.complete();
      });

      it('decodes one chunk per byte', async done => {
        packets.outboundProtobufs$.subscribe(
          protobuf => decodedProtobufs.push(protobuf),
          () => {},
          () => {
            expect(decodedProtobufs).toEqual([
              Buffer.from([1, 2, 3, 4]),
              Buffer.from([101, 102]),
            ]);
            done();
          }
        );
        for (const byte of [4, 0, 0, 0, 1, 2, 3, 4, 2, 0, 0, 0, 101, 102]) {
          rawBuffers$.next(Buffer.from([byte]));
        }
        rawBuffers$.complete();
      });
    });
  });
});
