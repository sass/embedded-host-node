// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {spawn} from 'child_process';
import {Observable} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

import {compilerCommand} from './compiler-path';

/**
 * An asynchronous wrapper for the embedded Sass compiler that exposes its stdio
 * streams as Observables.
 */
export class AsyncEmbeddedCompiler {
  /** The underlying process that's being wrapped. */
  private readonly process = spawn(
    compilerCommand[0],
    [...compilerCommand.slice(1), '--embedded'],
    {windowsHide: true}
  );

  /** The child process's exit event. */
  readonly exit$ = new Promise<number | null>(resolve => {
    this.process.on('exit', code => resolve(code));
  });

  /** The buffers emitted by the child process's stdout. */
  readonly stdout$ = new Observable<Buffer>(observer => {
    this.process.stdout.on('data', buffer => observer.next(buffer));
  }).pipe(takeUntil(this.exit$));

  /** The buffers emitted by the child process's stderr. */
  readonly stderr$ = new Observable<Buffer>(observer => {
    this.process.stderr.on('data', buffer => observer.next(buffer));
  }).pipe(takeUntil(this.exit$));

  /** Writes `buffer` to the child process's stdin. */
  writeStdin(buffer: Buffer): void {
    this.process.stdin.write(buffer);
  }

  /** Kills the child process, cleaning up all associated Observables. */
  close() {
    this.process.stdin.end();
  }
}
