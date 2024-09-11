// Copyright 2021 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as fs from 'fs';
import * as p from 'path';
import {MessagePort, Worker} from 'worker_threads';

import {SyncMessagePort} from './sync-message-port';

describe('SyncMessagePort', () => {
  describe('sends a message', () => {
    it('before the other endpoint calls receiveMessage()', () => {
      const channel = SyncMessagePort.createChannel();
      const port1 = new SyncMessagePort(channel.port1);
      port1.postMessage('hi there!');

      const port2 = new SyncMessagePort(channel.port2);
      expect(port2.receiveMessage()).toEqual('hi there!');
    });

    it('after the other endpoint calls receiveMessage()', () => {
      const channel = SyncMessagePort.createChannel();
      const port = new SyncMessagePort(channel.port1);

      spawnWorker(
        `
        // Wait a little bit just to make entirely sure that the parent thread
        // is awaiting a message.
        setTimeout(() => {
          port.postMessage('done!');
          port.close();
        }, 100);
      `,
        channel.port2
      );

      expect(port.receiveMessage()).toEqual('done!');
      expect(port.receiveMessage).toThrow();
    });

    it('multiple times before the other endpoint starts reading', () => {
      const channel = SyncMessagePort.createChannel();
      const port1 = new SyncMessagePort(channel.port1);
      port1.postMessage('message1');
      port1.postMessage('message2');
      port1.postMessage('message3');
      port1.postMessage('message4');

      const port2 = new SyncMessagePort(channel.port2);
      expect(port2.receiveMessage()).toEqual('message1');
      expect(port2.receiveMessage()).toEqual('message2');
      expect(port2.receiveMessage()).toEqual('message3');
      expect(port2.receiveMessage()).toEqual('message4');
    });

    it('multiple times and close', () => {
      const channel = SyncMessagePort.createChannel();
      const port = new SyncMessagePort(channel.port1);

      spawnWorker(
        `
        port.postMessage('message1');
        port.postMessage('done!');
        port.close();
      `,
        channel.port2
      );

      expect(port.receiveMessage()).toEqual('message1');
      expect(port.receiveMessage()).toEqual('done!');
      expect(port.receiveMessage).toThrow();
    });
  });

  describe('with an asynchronous listener', () => {
    it('receives a message sent before listening', async () => {
      const channel = SyncMessagePort.createChannel();
      const port1 = new SyncMessagePort(channel.port1);
      port1.postMessage('hi there!');

      const port2 = new SyncMessagePort(channel.port2);

      // Wait a macrotask to make sure the message is as queued up as it's going
      // to be.
      await new Promise(process.nextTick);

      const promise = new Promise(resolve => port2.once('message', resolve));
      await expect(promise).resolves.toEqual('hi there!');
      port1.close();
    });

    it('receives a message sent after listening', async () => {
      const channel = SyncMessagePort.createChannel();
      const port1 = new SyncMessagePort(channel.port1);
      const promise = new Promise(resolve => port1.once('message', resolve));

      // Wait a macrotask to make sure the message is as queued up as it's going
      // to be.
      await new Promise(process.nextTick);
      const port2 = new SyncMessagePort(channel.port2);
      port2.postMessage('hi there!');

      await expect(promise).resolves.toEqual('hi there!');
      port1.close();
    });

    it('receiveMessage() throws an error after listening', async () => {
      const channel = SyncMessagePort.createChannel();
      const port1 = new SyncMessagePort(channel.port1);
      port1.on('message', () => {});

      expect(port1.receiveMessage).toThrow();
      port1.close();
    });
  });

  describe('close()', () => {
    it('closing one port closes the other', async () => {
      const channel = SyncMessagePort.createChannel();
      const port1 = new SyncMessagePort(channel.port1);
      const port2 = new SyncMessagePort(channel.port2);

      port1.close();

      // Should resolve.
      await new Promise(resolve => port2.once('close', resolve));
    });

    it('receiveMessage() throws an error for a closed port', () => {
      const channel = SyncMessagePort.createChannel();
      const port1 = new SyncMessagePort(channel.port1);
      const port2 = new SyncMessagePort(channel.port2);

      port1.close();
      expect(port1.receiveMessage).toThrow();
      expect(port2.receiveMessage).toThrow();
    });
  });
});

/**
 * Spawns a worker that executes the given TypeScript `source`.
 *
 * Automatically initializes a `SyncMessageChannel` named `port` connected to
 * `port`.
 */
function spawnWorker(source: string, port: MessagePort): Worker {
  fs.mkdirSync('spec/sandbox', {recursive: true});
  const file = p.join('spec/sandbox', `${Math.random()}.ts`.slice(2));
  fs.writeFileSync(
    file,
    `
    const {SyncMessagePort} = require(${JSON.stringify(
      p.join(p.dirname(__filename), 'sync-message-port')
    )});
    const {workerData} = require('worker_threads');

    const port = new SyncMessagePort(workerData);

    ${source}
  `
  );

  const worker = new Worker(
    `
      require('ts-node').register();
      require(${JSON.stringify(p.resolve(file.substring(0, file.length - 3)))});
    `,
    {eval: true, workerData: port, transferList: [port]}
  );

  worker.on('error', error => {
    throw error;
  });
  worker.on('exit', () => fs.unlinkSync(file));

  return worker;
}
