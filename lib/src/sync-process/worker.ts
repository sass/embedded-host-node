// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {
  parentPort,
  workerData,
  MessagePort,
  TransferListItem,
} from 'worker_threads';
import {spawn, SpawnOptionsWithoutStdio} from 'child_process';
import {strict as assert} from 'assert';

import {SyncMessagePort} from './sync-message-port';
import {InternalEvent} from './event';

const port = new SyncMessagePort(workerData.port as MessagePort);

/** A more type-safe way to call `port.postMesage()` */
function emit(event: InternalEvent, transferList?: TransferListItem[]): void {
  port.postMessage(event, transferList);
}

const process = spawn(
  workerData.command as string,
  workerData.args as string[],
  workerData.options as SpawnOptionsWithoutStdio | undefined
);

port.on('message', message => {
  if (message.type === 'stdin') {
    process.stdin.write(message.data as Buffer);
  } else {
    assert.equal(message.type, 'kill');
    process.kill(message.signal as number | NodeJS.Signals | undefined);
  }
});

process.stdout.on('data', data => {
  emit({type: 'stdout', data}, [data.buffer]);
});

process.stderr.on('data', data => {
  emit({type: 'stderr', data}, [data.buffer]);
});

process.on('error', error => {
  emit({type: 'error', error});

  process.kill();
  parentPort!.close();
  port.close();
});

process.on('exit', (code, signal) => {
  if (code !== null) {
    emit({type: 'exit', code});
  } else {
    assert(signal);
    emit({type: 'exit', signal});
  }

  parentPort!.close();
  port.close();
});
