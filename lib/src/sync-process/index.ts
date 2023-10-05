// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';
import * as p from 'path';
import * as stream from 'stream';
import {Worker, WorkerOptions} from 'worker_threads';

import {SyncMessagePort} from './sync-message-port';
import {Event, InternalEvent} from './event';

export {Event, ExitEvent, StderrEvent, StdoutEvent} from './event';

// TODO(nex3): Factor this out into its own package.

/**
 * A child process that runs synchronously while also allowing the user to
 * interact with it before it shuts down.
 */
export class SyncProcess {
  /** The port that communicates with the worker thread. */
  private readonly port: SyncMessagePort;

  /** The worker in which the child process runs. */
  private readonly worker: Worker;

  /** The standard input stream to write to the process. */
  readonly stdin: stream.Writable;

  /** Creates a new synchronous process running `command` with `args`. */
  constructor(command: string, options?: Options);
  constructor(command: string, args: string[], options?: Options);

  constructor(
    command: string,
    argsOrOptions?: string[] | Options,
    options?: Options
  ) {
    let args: string[];
    if (Array.isArray(argsOrOptions)) {
      args = argsOrOptions;
    } else {
      args = [];
      options = argsOrOptions;
    }

    const {port1, port2} = SyncMessagePort.createChannel();
    this.port = new SyncMessagePort(port1);

    this.worker = spawnWorker(p.join(p.dirname(__filename), 'worker'), {
      workerData: {port: port2, command, args, options},
      transferList: [port2],
    });

    // The worker shouldn't emit any errors unless it breaks in development.
    this.worker.on('error', console.error);

    this.stdin = new stream.Writable({
      write: (chunk: Buffer, encoding, callback) => {
        this.port.postMessage(
          {
            type: 'stdin',
            data: chunk as Buffer,
          },
          [chunk.buffer]
        );
        callback();
      },
    });

    // Unfortunately, there's no built-in event or callback that will reliably
    // *synchronously* notify us that the stdin stream has been closed. (The
    // `final` callback works in Node v16 but not v14.) Instead, we wrap the
    // methods themselves that are used to close the stream.
    const oldEnd = this.stdin.end.bind(this.stdin) as (
      a1?: unknown,
      a2?: unknown,
      a3?: unknown
    ) => void;
    this.stdin.end = ((a1?: unknown, a2?: unknown, a3?: unknown) => {
      oldEnd(a1, a2, a3);
      this.port.postMessage({type: 'stdinClosed'});
    }) as typeof this.stdin.end;

    const oldDestroy = this.stdin.destroy.bind(this.stdin) as (
      a1?: unknown
    ) => void;
    this.stdin.destroy = ((a1?: unknown) => {
      oldDestroy(a1);
      this.port.postMessage({type: 'stdinClosed'});
    }) as typeof this.stdin.destroy;
  }

  /**
   * Blocks until the child process is ready to emit another event, then returns
   * that event.
   *
   * If there's an error running the child process, this will throw that error.
   * This may not be called after it emits an `ExitEvent` or throws an error.
   */
  yield(): Event {
    if (this.stdin.destroyed) {
      throw new Error(
        "Can't call SyncProcess.yield() after the process has exited."
      );
    }

    const message = this.port.receiveMessage() as InternalEvent;
    switch (message.type) {
      case 'stdout':
        return {type: 'stdout', data: Buffer.from(message.data.buffer)};

      case 'stderr':
        return {type: 'stderr', data: Buffer.from(message.data.buffer)};

      case 'error':
        this.close();
        throw message.error;

      case 'exit':
        this.close();
        return message;
    }
  }

  // TODO(nex3): Add a non-blocking `yieldIfReady()` function that returns
  // `null` if the worker hasn't queued up an event.

  // TODO(nex3): Add a `yieldAsync()` function that returns a `Promise<Event>`.

  /**
   * Sends a signal (`SIGTERM` by default) to the child process.
   *
   * This has no effect if the process has already exited.
   */
  kill(signal?: NodeJS.Signals | number): void {
    this.port.postMessage({type: 'kill', signal});
  }

  /** Closes down the worker thread and the stdin stream. */
  private close(): void {
    this.port.close();
    void this.worker.terminate();
    this.stdin.destroy();
  }
}

/**
 * Spawns a worker for the given `fileWithoutExtension` in either a JS or TS
 * worker, depending on which file exists.
 */
function spawnWorker(
  fileWithoutExtension: string,
  options: WorkerOptions
): Worker {
  // The released version always spawns the JS worker. The TS worker is only
  // used for development.
  const jsFile = fileWithoutExtension + '.js';
  if (fs.existsSync(jsFile)) return new Worker(jsFile, options);

  const tsFile = fileWithoutExtension + '.ts';
  if (fs.existsSync(tsFile)) {
    return new Worker(
      `
        require('ts-node').register();
        require(${JSON.stringify(tsFile)});
      `,
      {...options, eval: true}
    );
  }

  throw new Error(`Neither "${jsFile}" nor ".ts" exists.`);
}

/**
 * A subset of the options for [`child_process.spawn()`].
 *
 * [`child_process.spawn()`]: https://nodejs.org/api/child_process.html#child_processspawncommand-args-options
 */
export interface Options {
  cwd?: string;
  env?: Record<string, string>;
  argv0?: string;
  uid?: number;
  gid?: number;
  shell?: boolean | string;
  windowsVerbatimArguments?: boolean;
  windowsHide?: boolean;
  timeout?: number;
  killSignal?: string | number;
}
