// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable, Subject, Subscription} from 'rxjs';
import {filter, map} from 'rxjs/operators';

import {InboundMessage, OutboundMessage} from '../vendor/embedded_sass_pb';
import {
  InboundRequest,
  InboundRequestType,
  InboundResponse,
  InboundResponseType,
  InboundTypedMessage,
  OutboundRequest,
  OutboundRequestType,
  OutboundResponse,
  OutboundResponseType,
  OutboundTypedMessage,
} from './message-transformer';

/**
 * Dispatches requests, responses, and events.
 *
 * Consumers can send an inbound request. This returns a promise that resolves
 * with the corresponding outbound response, or errors if any Protocol Errors
 * were encountered.
 *
 * Consumers can also register callbacks for processing different types of
 * outbound requests. When an outbound request arrives, this runs the
 * appropriate callback to process it, then sends the result inbound. Errors
 * are not thrown to outbound request listeners; outbound request streams die
 * quietly.
 *
 * Requests and responses do not need to have their ID set, since the dispatcher
 * handles setting the ID on all messages.
 *
 * Detects ProtocolErrors caused by mismatched requests and responses.
 */
export class Dispatcher {
  // Tracks the IDs of all inbound requests. An outbound response with matching
  // ID and type will remove the ID.
  private readonly pendingInboundRequests = new RequestTracker();

  // Tracks the IDs of all outbound requests. An inbound response with matching
  // ID and type will remove the ID.
  private readonly pendingOutboundRequests = new RequestTracker();

  // Collects all errors that we might encounter.
  private readonly error$ = new Subject<Error>();

  // Outbound messages are routed through here to keep track of all pending
  // outbound requests. If any errors are detected while dispatching messages,
  // this Observable will close.
  private readonly messages$ = new Observable<OutboundTypedMessage>(
    observer => {
      this.outboundMessages$.subscribe(
        message => {
          this.registerOutboundMessage(message);
          observer.next(message);
        },
        error => this.error$.next(error),
        () => observer.complete()
      );

      this.error$.subscribe(() => observer.complete());
    }
  );

  /** All outbound log events. */
  readonly logEvents$ = this.messages$.pipe(
    filter(message => message.type === OutboundMessage.MessageCase.LOGEVENT),
    map(message => message.payload as OutboundMessage.LogEvent)
  );

  constructor(
    private readonly outboundMessages$: Observable<OutboundTypedMessage>,
    private readonly writeInboundMessage: (message: InboundTypedMessage) => void
  ) {
    this.error$.subscribe(() => process.nextTick(() => this.error$.complete()));
  }

  /**
   * Sends a CompileRequest inbound. Returns a promise that resolves with an
   * outbound CompileResponse that answers the request, or errors if any
   * Protocol Errors were encountered.
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
   * Registers a callback `handler` that listens for outbound ImportRequests.
   */
  onImportRequest(
    handler: (
      request: OutboundMessage.ImportRequest
    ) => InboundMessage.ImportResponse | Promise<InboundMessage.ImportResponse>
  ): void {
    this.onOutboundRequest(
      handler,
      OutboundMessage.MessageCase.IMPORTREQUEST,
      InboundMessage.MessageCase.IMPORTRESPONSE
    );
  }

  /**
   * Registers a callback `handler` that listens for outbound
   * FileImportRequests.
   */
  onFileImportRequest(
    handler: (
      request: OutboundMessage.FileImportRequest
    ) =>
      | InboundMessage.FileImportResponse
      | Promise<InboundMessage.FileImportResponse>
  ): void {
    this.onOutboundRequest(
      handler,
      OutboundMessage.MessageCase.FILEIMPORTREQUEST,
      InboundMessage.MessageCase.FILEIMPORTRESPONSE
    );
  }

  /**
   * Registers a callback `handler` that listens for outbound
   * CanonicalizeRequests.
   */
  onCanonicalizeRequest(
    handler: (
      request: OutboundMessage.CanonicalizeRequest
    ) =>
      | InboundMessage.CanonicalizeResponse
      | Promise<InboundMessage.CanonicalizeResponse>
  ): void {
    this.onOutboundRequest(
      handler,
      OutboundMessage.MessageCase.CANONICALIZEREQUEST,
      InboundMessage.MessageCase.CANONICALIZERESPONSE
    );
  }

  /**
   * Registers a callback `handler` that listens for outbound
   * FunctionCallRequests.
   */
  onFunctionCallRequest(
    handler: (
      request: OutboundMessage.FunctionCallRequest
    ) =>
      | InboundMessage.FunctionCallResponse
      | Promise<InboundMessage.FunctionCallResponse>
  ): void {
    this.onOutboundRequest(
      handler,
      OutboundMessage.MessageCase.FUNCTIONCALLREQUEST,
      InboundMessage.MessageCase.FUNCTIONCALLRESPONSE
    );
  }

  // Sends a `request` of type `requestType` inbound. Returns a promise that
  // resolves with an outbound response of type `responseType` answers the
  // request, or errors if any errors were encountered.
  private handleInboundRequest(
    request: InboundRequest,
    requestType: InboundRequestType,
    responseType: OutboundResponseType
  ): Promise<OutboundResponse> {
    request.setId(this.pendingInboundRequests.nextId);
    process.nextTick(() => this.sendInboundMessage(request, requestType));

    return new Promise((resolve, reject) => {
      this.messages$
        .pipe(
          filter(message => message.type === responseType),
          map(message => message.payload as OutboundResponse),
          filter(response => response.getId() === request.getId())
        )
        .subscribe(response => resolve(response));

      this.error$.subscribe(error => reject(error));
    });
  }

  // Registers a callback `handler` that listens for outbound requests of type
  // `requestType`. Sends the result (which is of type `responseType`) inbound.
  private onOutboundRequest<
    T1 extends OutboundRequest,
    T2 extends InboundResponse
  >(
    handler: (request: T1) => T2 | Promise<T2>,
    requestType: OutboundRequestType,
    responseType: InboundResponseType
  ): Subscription {
    return this.messages$
      .pipe(
        filter(message => message.type === requestType),
        map(message => message.payload as OutboundRequest)
      )
      .subscribe(async request => {
        const response = await handler(request as T1);
        response.setId(request.getId());
        this.sendInboundMessage(response, responseType);
      });
  }

  // Sends a message inbound. Keeps track of all pending inbound requests.
  private sendInboundMessage(
    payload: InboundRequest | InboundResponse,
    type: InboundRequestType | InboundResponseType
  ): void {
    try {
      if (type === InboundMessage.MessageCase.COMPILEREQUEST) {
        this.pendingInboundRequests.add(
          payload.getId(),
          OutboundMessage.MessageCase.COMPILERESPONSE
        );
      } else if (
        type === InboundMessage.MessageCase.IMPORTRESPONSE ||
        type === InboundMessage.MessageCase.FILEIMPORTRESPONSE ||
        type === InboundMessage.MessageCase.CANONICALIZERESPONSE ||
        type === InboundMessage.MessageCase.FUNCTIONCALLRESPONSE
      ) {
        this.pendingOutboundRequests.resolve(payload.getId(), type);
      }

      this.writeInboundMessage({
        payload,
        type,
      });
    } catch (error) {
      this.error$.next(error);
    }
  }

  // If the outbound `message` contains a request or response, registers it with
  // pendingOutboundRequests.
  private registerOutboundMessage(message: OutboundTypedMessage): void {
    try {
      switch (message.type) {
        case OutboundMessage.MessageCase.COMPILERESPONSE:
          this.pendingInboundRequests.resolve(
            (message.payload as OutboundResponse).getId(),
            message.type
          );
          break;
        case OutboundMessage.MessageCase.IMPORTREQUEST:
          this.pendingOutboundRequests.add(
            (message.payload as OutboundRequest).getId(),
            InboundMessage.MessageCase.IMPORTRESPONSE
          );
          break;
        case OutboundMessage.MessageCase.FILEIMPORTREQUEST:
          this.pendingOutboundRequests.add(
            (message.payload as OutboundRequest).getId(),
            InboundMessage.MessageCase.FILEIMPORTRESPONSE
          );
          break;
        case OutboundMessage.MessageCase.CANONICALIZEREQUEST:
          this.pendingOutboundRequests.add(
            (message.payload as OutboundRequest).getId(),
            InboundMessage.MessageCase.CANONICALIZERESPONSE
          );
          break;
        case OutboundMessage.MessageCase.FUNCTIONCALLREQUEST:
          this.pendingOutboundRequests.add(
            (message.payload as OutboundRequest).getId(),
            InboundMessage.MessageCase.FUNCTIONCALLRESPONSE
          );
          break;
      }
    } catch (error) {
      this.error$.next(error);
    }
  }
}

/**
 * Manages pending inbound and outbound requests. Ensures that requests and
 * responses interact correctly and obey the Embedded Protocol.
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
        `Request ID ${id} is already in use by an in-flight request.`
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
      throw Error("Response type does not match the pending request's type.");
    }
    this.requests[id] = null;
  }
}
