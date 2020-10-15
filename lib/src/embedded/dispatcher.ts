// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {InboundMessage, OutboundMessage} from '../vendor/embedded_sass_pb';
import {EmbeddedProcess} from './compiler/process';
import {PacketTransformer} from './compiler/packet-transformer';
import {MessageTransformer} from './compiler/message-transformer';
import {Observable, merge} from 'rxjs';
import {filter, first, map, take, takeUntil, tap} from 'rxjs/operators';

type RequestType =
  | OutboundMessage.MessageCase.IMPORTREQUEST
  | OutboundMessage.MessageCase.FILEIMPORTREQUEST
  | OutboundMessage.MessageCase.CANONICALIZEREQUEST
  | OutboundMessage.MessageCase.FUNCTIONCALLREQUEST;

type Request =
  | OutboundMessage.ImportRequest
  | OutboundMessage.FileImportRequest
  | OutboundMessage.CanonicalizeRequest
  | OutboundMessage.FunctionCallRequest;

type Response =
  | InboundMessage.ImportResponse
  | InboundMessage.FileImportResponse
  | InboundMessage.CanonicalizeResponse
  | InboundMessage.FunctionCallResponse;

/**
 * A facade to the Embedded Sass Compiler.
 *
 * Consumers can register callbacks for processing different types of compiler
 * requests. This will run the appropriate callback when the compiler emits a
 * request and then send the result back to the compiler.
 *
 * This also exposes an Observable of log events sent by the compiler.
 *
 * If there is a ProtocolError, this shuts down the compiler process and cleans
 * up all Observables.
 */
export class Dispatcher {
  // The Node child process that invokes the compiler.
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

  // Tracks the IDs of all outstanding requests. A dispatched response with a
  // matching ID clears the ID from this set.
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

  /** Log events sent by the compiler. */
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
   * Dispatches a compile request. Returns a promise that resolves when the
   * compiler sends a response with matching ID.
   */
  compile(request: InboundMessage.CompileRequest) {
    const id = this.nextRequestId();
    request.setId(id);
    this.recordRequest(id);

    const message = new InboundMessage();
    message.setCompilerequest(request);
    this.messageTransformer.write$.next(message);

    return this.messageTransformer.read$
      .pipe(
        filter(message => message.hasCompileresponse()),
        map(message => message.getCompileresponse()!),
        filter(response => response.getId() === id),
        tap(response => this.recordResponse(response.getId())),
        takeUntil(this.error$),
        take(1)
      )
      .toPromise();
  }

  /**
   * Registers a callback for processing all requests of type requestType.
   *
   * Runs the callback when the compiler emits a matching request, and sends the
   * result back to the compiler. The callback must return a response
   * that corresponds to the requestType. The callback can be synchronous
   * (handleRequest) or asynchronous (handleRequestAsync).
   */
  listen(
    requestType: RequestType,
    handleRequest?: (request: Request) => Response,
    handleRequestAsync?: (request: Request) => Promise<Response>
  ) {
    if (
      (handleRequest && handleRequestAsync) ||
      (!handleRequest && !handleRequestAsync)
    ) {
      throw Error('Pass either handleRequest or handleRequestAsync.');
    }

    this.messageTransformer.read$
      .pipe(
        filter(message => message.getMessageCase() === requestType),
        map(message => unwrapRequest(message)),
        tap(message => this.recordRequest(message.getId())),
        takeUntil(this.error$)
      )
      .subscribe(request => {
        if (handleRequest) {
          this.dispatchResponse(handleRequest(request), requestType);
        } else {
          handleRequestAsync!(request).then(response =>
            this.dispatchResponse(response, requestType)
          );
        }
      });
  }

  // Finds the next available slot in outstandingRequests.
  private nextRequestId() {
    for (let i = 0; i < this.outstandingRequests.size; i++) {
      if (!this.outstandingRequests.has(i)) {
        return i;
      }
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

  // Dispatches an InboundMessage containing the given response.
  private dispatchResponse(response: Response, requestType: RequestType) {
    const message = new InboundMessage();
    switch (requestType) {
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
        throw Error(`Request type ${requestType} is not supported.`);
    }
    this.recordResponse(response.getId());
    this.messageTransformer.write$.next(message);
  }

  /** Closes the Embedded Compiler and cleans up all associated Observables. */
  close() {
    this.messageTransformer.close();
    this.packetTransformer.close();
    this.embeddedProcess.close();
  }
}

// Returns the request that is contained within the given OutboundMessage.
function unwrapRequest(message: OutboundMessage): Request {
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
      throw Error(`Request type ${message.getMessageCase()} is not supported.`);
  }
}
