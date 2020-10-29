// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable, Subject} from 'rxjs';
import {mergeMap} from 'rxjs/operators';

/**
 * Decodes arbitrarily-chunked buffers, for example
 *   [ 0 1 2 3 4 5 6 7 ... ],
 * into packets of set length in the form
 *   +---------+------------- ...
 *   | 0 1 2 3 | 4 5 6 7 ...
 *   +---------+------------- ...
 *   | HEADER  | PAYLOAD (PROTOBUF)
 *   +---------+------------- ...
 * and emits the payload of each packet.
 *
 * Encodes packets by attaching a header to a protobuf that describes the
 * protobuf's length.
 */
export class PacketTransformer {
  // The packet that is actively being decoded as buffers come in.
  private packet = new Packet();

  // The decoded protobufs are written to this Subject. It is publicly exposed
  // as a readonly Observable.
  private readonly outboundProtobufsInternal$ = new Subject<Buffer>();

  /**
   * The fully-decoded, outbound protobufs. If any errors are encountered
   * during encoding/decoding, this Observable will error out.
   */
  readonly outboundProtobufs$ = this.outboundProtobufsInternal$.pipe();

  constructor(
    private readonly outboundBuffers$: Observable<Buffer>,
    private readonly writeInboundBuffer: (buffer: Buffer) => void
  ) {
    this.outboundBuffers$
      .pipe(mergeMap(buffer => this.decode(buffer)))
      .subscribe(this.outboundProtobufsInternal$);
  }

  /**
   * Encodes a packet by pre-fixing `protobuf` with a header that describes its
   * length.
   */
  writeInboundProtobuf(protobuf: Buffer): void {
    try {
      const packet = Buffer.alloc(Packet.headerByteSize + protobuf.length);
      packet.writeInt32LE(protobuf.length, 0);
      packet.set(protobuf, Packet.headerByteSize);
      this.writeInboundBuffer(packet);
    } catch (error) {
      this.outboundProtobufsInternal$.error(error);
    }
  }

  // Decodes a buffer, filling up the packet that is actively being decoded.
  // Returns a list of decoded payloads.
  private decode(buffer: Buffer): Buffer[] {
    const payloads: Buffer[] = [];
    let decodedBytes = 0;
    while (decodedBytes < buffer.length) {
      decodedBytes += this.packet.write(buffer.slice(decodedBytes));
      if (this.packet.isComplete) {
        payloads.push(this.packet.payload!);
        this.packet = new Packet();
      }
    }
    return payloads;
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
): number {
  const bytesToWrite = Math.min(
    source.length,
    destination.length - destinationOffset
  );
  destination.set(source.slice(0, bytesToWrite), destinationOffset);
  return bytesToWrite;
}
