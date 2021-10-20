// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';
import {spawn} from 'child_process';
import {resolve} from 'path';
import {Observable} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

/**
 * Invokes the Embedded Sass Compiler as a Node child process, exposing its
 * stdio as Observables.
 */
export class EmbeddedCompiler {
  private readonly process = (() => {
    for (const path of ['../vendor', '../../../../lib/src/vendor']) {
      const executable = resolve(
        __dirname,
        path,
        `dart-sass-embedded/dart-sass-embedded${
          process.platform === 'win32' ? '.bat' : ''
        }`
      );

      if (fs.existsSync(executable)) {
        return spawn(executable, {windowsHide: true});
      }
    }

    throw new Error(
      "Embedded Dart Sass couldn't find the embedded compiler executable."
    );
  })();

  /** The child process's exit event. */
  readonly exit$ = new Observable<number | null>(observer => {
    this.process.on('exit', code => observer.next(code));
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
