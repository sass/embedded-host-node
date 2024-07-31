// Copyright 2024 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';

/**
 * Read chunk of data from a file descriptor into a new Buffer.
 */
const readFileDescriptor = function (
  fd: number,
  position: number,
  length: number
): Buffer {
  const buffer = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const bytesRead = fs.readSync(fd, buffer, {
      offset: offset,
      position: position + offset,
    });
    if (bytesRead === 0) {
      throw new Error(`failed to read fd ${fd}`);
    }

    offset += bytesRead;
  }
  return buffer;
};

/**
 * Parse an ELF file and return its interpreter.
 */
export const getELFInterpreter = function (path: string): string {
  const fd = fs.openSync(path, 'r');
  try {
    const eIdent = new DataView(readFileDescriptor(fd, 0, 64).buffer);

    if (
      eIdent.getUint8(0) !== 0x7f ||
      eIdent.getUint8(1) !== 0x45 ||
      eIdent.getUint8(2) !== 0x4c ||
      eIdent.getUint8(3) !== 0x46
    ) {
      throw new Error(`${path} is not an elf file.`);
    }

    const eIdentClass = eIdent.getUint8(4);
    if (eIdentClass !== 1 && eIdentClass !== 2) {
      throw new Error(`${path} has an invalid elf class.`);
    }
    const class32 = eIdentClass === 1;

    const eIdentData = eIdent.getUint8(5);
    if (eIdentData !== 1 && eIdentData !== 2) {
      throw new Error(`${path} has an invalid endianness.`);
    }
    const littleEndian = eIdentData === 1;

    const e_phoff = class32
      ? eIdent.getUint32(28, littleEndian)
      : Number(eIdent.getBigUint64(32, littleEndian));
    const e_phentsize = class32
      ? eIdent.getUint16(42, littleEndian)
      : eIdent.getUint16(54, littleEndian);
    const e_phnum = class32
      ? eIdent.getUint16(44, littleEndian)
      : eIdent.getUint16(56, littleEndian);

    const proghdrs = new DataView(
      readFileDescriptor(fd, e_phoff, e_phentsize * e_phnum).buffer
    );
    for (let i = 0; i < e_phnum; i++) {
      const byteOffset = i * e_phentsize;
      const p_type = proghdrs.getUint32(byteOffset, littleEndian);
      if (p_type !== 3) {
        continue;
      }

      const p_offset = class32
        ? proghdrs.getUint32(byteOffset + 4, littleEndian)
        : Number(proghdrs.getBigUint64(byteOffset + 8, littleEndian));
      const p_filesz = class32
        ? proghdrs.getUint32(byteOffset + 16, littleEndian)
        : Number(proghdrs.getBigUint64(byteOffset + 32, littleEndian));

      const buffer = readFileDescriptor(fd, p_offset, p_filesz);
      if (buffer[p_filesz - 1] !== 0) {
        throw new Error(`${path} is corrupted.`);
      }

      return buffer.toString('utf8', 0, p_filesz - 1);
    }

    throw new Error(`${path} does not contain an interpreter entry.`);
  } finally {
    fs.closeSync(fd);
  }
};
