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

  private readonly _stdout$ = new Subject<Buffer>();

  private readonly _stderr$ = new Subject<Buffer>();

  private readonly _exit$ = new Subject<number | null>();

  /** Sends the buffers it receives to the child process's stdin. */
  readonly stdin$ = new Subject<Buffer>();

  /** The buffers emitted by the child process's stdout. */
  readonly stdout$ = this._stdout$.pipe(takeUntil(this._exit$));

  /** The buffers emitted by the child process's stderr. */
  readonly stderr$ = this._stderr$.pipe(takeUntil(this._exit$));

  /** The child process's exit event. */
  readonly exit$ = this._exit$.pipe(takeUntil(this._exit$));

  constructor() {
    this.stdin$.subscribe(buffer => this.process.stdin.write(buffer));
    this.process.stdout.on('data', buffer => this._stdout$.next(buffer));
    this.process.stderr.on('data', buffer => this._stderr$.next(buffer));
    this.process.on('exit', () => this.close());
  }

  /**
   * Kills the child process and cleans up all associated Observables.
   */
  close() {
    this._exit$.next();
    this._exit$.complete();
    this.stdin$.complete();
    this.process.stdin.end();
  }
}
