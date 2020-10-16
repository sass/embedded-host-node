// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {InboundMessage, OutboundMessage} from '../vendor/embedded_sass_pb';
import {EmbeddedProcess} from './compiler/process';
import {PacketTransformer} from './compiler/packet-transformer';
import {MessageTransformer} from './compiler/message-transformer';
import {Observable, merge} from 'rxjs';
import {
  filter,
  first,
  map,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs/operators';

type InboundRequestType = InboundMessage.MessageCase.COMPILEREQUEST;

type InboundRequest = InboundMessage.CompileRequest;

type OutboundResponse = OutboundMessage.CompileResponse;

type OutboundRequestType =
  | OutboundMessage.MessageCase.IMPORTREQUEST
  | OutboundMessage.MessageCase.FILEIMPORTREQUEST
  | OutboundMessage.MessageCase.CANONICALIZEREQUEST
  | OutboundMessage.MessageCase.FUNCTIONCALLREQUEST;

type OutboundRequest =
  | OutboundMessage.ImportRequest
  | OutboundMessage.FileImportRequest
  | OutboundMessage.CanonicalizeRequest
  | OutboundMessage.FunctionCallRequest;

type InboundResponse =
  | InboundMessage.ImportResponse
  | InboundMessage.FileImportResponse
  | InboundMessage.CanonicalizeResponse
  | InboundMessage.FunctionCallResponse;

type OutboundRequestHandler = (
  request: OutboundRequest
) => Promise<InboundResponse>;

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

  // Tracks the IDs of all requests sent by the compiler. A dispatched inbound
  // response with a matching ID clears the ID from this set.
  private readonly outstandingOutboundRequests = new Set<number>();

  // Tracks the IDs of all requests sent to the compiler. A dispatched outbound
  // response with a matching ID clears the ID from this set.
  private readonly outstandingInboundRequests = new Set<number>();

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

  /** All log events emitted by the compiler. */
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
   * Dispatches a CompileRequest. Returns a promise that resolves when the
   * compiler emits a CompileResponse with matching ID.
   */
  compile(
    request: InboundMessage.CompileRequest
  ): Promise<OutboundMessage.CompileResponse> {
    return this.handleInboundRequest(
      InboundMessage.MessageCase.COMPILEREQUEST,
      request
    );
  }

  /**
   * Registers a callback `handler` that runs whenever the compiler emits an
   * ImportRequest. Dispatches the result to the compiler.
   */
  onImportRequest(
    handler: (
      request: OutboundMessage.ImportRequest
    ) => Promise<InboundMessage.ImportResponse>
  ) {
    this.onOutboundRequest(
      OutboundMessage.MessageCase.IMPORTREQUEST,
      handler as OutboundRequestHandler
    );
  }

  /**
   * Registers a callback `handler` that runs whenever the compiler emits a
   * FileImportRequest. Dispatches the result to the compiler.
   */
  onFileImportRequest(
    handler: (
      request: OutboundMessage.FileImportRequest
    ) => Promise<InboundMessage.FileImportResponse>
  ) {
    this.onOutboundRequest(
      OutboundMessage.MessageCase.FILEIMPORTREQUEST,
      handler as OutboundRequestHandler
    );
  }

  /**
   * Registers a callback `handler` that runs whenever the compiler emits a
   * CanonicalizeRequest. Dispatches the result to the compiler.
   */
  onCanonicalizeRequest(
    handler: (
      request: OutboundMessage.CanonicalizeRequest
    ) => Promise<InboundMessage.CanonicalizeResponse>
  ) {
    this.onOutboundRequest(
      OutboundMessage.MessageCase.CANONICALIZEREQUEST,
      handler as OutboundRequestHandler
    );
  }

  /**
   * Registers a callback `handler` that runs whenever the compiler emits a
   * FunctionCallRequest. Dispatches the result to the compiler.
   */
  onFunctionCallRequest(
    handler: (
      request: OutboundMessage.FunctionCallRequest
    ) => Promise<InboundMessage.FunctionCallResponse>
  ) {
    this.onOutboundRequest(
      OutboundMessage.MessageCase.FUNCTIONCALLREQUEST,
      handler as OutboundRequestHandler
    );
  }

  /** Closes the Embedded Compiler and cleans up all associated Observables. */
  close() {
    this.messageTransformer.close();
    this.packetTransformer.close();
    this.embeddedProcess.close();
  }

  // Dispatches `request` to the compiler, and returns a promise that resolves
  // when the compiler emits a response that matches `type`.
  private handleInboundRequest(
    type: InboundRequestType,
    request: InboundRequest
  ): Promise<OutboundResponse> {
    // Send request to the compiler.
    setId(this.outstandingInboundRequests, request);
    recordRequest(this.outstandingInboundRequests, request.getId());
    const message = wrapInboundRequest(request, type);
    this.messageTransformer.write$.next(message);

    return this.messageTransformer.read$
      .pipe(
        // Filter out irrelevant responses.
        map(message => unwrapOutboundResponse(message, type)),
        filter(
          (response): response is OutboundResponse =>
            response !== null && response.getId() === request.getId()
        ),
        // Resolve the outstanding request.
        tap(response =>
          recordResponse(this.outstandingInboundRequests, response.getId())
        ),
        takeUntil(this.error$),
        take(1)
      )
      .toPromise();
  }

  // Registers a callback `handler` that runs whenever the compiler emits
  // a request that matches `type`. Dispatches the result to the compiler.
  private onOutboundRequest(
    type: OutboundRequestType,
    handler: OutboundRequestHandler
  ) {
    this.messageTransformer.read$.pipe(
      // Filter out irrelevant requests.
      map(message => unwrapOutboundRequest(message, type)),
      filter((request): request is OutboundRequest => request !== null),
      // Record the outstanding request.
      tap(request =>
        recordRequest(this.outstandingOutboundRequests, request.getId())
      ),
      // Run the callback to process the request.
      switchMap(async request => {
        const response = await handler(request);
        response.setId(request.getId());
        return response;
      }),
      // Resolve the outstanding request.
      tap(response =>
        recordResponse(this.outstandingOutboundRequests, response.getId())
      ),
      // Create an InboundMessage containing the response.
      map(response => wrapInboundResponse(response, type)),
      // Send the response to the compiler.
      tap(message => this.messageTransformer.write$.next(message)),
      takeUntil(this.error$)
    );
  }
}

// Finds the next available id in `outstandingRequests`, and sets `request`'s
// id to it.
function setId(outstandingRequests: Set<number>, request: InboundRequest) {
  for (let i = 0; i < outstandingRequests.size; i++) {
    if (!outstandingRequests.has(i)) {
      request.setId(i);
      return;
    }
  }
  request.setId(outstandingRequests.size);
}

// Adds an ID to `outstandingRequests`. Throws an error if the ID already
// exists.
function recordRequest(outstandingRequests: Set<number>, id: number) {
  if (outstandingRequests.has(id)) {
    throw Error('Request ID overlaps with existing outstanding request ID.');
  }
  outstandingRequests.add(id);
}

// Removes an ID from `outstandingRequests`. Throws an error if the ID does not
// exist.
function recordResponse(outstandingRequests: Set<number>, id: number) {
  if (!outstandingRequests.has(id)) {
    throw Error('Response id does not match any outstanding request IDs.');
  }
  outstandingRequests.delete(id);
}

// Wraps `request` (which is of type `type`) inside an OutboundMessage and
// returns the message.
function wrapInboundRequest(
  request: InboundRequest,
  type: InboundRequestType
): InboundMessage {
  const message = new InboundMessage();
  switch (type) {
    case InboundMessage.MessageCase.COMPILEREQUEST:
      message.setCompilerequest(request as InboundMessage.CompileRequest);
      break;
  }
  return message;
}

// Wraps the `response` (which resolves requests of type `type`) into an
// InboundMessage and returns the message.
function wrapInboundResponse(
  response: InboundResponse,
  type: OutboundRequestType
): InboundMessage {
  const message = new InboundMessage();
  switch (type) {
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
  }
  return message;
}

// If `message` contains a response that resolves a request of type `type`,
// unwraps and returns the response.
function unwrapOutboundResponse(
  message: OutboundMessage,
  type: InboundRequestType
): OutboundResponse | null {
  switch (type) {
    case InboundMessage.MessageCase.COMPILEREQUEST:
      if (message.hasCompileresponse()) return message.getCompileresponse()!;
      break;
  }
  return null;
}

// If `message` contains a request of type `type`, unwraps and returns the
// request.
function unwrapOutboundRequest(
  message: OutboundMessage,
  type: OutboundRequestType
): OutboundRequest | null {
  switch (type) {
    case OutboundMessage.MessageCase.IMPORTREQUEST:
      if (message.hasImportrequest()) return message.getImportrequest()!;
      break;
    case OutboundMessage.MessageCase.FILEIMPORTREQUEST:
      if (message.hasFileimportrequest())
        return message.getFileimportrequest()!;
      break;
    case OutboundMessage.MessageCase.CANONICALIZEREQUEST:
      if (message.hasCanonicalizerequest())
        return message.getCanonicalizerequest()!;
      break;
    case OutboundMessage.MessageCase.FUNCTIONCALLREQUEST:
      if (message.hasFunctioncallrequest())
        return message.getFunctioncallrequest()!;
  }
  return null;
}
