// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';
import * as p from 'path';
import * as del from 'del';

import {Event, StderrEvent, StdoutEvent, SyncProcess} from './index';

describe('SyncProcess', () => {
  describe('stdio', () => {
    it('emits stdout', () => {
      withJSProcess('console.log("hello, world!");', node => {
        expectStdout(node.yield(), 'hello, world!\n');
      });
    });

    it('emits stderr', () => {
      withJSProcess('console.error("hello, world!");', node => {
        expectStderr(node.yield(), 'hello, world!\n');
      });
    });

    it('receives stdin', () => {
      withJSProcess(
        'process.stdin.on("data", (data) => process.stdout.write(data));',
        node => {
          node.stdin.write('hi there!\n');
          expectStdout(node.yield(), 'hi there!\n');
          node.stdin.write('fblthp\n');
          expectStdout(node.yield(), 'fblthp\n');
        }
      );
    });
  });

  describe('emits exit', () => {
    it('with code 0 by default', () => {
      withJSProcess('', node => {
        expectExit(node.yield(), 0);
      });
    });

    it('with a non-0 code', () => {
      withJSProcess('process.exit(123);', node => {
        expectExit(node.yield(), 123);
      });
    });

    it('with a signal code', () => {
      withJSProcess('for (;;) {}', node => {
        node.kill('SIGINT');
        expectExit(node.yield(), 'SIGINT');
      });
    });
  });

  it('passes options to the subprocess', () => {
    withJSFile('console.log(process.env.SYNC_PROCESS_TEST);', file => {
      const node = new SyncProcess(process.argv0, [file], {
        env: {...process.env, SYNC_PROCESS_TEST: 'abcdef'},
      });
      expectStdout(node.yield(), 'abcdef\n');
      node.kill();
    });
  });
});

/** Asserts that `event` is a `StdoutEvent` with text `text`. */
function expectStdout(event: Event, text: string): void {
  if (event.type === 'stderr') {
    throw `Expected stdout event, was stderr event: ${event.data.toString()}`;
  }

  expect(event.type).toEqual('stdout');
  expect((event as StdoutEvent).data.toString()).toEqual(text);
}

/** Asserts that `event` is a `StderrEvent` with text `text`. */
function expectStderr(event: Event, text: string): void {
  if (event.type === 'stdout') {
    throw `Expected stderr event, was stdout event: ${event.data.toString()}`;
  }

  expect(event.type).toEqual('stderr');
  expect((event as StderrEvent).data.toString()).toEqual(text);
}

/**
 * Asserts that `event` is an `ExitEvent` with either the given exit code (if
 * `codeOrSignal` is a number) or signal (if `codeOrSignal` is a string).
 */
function expectExit(event: Event, codeOrSignal: number | NodeJS.Signals): void {
  if (event.type !== 'exit') {
    throw (
      `Expected exit event, was ${event.type} event: ` + event.data.toString()
    );
  }

  expect(event).toEqual(
    typeof codeOrSignal === 'number'
      ? {type: 'exit', code: codeOrSignal}
      : {type: 'exit', signal: codeOrSignal}
  );
}

/**
 * Starts a `SyncProcess` running a JS file with the given `contents` and passes
 * it to `callback`.
 */
function withJSProcess(
  contents: string,
  callback: (process: SyncProcess) => void
): void {
  return withJSFile(contents, file => {
    const node = new SyncProcess(process.argv0, [file]);

    try {
      callback(node);
    } finally {
      node.kill();
    }
  });
}

/**
 * Creates a JS file with the given `contents` for the duration of `callback`.
 *
 * The `callback` is passed the name of the created file.
 */
function withJSFile(contents: string, callback: (file: string) => void): void {
  const testDir = p.join('spec', 'sandbox', `${Math.random()}`.slice(2));
  fs.mkdirSync(testDir, {recursive: true});
  const file = p.join(testDir, 'script.js');
  fs.writeFileSync(file, contents);

  try {
    callback(file);
  } finally {
    // TODO(awjin): Change this to rmSync once we drop support for Node 12.
    del.sync(testDir, {force: true});
  }
}
