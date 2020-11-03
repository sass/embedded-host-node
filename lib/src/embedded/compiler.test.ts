// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {take} from 'rxjs/operators';

import {InboundMessage} from '../vendor/embedded_sass_pb';
import {EmbeddedCompiler} from './compiler';

describe('embedded compiler smoke test', () => {
  it('spins up child process', () => {
    expect(() => {
      const compiler = new EmbeddedCompiler();
      compiler.close();
    }).not.toThrow();
  });

  it('writes to stdin', () => {
    expect(() => {
      const compiler = new EmbeddedCompiler();
      compiler.writeStdin(Buffer.from([0]));
      compiler.close();
    }).not.toThrow();
  });

  it('writes to stdin repeatedly', () => {
    expect(() => {
      const compiler = new EmbeddedCompiler();
      compiler.writeStdin(Buffer.from([0]));
      compiler.writeStdin(Buffer.from([0]));
      compiler.writeStdin(Buffer.from([0]));
      compiler.close();
    }).not.toThrow();
  });

  it('listens to stdout', async () => {
    const input = new InboundMessage.CompileRequest.StringInput();
    input.setSource('a {b: c}');
    const request = new InboundMessage.CompileRequest();
    request.setString(input);
    const message = new InboundMessage();
    message.setCompilerequest(request);

    const protobuf = Buffer.from(message.serializeBinary());
    const packet = Buffer.alloc(4 + protobuf.length);
    packet.writeInt32LE(protobuf.length, 0);
    packet.set(protobuf, 4);

    const compiler = new EmbeddedCompiler();
    compiler.writeStdin(packet);
    const output = await compiler.stdout$.pipe(take(1)).toPromise();

    expect(output).not.toBeNull();
    compiler.close();
  });

  it('listens to stderr', async () => {
    const compiler = new EmbeddedCompiler();
    compiler.writeStdin(Buffer.from([0, 0, 0, 0, 1])); // invalid message
    const output = await compiler.stderr$.pipe(take(1)).toPromise();

    expect(output).not.toBeNull();
    compiler.close();
  });

  it('listens to exit event', async () => {
    const compiler = new EmbeddedCompiler();
    compiler.close();
    const output = await compiler.exit$.pipe(take(1)).toPromise();

    expect(output).not.toBeNull();
  });
});
