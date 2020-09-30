// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {InboundMessage, OutboundMessage} from '../vendor/embedded_sass_pb';
import {EmbeddedProcess} from './compiler/process';
import {PacketTransformer} from './compiler/packet-transformer';
import {MessageTransformer} from './compiler/message-transformer';
import {Observable, Subject, merge} from 'rxjs';
import {filter, first, map} from 'rxjs/operators';

/**
 * A facade to the Embedded Sass Compiler.
 *
 * Takes the compiler's raw stdin and stdout and transforms them into public
 * Observables of InboundMessages (write$) and OutboundMessages (read$). Also
 * exposes an Observable (error$) that emits if a ProtocolError occurs while
 * communicating with the compiler.
 *
 * If there is a ProtocolError, this shuts down the compiler process and cleans
 * up all Observables.
 */
export class Compiler {
  // The Node child process that invokes the Embedded Sass Compiler.
  private readonly embeddedProcess = new EmbeddedProcess();

  // Transforms the embedded process's into delineated buffers.
  private readonly packetTransformer = new PacketTransformer(
    this.embeddedProcess.stdout$,
    this.embeddedProcess.stdin$
  );

  // Transforms the delineated buffers into Inbound/OutboundMessages.
  private readonly messageTransformer = new MessageTransformer(
    this.packetTransformer.read$,
    this.packetTransformer.write$
  );

  /** For sending InboundMessages to the Embedded Compiler. */
  readonly write$: Subject<InboundMessage> = this.messageTransformer.write$;

  /** OutboundMessages sent by the Embedded Compiler. */
  readonly read$: Observable<
    OutboundMessage
  > = this.messageTransformer.read$.pipe(
    filter(message => !message.hasError())
  );

  /** Emits an error if the Embedded Protocol is violated. */
  readonly error$: Observable<Error> = merge(
    this.messageTransformer.error$,
    this.messageTransformer.read$.pipe(
      filter(message => message.hasError()),
      map(message =>
        Error(`Compiler reported error: ${message.getError()?.getMessage()}`)
      )
    )
  );

  constructor() {
    // Pass the embedded process's stderr messages to the main process's stderr.
    this.embeddedProcess.stderr$.subscribe(buffer => {
      process.stderr.write(buffer);
    });

    // Shutdown the compiler if we detect a ProtocolError or the embedded
    // process exits.
    merge(this.error$, this.embeddedProcess.exit$)
      .pipe(first())
      .subscribe(() => process.nextTick(() => this.close()));
  }

  /** Closes the Embedded Compiler and cleans up all associated Observables. */
  close() {
    this.messageTransformer.close();
    this.packetTransformer.close();
    this.embeddedProcess.close();
  }
}
