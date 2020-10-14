// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {InboundMessage, OutboundMessage} from '../vendor/embedded_sass_pb';
import {EmbeddedProcess} from './compiler/process';
import {PacketTransformer} from './compiler/packet-transformer';
import {MessageTransformer} from './compiler/message-transformer';
import {Observable, merge} from 'rxjs';
import {filter, first, map, take, takeUntil, tap} from 'rxjs/operators';

type Request =
  | InboundMessage.CompileRequest
  | OutboundMessage.ImportRequest
  | OutboundMessage.FileImportRequest
  | OutboundMessage.CanonicalizeRequest
  | OutboundMessage.FunctionCallRequest;

type Response =
  | OutboundMessage.CompileResponse
  | InboundMessage.ImportResponse
  | InboundMessage.FileImportResponse
  | InboundMessage.CanonicalizeResponse
  | InboundMessage.FunctionCallResponse;

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

  // Tracks the IDs of all outstanding requests. Dispatched responses with
  // matching IDs clear the ID from this set.
  private readonly outstandingRequests = new Set<number>();

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

  /** Log events. */
  readonly logEvents$ = this.messageTransformer.read$.pipe(
    filter(message => message.hasLogevent()),
    takeUntil(this.error$)
  );

  constructor() {
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

  /**
   * Dispatches a compile request. Returns a promise that resolves when a
   * compile response with a matching ID is received from the embedded compiler.
   */
  compile(request: InboundMessage.CompileRequest) {
    const id = this.nextRequestId();
    request.setId(id);
    const message = new InboundMessage();
    message.setCompilerequest(request);

    this.recordRequest(id);
    this.messageTransformer.write$.next(message);

    return this.messageTransformer.read$
      .pipe(
        filter(message => {
          return (
            message.hasCompileresponse() &&
            message.getCompileresponse()!.getId() === id
          );
        }),
        map(message => message.getCompileresponse()!),
        tap(response => this.recordResponse(response.getId())),
        take(1),
        takeUntil(this.error$)
      )
      .toPromise();
  }

  listen(
    messageType: OutboundMessage.MessageCase,
    processRequest: (request: Request) => Response
  ) {
    this.messageTransformer.read$
      .pipe(
        filter(message => message.getMessageCase() === messageType),
        map(message => getRequest(message)),
        tap(request => this.recordRequest(request.getId())),
        map(request => processRequest(request)),
        tap(response => this.recordResponse(response.getId())),
        takeUntil(this.error$)
      )
      .subscribe(response => {
        this.messageTransformer.write$.next(
          inboundMessageWithResponse(messageType, response)
        );
      });
  }

  // Finds the next available slot in outstandingRequests.
  private nextRequestId() {
    for (let i = 0; i < this.outstandingRequests.size; i++) {
      if (!this.outstandingRequests.has(i)) return i;
    }
    return this.outstandingRequests.size;
  }

  // Adds an ID to outstandingRequests. Throws an error if the ID already
  // exists.
  private recordRequest(id: number) {
    if (this.outstandingRequests.has(id)) {
      throw Error(
        "Request ID overlaps with existing outstanding requests's ID"
      );
    }
    this.outstandingRequests.add(id);
  }

  // Removes an ID from outstandingRequests. Throws an error if the ID does not
  // exist.
  private recordResponse(id: number) {
    if (!this.outstandingRequests.has(id)) {
      throw Error('Response id does not match any outstanding request ids.');
    }
    this.outstandingRequests.delete(id);
  }

  /** Closes the Embedded Compiler and cleans up all associated Observables. */
  close() {
    this.messageTransformer.close();
    this.packetTransformer.close();
    this.embeddedProcess.close();
  }
}

function getRequest(message: OutboundMessage) {
  switch (message.getMessageCase()) {
    case OutboundMessage.MessageCase.IMPORTREQUEST:
      return (message as OutboundMessage).getImportrequest()!;
    case OutboundMessage.MessageCase.FILEIMPORTREQUEST:
      return (message as OutboundMessage).getFileimportrequest()!;
    case OutboundMessage.MessageCase.CANONICALIZEREQUEST:
      return (message as OutboundMessage).getCanonicalizerequest()!;
    case OutboundMessage.MessageCase.FUNCTIONCALLREQUEST:
      return (message as OutboundMessage).getFunctioncallrequest()!;
    default:
      throw Error('Message type not supported');
  }
}

function inboundMessageWithResponse(
  messageType: OutboundMessage.MessageCase,
  response: Response
) {
  const message = new InboundMessage();
  switch (messageType) {
    case OutboundMessage.MessageCase.IMPORTREQUEST:
      message.setImportresponse(response as InboundMessage.ImportResponse);
      break;
    case OutboundMessage.MessageCase.FILEIMPORTREQUEST:
      message.setFileimportresponse(
        response as InboundMessage.FileImportResponse
      );
      break;
    case OutboundMessage.MessageCase.CANONICALIZEREQUEST:
      message.setCanonicalizeresponse(
        response as InboundMessage.CanonicalizeResponse
      );
      break;
    case OutboundMessage.MessageCase.FUNCTIONCALLREQUEST:
      message.setFunctioncallresponse(
        response as InboundMessage.FunctionCallResponse
      );
      break;
    default:
      throw Error('Message type not supported');
  }
  return message;
}
