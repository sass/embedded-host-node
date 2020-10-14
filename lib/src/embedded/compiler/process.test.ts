// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {EmbeddedProcess} from './process';
import {take} from 'rxjs/operators';

describe('embedded process smoke test', () => {
  it('spins up child process', () => {
    const process = new EmbeddedProcess();
    process.close();
  });

  it('writes to stdin', () => {
    const process = new EmbeddedProcess();
    process.stdin$.next(Buffer.from([0]));
    process.close();
  });

  it('writes to stdin repeatedly', () => {
    const process = new EmbeddedProcess();
    process.stdin$.next(Buffer.from([0]));
    process.stdin$.next(Buffer.from([0]));
    process.stdin$.next(Buffer.from([0]));
    process.close();
  });

  it('listens to stdout', async () => {
    const process = new EmbeddedProcess();
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
    process.stdin$.next(buffer);
    await process.stdout$.pipe(take(1)).toPromise();
    process.close();
  });

  it('listens to stderr', async () => {
    const process = new EmbeddedProcess();
    process.stdin$.next(Buffer.from([0, 0, 0, 0, 1])); // invalid message
    await process.stderr$.pipe(take(1)).toPromise();
    process.close();
  });

  it('listens to exit event', async () => {
    const process = new EmbeddedProcess();
    process.close();
    await process.exit$.pipe(take(1)).toPromise();
  });
});
