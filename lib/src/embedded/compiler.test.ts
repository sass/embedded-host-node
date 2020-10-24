// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {take} from 'rxjs/operators';

import {EmbeddedCompiler} from './compiler';

describe('embedded compiler smoke test', () => {
  it('spins up child process', () => {
    const compiler = new EmbeddedCompiler();
    compiler.close();
  });

  it('writes to stdin', () => {
    const compiler = new EmbeddedCompiler();
    compiler.writeStdin(Buffer.from([0]));
    compiler.close();
  });

  it('writes to stdin repeatedly', () => {
    const compiler = new EmbeddedCompiler();
    compiler.writeStdin(Buffer.from([0]));
    compiler.writeStdin(Buffer.from([0]));
    compiler.writeStdin(Buffer.from([0]));
    compiler.close();
  });

  it('listens to stdout', async () => {
    const compiler = new EmbeddedCompiler();
    const buffer = Buffer.from([
      20,
      0,
      0,
      0,
      18,
      18,
      8,
      225,
      255,
      148,
      217,
      10,
      18,
      10,
      10,
      8,
      97,
      32,
      123,
      98,
      58,
      32,
      99,
      125,
    ]); // valid message
    compiler.writeStdin(buffer);
    await compiler.stdout$.pipe(take(1)).toPromise();
    compiler.close();
  });

  it('listens to stderr', async () => {
    const compiler = new EmbeddedCompiler();
    compiler.writeStdin(Buffer.from([0, 0, 0, 0, 1])); // invalid message
    await compiler.stderr$.pipe(take(1)).toPromise();
    compiler.close();
  });

  it('listens to exit event', async () => {
    const compiler = new EmbeddedCompiler();
    compiler.close();
    await compiler.exit$.pipe(take(1)).toPromise();
  });
});
