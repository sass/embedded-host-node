// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable, Subject} from 'rxjs';

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
  readonly read$ = this.readInternal$.pipe();

  /** Receives payloads and encodes them into packets. */
  readonly write$ = new Subject<Buffer>();

  // The packet that is actively being decoded as buffers come in.
  private packet = new Packet();

  constructor(
    private readonly rawRead$: Observable<Buffer>,
    private readonly rawWrite$: Subject<Buffer>
  ) {
    this.rawRead$.subscribe(buffer => this.decode(buffer));
    this.write$.subscribe(buffer => this.encode(buffer));
  }

  // Decodes a buffer into the current packet. If the packet is completed,
  // emits the packet's payload and starts a new packet.
  private decode(buffer: Buffer) {
    let decodedBytes = 0;
    while (decodedBytes < buffer.length) {
      decodedBytes += this.packet.write(buffer.slice(decodedBytes));
      if (this.packet.isComplete) {
        this.readInternal$.next(this.packet.payload);
        this.packet = new Packet();
      }
    }
  }

  // Encodes a payload by attaching a header that describes its length.
  private encode(payload: Buffer) {
    const packet = Buffer.alloc(Packet.headerByteSize + payload.length);
    packet.writeInt32LE(payload.length, 0);
    packet.set(payload, Packet.headerByteSize);
    this.rawWrite$.next(packet);
  }

  /** Cleans up all Observables. */
  close() {
    this.readInternal$.complete();
    this.write$.complete();
  }
}

/** A length-delimited packet comprised of a header and payload. */
class Packet {
  /**
   * The length of a packet header--the 4-byte little-endian number that
   * indicates the payload's length.
   */
  static headerByteSize = 4;

  // The packet's header, indicating the payload's length. Constructed by calls
  // to write().
  private header = Buffer.alloc(Packet.headerByteSize);

  /**
   * The packet's payload. Constructed by calls to write().
   * @see write
   */
  payload?: Buffer;

  // These track the progress of constructing the packet.
  private headerOffset = 0;
  private payloadOffset = 0;

  /** Whether the packet construction is complete. */
  get isComplete() {
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
    if (this.isComplete) {
      throw Error('Cannot write to a completed Packet.');
    }

    let bytesWritten = 0;

    if (this.headerOffset < this.header.length) {
      bytesWritten = writeBuffer(source, this.header, this.headerOffset);
      this.headerOffset += bytesWritten;
      if (this.headerOffset < this.header.length) return bytesWritten;
    }

    if (!this.payload) {
      const payloadLength = this.header.readUInt32LE(0);
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

// Fills the destination buffer, starting at the offset index, with bytes from
// the source buffer. Returns the number of bytes written. Does not write beyond
// the length of the destination.
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
