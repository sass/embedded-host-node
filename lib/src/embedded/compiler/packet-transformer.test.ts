// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {PacketTransformer} from './packet-transformer';
import {Subject, Observable} from 'rxjs';
import {take, toArray} from 'rxjs/operators';

describe('packet transformer', () => {
  describe('encode', () => {
    let encoded$: Subject<Buffer>;
    let transformer: PacketTransformer;
    let encoded: Promise<Buffer[]>;

    beforeEach(() => {
      encoded$ = new Subject<Buffer>();
      transformer = new PacketTransformer(new Observable<Buffer>(), encoded$);
      encoded = encoded$.pipe(toArray()).pipe(take(1)).toPromise();
    });

    afterEach(() => transformer.close());

    it('encodes an empty message', async () => {
      transformer.write$.next(Buffer.from([]));
      encoded$.complete();
      expect(await encoded).toEqual([Buffer.from([0, 0, 0, 0])]);
    });

    it('encodes a message of length 1', async () => {
      transformer.write$.next(Buffer.from([123]));
      encoded$.complete();
      expect(await encoded).toEqual([Buffer.from([1, 0, 0, 0, 123])]);
    });

    it('encodes a message of length greater than 256', async () => {
      transformer.write$.next(Buffer.alloc(300, 1));
      encoded$.complete();
      expect(await encoded).toEqual([
        Buffer.from([44, 1, 0, 0, ...new Array(300).fill(1)]),
      ]);
    });

    it('encodes multiple messages', async () => {
      transformer.write$.next(Buffer.from([10]));
      transformer.write$.next(Buffer.from([20, 30]));
      transformer.write$.next(Buffer.from([40, 50, 60]));
      encoded$.complete();
      expect(await encoded).toEqual([
        Buffer.from([1, 0, 0, 0, 10]),
        Buffer.from([2, 0, 0, 0, 20, 30]),
        Buffer.from([3, 0, 0, 0, 40, 50, 60]),
      ]);
    });
  });

  describe('decode', () => {
    let toDecode$: Subject<Buffer>;
    let transformer: PacketTransformer;
    let decoded: Promise<Buffer[]>;

    beforeEach(() => {
      toDecode$ = new Subject<Buffer>();
      transformer = new PacketTransformer(toDecode$, new Subject<Buffer>());
      decoded = transformer.read$.pipe(toArray()).pipe(take(1)).toPromise();
    });

    afterEach(() => toDecode$.complete());

    describe('empty message', () => {
      it('decodes a single chunk', async () => {
        toDecode$.next(Buffer.from([0, 0, 0, 0]));
        transformer.close();
        expect(await decoded).toEqual([Buffer.from([])]);
      });

      it('decodes multiple chunks', async () => {
        toDecode$.next(Buffer.from([0, 0]));
        toDecode$.next(Buffer.from([0, 0]));
        transformer.close();
        expect(await decoded).toEqual([Buffer.from([])]);
      });

      it('decodes one chunk per byte', async () => {
        toDecode$.next(Buffer.from([0]));
        toDecode$.next(Buffer.from([0]));
        toDecode$.next(Buffer.from([0]));
        toDecode$.next(Buffer.from([0]));
        transformer.close();
        expect(await decoded).toEqual([Buffer.from([])]);
      });

      it('decodes a chunk that contains more data', async () => {
        toDecode$.next(Buffer.from([0, 0, 0, 0, 1, 0, 0, 0, 100]));
        transformer.close();
        expect(await decoded).toEqual([Buffer.from([]), Buffer.from([100])]);
      });
    });

    describe('longer message', () => {
      it('decodes a single chunk', async () => {
        toDecode$.next(Buffer.from([4, 0, 0, 0, 1, 2, 3, 4]));
        transformer.close();
        expect(await decoded).toEqual([Buffer.from([1, 2, 3, 4])]);
      });

      it('decodes multiple chunks', async () => {
        toDecode$.next(Buffer.from([4, 0]));
        toDecode$.next(Buffer.from([0, 0, 1, 2]));
        toDecode$.next(Buffer.from([3, 4]));
        transformer.close();
        expect(await decoded).toEqual([Buffer.from([1, 2, 3, 4])]);
      });

      it('decodes one chunk per byte', async () => {
        for (const byte of [4, 0, 0, 0, 1, 2, 3, 4]) {
          toDecode$.next(Buffer.from([byte]));
        }
        transformer.close();
        expect(await decoded).toEqual([Buffer.from([1, 2, 3, 4])]);
      });

      it('decodes a chunk that contains more data', async () => {
        toDecode$.next(Buffer.from([4, 0, 0, 0, 1, 2, 3, 4, 1, 0, 0, 0]));
        transformer.close();
        expect(await decoded).toEqual([Buffer.from([1, 2, 3, 4])]);
      });

      it('decodes a chunk of length greater than 256', async () => {
        toDecode$.next(Buffer.from([44, 1, 0, 0, ...new Array(300).fill(1)]));
        transformer.close();
        expect(await decoded).toEqual([Buffer.from(new Array(300).fill(1))]);
      });
    });

    describe('multiple messages', () => {
      it('decodes a single chunk', async () => {
        toDecode$.next(
          Buffer.from([4, 0, 0, 0, 1, 2, 3, 4, 2, 0, 0, 0, 101, 102])
        );
        transformer.close();
        expect(await decoded).toEqual([
          Buffer.from([1, 2, 3, 4]),
          Buffer.from([101, 102]),
        ]);
      });

      it('decodes multiple chunks', async () => {
        toDecode$.next(Buffer.from([4, 0]));
        toDecode$.next(Buffer.from([0, 0, 1, 2, 3, 4, 2, 0]));
        toDecode$.next(Buffer.from([0, 0, 101, 102]));
        transformer.close();
        expect(await decoded).toEqual([
          Buffer.from([1, 2, 3, 4]),
          Buffer.from([101, 102]),
        ]);
      });

      it('decodes one chunk per byte', async () => {
        for (const byte of [4, 0, 0, 0, 1, 2, 3, 4, 2, 0, 0, 0, 101, 102]) {
          toDecode$.next(Buffer.from([byte]));
        }
        transformer.close();
        expect(await decoded).toEqual([
          Buffer.from([1, 2, 3, 4]),
          Buffer.from([101, 102]),
        ]);
      });
    });
  });
});
