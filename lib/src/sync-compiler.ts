// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Subject} from 'rxjs';

import {SyncProcess} from './sync-process';
import {compilerCommand} from './compiler-path';

/**
 * A synchronous wrapper for the embedded Sass compiler that exposes its stdio
 * streams as Observables.
 */
export class SyncEmbeddedCompiler {
  /** The underlying process that's being wrapped. */
  private readonly process = new SyncProcess(
    compilerCommand[0],
    [...compilerCommand.slice(1), '--embedded'],
    {windowsHide: true}
  );

  /** The buffers emitted by the child process's stdout. */
  readonly stdout$ = new Subject<Buffer>();

  /** The buffers emitted by the child process's stderr. */
  readonly stderr$ = new Subject<Buffer>();

  /** Whether the underlying compiler has already exited. */
  private exited = false;

  /** Writes `buffer` to the child process's stdin. */
  writeStdin(buffer: Buffer): void {
    this.process.stdin.write(buffer);
  }

  yield(): boolean {
    const event = this.process.yield();
    switch (event.type) {
      case 'stdout':
        this.stdout$.next(event.data);
        return true;

      case 'stderr':
        this.stderr$.next(event.data);
        return true;

      case 'exit':
        this.exited = true;
        return false;
    }
  }

  /** Blocks until the underlying process exits. */
  yieldUntilExit(): void {
    while (!this.exited) {
      this.yield();
    }
  }

  /** Kills the child process, cleaning up all associated Observables. */
  close() {
    this.process.stdin.end();
  }
}
