// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {spawn} from 'child_process';
import {resolve} from 'path';
import {Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

/**
 * Invokes the Embedded Sass Compiler as a Node child process, exposing its
 * stdio as Observables.
 */
export class EmbeddedProcess {
  private readonly process = spawn(
    resolve(__dirname, '../../vendor/dart-sass-embedded'),
    {
      windowsHide: true,
    }
  );

  // These Subjects are written to by the child process's stdio. They are
  // publicly exposed as readonly Observables to prevent memory leaks.
  private readonly rawStdout$ = new Subject<Buffer>();
  private readonly rawStderr$ = new Subject<Buffer>();
  private readonly rawExit$ = new Subject<number | null>();

  /** Sends the buffers it receives to the child process's stdin. */
  readonly stdin$ = new Subject<Buffer>();

  /** The buffers emitted by the child process's stdout. */
  readonly stdout$ = this.rawStdout$.pipe(takeUntil(this.rawExit$));

  /** The buffers emitted by the child process's stderr. */
  readonly stderr$ = this.rawStderr$.pipe(takeUntil(this.rawExit$));

  /** The child process's exit event. */
  readonly exit$ = this.rawExit$.pipe(takeUntil(this.rawExit$));

  constructor() {
    this.stdin$.subscribe(buffer => this.process.stdin.write(buffer));
    this.process.stdout.on('data', buffer => this.rawStdout$.next(buffer));
    this.process.stderr.on('data', buffer => this.rawStderr$.next(buffer));
    this.process.on('exit', () => this.close());
  }

  /**
   * Kills the child process and cleans up all associated Observables.
   */
  close() {
    this.rawExit$.next();
    this.rawExit$.complete();
    this.stdin$.complete();
    this.process.stdin.end();
  }
}
