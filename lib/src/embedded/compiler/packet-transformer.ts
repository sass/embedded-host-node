// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable, Subject} from 'rxjs';
import {filter} from 'rxjs/operators';

/**
 * Decodes arbitrarily-chunked buffers, for example
 *   [ 0 1 2 3 4 5 6 7 ... ],
 * into packets of set length in the form
 *   +---------+------------- ...
 *   | 0 1 2 3 | 4 5 6 7 ...
 *   +---------+------------- ...
 *   | HEADER  | PAYLOAD
 *   +---------+------------- ...
 * and emits the payload of each packet.
 *
 * Encodes payloads by attaching a header that describes the payload's length.
 */
export class PacketTransformer {
  // The decoded payloads are written to this Subject. This is publicly exposed
  // as a readonly Observable to prevent memory leaks.
  private readonly readInternal$ = new Subject<Buffer>();

  /** The payloads (decoded from buffers). */
  readonly read$ = this.readInternal$.pipe(
    filter(payload => payload.length > 0)
  );

  /** Receives payloads and encodes them into packets. */
  readonly write$ = new Subject<Buffer>();

  // The packet that is actively being decoded as buffers come in. When the
  // packet is completed, its payload gets emitted.
  private packet = new Packet();

  constructor(
    private readonly rawRead$: Observable<Buffer>,
    private readonly rawWrite$: Subject<Buffer>
  ) {
    this.rawRead$.subscribe(buffer => this.decode(buffer));
    this.write$.subscribe(buffer => this.encode(buffer));
  }

  private decode(buffer: Buffer) {
    let decodedBytes = 0;
    while (decodedBytes < buffer.length) {
      decodedBytes += this.packet.write(buffer.slice(decodedBytes));
      if (this.packet.isComplete()) {
        this.readInternal$.next(this.packet.payload);
        this.packet = new Packet();
      }
    }
  }

  private encode(payload: Buffer) {
    const packet = Buffer.alloc(Packet.headerByteSize + payload.length);

    let remainder = payload.length;
    for (let i = 0; i < Packet.headerByteSize; i++) {
      packet.set([remainder % 256], i);
      remainder = Math.floor(remainder / 256);
    }

    packet.set(payload, Packet.headerByteSize);

    this.rawWrite$.next(packet);
  }

  /**
   * Cleans up all Observables.
   */
  close() {
    this.readInternal$.complete();
    this.write$.complete();
  }
}

/**
 * A length-delimited packet comprised of a header and payload. The header is a
 * 4-byte little-endian number that indicates the payload's length.
 */
class Packet {
  static headerByteSize = 4;

  header = Buffer.alloc(Packet.headerByteSize);
  payload?: Buffer;

  private headerOffset = 0;
  private payloadOffset = 0;

  isComplete() {
    return (
      this.headerOffset >= this.header.length &&
      this.payload &&
      this.payloadOffset >= this.payload?.length
    );
  }

  /**
   * Takes arbitrary binary input and slots it into the header and payload
   * appropriately. Returns the number of bytes that were written into the
   * packet. This method can be called repeatedly, incrementally building
   * up the packet until it is complete.
   */
  write(source: Buffer): number {
    let bytesWritten = 0;

    if (this.headerOffset < this.header.length) {
      bytesWritten = writeBuffer(source, this.header, this.headerOffset);
      this.headerOffset += bytesWritten;
    }

    if (this.headerOffset < this.header.length) return bytesWritten;

    if (!this.payload) {
      let payloadLength = 0;
      for (let i = 0; i < Packet.headerByteSize; i++) {
        payloadLength += this.header[i] * Math.pow(256, i);
      }
      this.payload = Buffer.alloc(payloadLength);
    }

    const payloadBytesWritten = writeBuffer(
      source.slice(bytesWritten),
      this.payload,
      this.payloadOffset
    );
    this.payloadOffset += payloadBytesWritten;

    return bytesWritten + payloadBytesWritten;
  }
}

function writeBuffer(
  source: Buffer,
  destination: Buffer,
  destinationOffset: number
) {
  const bytesToWrite = Math.min(
    source.length,
    destination.length - destinationOffset
  );
  destination.set(source.slice(0, bytesToWrite), destinationOffset);
  return bytesToWrite;
}
