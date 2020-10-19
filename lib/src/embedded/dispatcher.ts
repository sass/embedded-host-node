// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

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

import {InboundMessage, OutboundMessage} from '../vendor/embedded_sass_pb';
import {MessageTransformer} from './compiler/message-transformer';
import {PacketTransformer} from './compiler/packet-transformer';
import {EmbeddedProcess} from './compiler/process';

type InboundRequestType = InboundMessage.MessageCase.COMPILEREQUEST;

type InboundRequest = InboundMessage.CompileRequest;

type InboundResponseType =
  | InboundMessage.MessageCase.IMPORTRESPONSE
  | InboundMessage.MessageCase.FILEIMPORTRESPONSE
  | InboundMessage.MessageCase.CANONICALIZERESPONSE
  | InboundMessage.MessageCase.FUNCTIONCALLRESPONSE;

type InboundResponse =
  | InboundMessage.ImportResponse
  | InboundMessage.FileImportResponse
  | InboundMessage.CanonicalizeResponse
  | InboundMessage.FunctionCallResponse;

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

type OutboundResponseType = OutboundMessage.MessageCase.COMPILERESPONSE;

type OutboundResponse = OutboundMessage.CompileResponse;

type OutboundRequestHandler = (
  request: OutboundRequest
) => Promise<InboundResponse>;

/**
 * A facade to the Embedded Sass Compiler.
 *
 * Consumers can register callbacks for processing different types of compiler
 * requests. This runs the registered callback when the compiler emits a
 * request, and then sends the result back to the compiler.
 *
 * Also exposes Observable of events emitted by the compiler.
 *
 * If there is a ProtocolError,  shuts down the compiler process and cleans up
 * all Observables.
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

  // Tracks the IDs of all requests sent to the compiler. A dispatched outbound
  // response with matching ID and type will remove the ID from here.
  private readonly pendingInboundRequests = new RequestTracker();

  // Tracks the IDs of all requests sent by the compiler. A dispatched inbound
  // response with matching ID and type will remove the ID from here.
  private readonly pendingOutboundRequests = new RequestTracker();

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
    this.monitorRequestsAndResponses();

    this.embeddedProcess.stderr$.subscribe(buffer => {
      process.stderr.write(buffer);
    });

    merge(this.error$, this.embeddedProcess.exit$)
      .pipe(first())
      .subscribe(() => process.nextTick(() => this.close()));
  }

  /**
   * Dispatches a CompileRequest. Returns a promise that resolves when the
   * compiler emits a CompileResponse with matching ID.
   */
  sendCompileRequest(
    request: InboundMessage.CompileRequest
  ): Promise<OutboundMessage.CompileResponse> {
    return this.handleInboundRequest(
      request,
      InboundMessage.MessageCase.COMPILEREQUEST,
      OutboundMessage.MessageCase.COMPILERESPONSE
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
      handler as OutboundRequestHandler,
      OutboundMessage.MessageCase.IMPORTREQUEST,
      InboundMessage.MessageCase.IMPORTRESPONSE
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
      handler as OutboundRequestHandler,
      OutboundMessage.MessageCase.FILEIMPORTREQUEST,
      InboundMessage.MessageCase.FILEIMPORTRESPONSE
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
      handler as OutboundRequestHandler,
      OutboundMessage.MessageCase.CANONICALIZEREQUEST,
      InboundMessage.MessageCase.CANONICALIZERESPONSE
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
      handler as OutboundRequestHandler,
      OutboundMessage.MessageCase.FUNCTIONCALLREQUEST,
      InboundMessage.MessageCase.FUNCTIONCALLRESPONSE
    );
  }

  /** Closes the compiler and cleans up all associated Observables. */
  close() {
    this.messageTransformer.close();
    this.packetTransformer.close();
    this.embeddedProcess.close();
  }

  // Detects Protocol Errors caused by bad request IDs by tracking and resolving
  // all request IDs sent to/from the compiler. For example, the compiler can
  // cause an error by sending a request with an ID already in use by another
  // in-flight request.
  private monitorRequestsAndResponses() {
    this.messageTransformer.read$.subscribe(message => {
      switch (message.getMessageCase()) {
        case OutboundMessage.MessageCase.COMPILERESPONSE:
          this.pendingInboundRequests.resolve(
            message.getCompileresponse()!.getId(),
            OutboundMessage.MessageCase.COMPILERESPONSE
          );
          break;
        case OutboundMessage.MessageCase.IMPORTREQUEST:
          this.pendingOutboundRequests.add(
            message.getImportrequest()!.getId(),
            InboundMessage.MessageCase.IMPORTRESPONSE
          );
          break;
        case OutboundMessage.MessageCase.FILEIMPORTREQUEST:
          this.pendingOutboundRequests.add(
            message.getFileimportrequest()!.getId(),
            InboundMessage.MessageCase.FILEIMPORTRESPONSE
          );
          break;
        case OutboundMessage.MessageCase.CANONICALIZEREQUEST:
          this.pendingOutboundRequests.add(
            message.getCanonicalizerequest()!.getId(),
            InboundMessage.MessageCase.CANONICALIZERESPONSE
          );
          break;
        case OutboundMessage.MessageCase.FUNCTIONCALLREQUEST:
          this.pendingOutboundRequests.add(
            message.getFunctioncallrequest()!.getId(),
            InboundMessage.MessageCase.FUNCTIONCALLRESPONSE
          );
          break;
      }
    });

    this.messageTransformer.write$.subscribe(message => {
      switch (message.getMessageCase()) {
        case InboundMessage.MessageCase.COMPILEREQUEST:
          this.pendingInboundRequests.add(
            message.getCompilerequest()!.getId(),
            OutboundMessage.MessageCase.COMPILERESPONSE
          );
          break;
        case InboundMessage.MessageCase.IMPORTRESPONSE:
          this.pendingInboundRequests.resolve(
            message.getImportresponse()!.getId(),
            InboundMessage.MessageCase.IMPORTRESPONSE
          );
          break;
        case InboundMessage.MessageCase.FILEIMPORTRESPONSE:
          this.pendingInboundRequests.resolve(
            message.getFileimportresponse()!.getId(),
            InboundMessage.MessageCase.FILEIMPORTRESPONSE
          );
          break;
        case InboundMessage.MessageCase.CANONICALIZERESPONSE:
          this.pendingInboundRequests.resolve(
            message.getCanonicalizeresponse()!.getId(),
            InboundMessage.MessageCase.CANONICALIZERESPONSE
          );
          break;
        case InboundMessage.MessageCase.FUNCTIONCALLRESPONSE:
          this.pendingInboundRequests.resolve(
            message.getFunctioncallresponse()!.getId(),
            InboundMessage.MessageCase.FUNCTIONCALLRESPONSE
          );
          break;
      }
    });
  }

  // Dispatches `request` of type `requestType` to the compiler. Returns a
  // promise that resolves when the compiler emits a response that matches
  // `expectedResponseType`.
  private handleInboundRequest(
    request: InboundRequest,
    requestType: InboundRequestType,
    expectedResponseType: OutboundResponseType
  ): Promise<OutboundResponse> {
    request.setId(this.pendingInboundRequests.nextId);
    this.messageTransformer.write$.next(inboundMessage(request, requestType));

    return this.messageTransformer.read$
      .pipe(
        filter(message => message.getMessageCase() === expectedResponseType),
        map(message => unwrapOutboundMessage(message)),
        filter((response): response is OutboundResponse => response !== null),
        filter(response => response.getId() === request.getId()),
        takeUntil(this.error$),
        take(1)
      )
      .toPromise();
  }

  // Registers a callback `handler` that runs whenever the compiler emits
  // a request that matches `requestType`. Dispatches the result, which is of
  // type `expectedResponseType`, to the compiler.
  private onOutboundRequest(
    handler: OutboundRequestHandler,
    requestType: OutboundRequestType,
    expectedResponseType: InboundResponseType
  ) {
    this.messageTransformer.read$.pipe(
      filter(message => message.getMessageCase() === requestType),
      map(message => unwrapOutboundMessage(message)),
      filter((request): request is OutboundRequest => request !== null),
      switchMap(async request => {
        const response = await handler(request);
        response.setId(request.getId());
        return response;
      }),
      map(response => inboundMessage(response, expectedResponseType)),
      tap(message => this.messageTransformer.write$.next(message))
    );
  }
}

/**
 * Tracks pending inbound and outbound requests.
 */
class RequestTracker {
  // The indices of this array correspond to each pending request's ID. Stores
  // the response type expected by each request.
  private readonly requests: Array<
    InboundResponseType | OutboundResponseType | null
  > = [];

  /** The next available request ID. */
  get nextId() {
    for (let i = 0; i < this.requests.length; i++) {
      if (this.requests[i] === null) {
        return i;
      }
    }
    return this.requests.length;
  }

  /**
   * Adds an entry for a pending request with ID `id`. The entry stores the
   * expected response type. Throws an error if the Protocol Error is violated.
   */
  add(
    id: number,
    expectedResponseType: InboundResponseType | OutboundResponseType
  ) {
    if (this.requests[id]) {
      throw Error(
        `Outbound request ID ${id} is already in use by an in-flight request.`
      );
    }

    this.requests[id] = expectedResponseType;
  }

  /**
   * Resolves a pending request with matching ID `id` and expected response type
   * `type`. Throws an error if the Protocol Error is violated.
   */
  resolve(id: number, type: InboundResponseType | OutboundResponseType) {
    if (this.requests[id] === undefined || this.requests[id] === null) {
      throw Error(`Response ID ${id} does not match any pending requests.`);
    }

    if (this.requests[id] !== type) {
      throw Error(
        "Outbound response type does not match the pending request's type."
      );
    }

    this.requests[id] = null;
  }
}

// Constructs an InboundMessage that contains a `payload` of type `type`.
function inboundMessage(
  payload: InboundRequest | InboundResponse,
  type: InboundRequestType | InboundResponseType
): InboundMessage {
  const message = new InboundMessage();
  switch (type) {
    case InboundMessage.MessageCase.COMPILEREQUEST:
      message.setCompilerequest(payload as InboundMessage.CompileRequest);
      break;
    case InboundMessage.MessageCase.IMPORTRESPONSE:
      message.setImportresponse(payload as InboundMessage.ImportResponse);
      break;
    case InboundMessage.MessageCase.FILEIMPORTRESPONSE:
      message.setFileimportresponse(
        payload as InboundMessage.FileImportResponse
      );
      break;
    case InboundMessage.MessageCase.CANONICALIZERESPONSE:
      message.setCanonicalizeresponse(
        payload as InboundMessage.CanonicalizeResponse
      );
      break;
    case InboundMessage.MessageCase.FUNCTIONCALLRESPONSE:
      message.setFunctioncallresponse(
        payload as InboundMessage.FunctionCallResponse
      );
      break;
  }
  return message;
}

// Unwraps `message` to reveal the nested request, response, or event.
function unwrapOutboundMessage(
  message: OutboundMessage
): OutboundRequest | OutboundResponse | OutboundMessage.LogEvent | null {
  switch (message.getMessageCase()) {
    case OutboundMessage.MessageCase.COMPILERESPONSE:
      return message.getCompileresponse()!;
    case OutboundMessage.MessageCase.LOGEVENT:
      return message.getLogevent()!;
    case OutboundMessage.MessageCase.IMPORTREQUEST:
      return message.getImportrequest()!;
    case OutboundMessage.MessageCase.FILEIMPORTREQUEST:
      return message.getFileimportrequest()!;
    case OutboundMessage.MessageCase.CANONICALIZEREQUEST:
      return message.getCanonicalizerequest()!;
    case OutboundMessage.MessageCase.FUNCTIONCALLREQUEST:
      return message.getFunctioncallrequest()!;
  }
  return null;
}
