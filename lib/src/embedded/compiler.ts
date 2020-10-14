// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {InboundMessage, OutboundMessage} from '../vendor/embedded_sass_pb';
import {EmbeddedProcess} from './compiler/process';
import {PacketTransformer} from './compiler/packet-transformer';
import {MessageTransformer} from './compiler/message-transformer';
import {Observable, merge} from 'rxjs';
import {filter, first, map} from 'rxjs/operators';
import {Dispatcher} from './dispatcher';

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
export class EmbeddedCompiler {
  // The Node child process that invokes the Embedded Sass Compiler.
  private readonly embeddedProcess = new EmbeddedProcess();

  // Transforms the embedded process's IO streams into delineated buffers.
  private readonly packetTransformer = new PacketTransformer(
    this.embeddedProcess.stdout$,
    this.embeddedProcess.stdin$
  );

  // Transforms the delineated buffers into Inbound/OutboundMessages.
  private readonly messageTransformer = new MessageTransformer(
    this.packetTransformer.read$,
    this.packetTransformer.write$
  );

  // Emits an error if the Embedded Protocol is violated.
  private readonly error$: Observable<Error> = merge(
    this.messageTransformer.error$,
    this.messageTransformer.read$.pipe(
      filter(message => message.hasError()),
      map(message =>
        Error(`Compiler reported error: ${message.getError()?.getMessage()}`)
      )
    )
  );

  constructor(private readonly dispatcher: Dispatcher) {
    this.dispatcher.compileRequests$.subscribe(request => {
      const message = new InboundMessage();
      message.setCompilerequest(request);
      this.messageTransformer.write$.next(message);
    });

    this.messageTransformer.read$
      .pipe(filter(message => !message.hasError()))
      .subscribe(message => {
        switch (message.getMessageCase()) {
          case OutboundMessage.MessageCase.LOGEVENT:
            this.dispatcher.sendLogEvent(message.getLogevent()!);
            break;
          case OutboundMessage.MessageCase.COMPILERESPONSE:
            this.dispatcher.sendCompileResponse(message.getCompileresponse()!);
            break;
          case OutboundMessage.MessageCase.IMPORTREQUEST:
            this.dispatcher
              .sendImportRequest(message.getImportrequest()!)
              ?.then(response => {
                const message = new InboundMessage();
                message.setImportresponse(response);
                this.messageTransformer.write$.next(message);
              });
            break;
          case OutboundMessage.MessageCase.FILEIMPORTREQUEST:
            this.dispatcher
              .sendFileImportRequest(message.getFileimportrequest()!)
              ?.then(response => {
                const message = new InboundMessage();
                message.setFileimportresponse(response);
                this.messageTransformer.write$.next(message);
              });
            break;
          case OutboundMessage.MessageCase.CANONICALIZEREQUEST:
            this.dispatcher
              .sendCanonicalizeRequest(message.getCanonicalizerequest()!)
              ?.then(response => {
                const message = new InboundMessage();
                message.setCanonicalizeresponse(response);
                this.messageTransformer.write$.next(message);
              });
            break;
          case OutboundMessage.MessageCase.FUNCTIONCALLREQUEST:
            this.dispatcher
              .sendFunctionCallRequest(message.getFunctioncallrequest()!)
              ?.then(response => {
                const message = new InboundMessage();
                message.setFunctioncallresponse(response);
                this.messageTransformer.write$.next(message);
              });
            break;
        }
      });

    this.error$.subscribe(error => this.dispatcher.sendError(error));

    // Pass the embedded process's stderr messages to the main process's stderr.
    this.embeddedProcess.stderr$.subscribe(buffer => {
      process.stderr.write(buffer);
    });

    // Shut down the compiler if we detect a ProtocolError or the embedded
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
