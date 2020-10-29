// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable, Subject, Subscription} from 'rxjs';
import {filter, map, tap} from 'rxjs/operators';

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
import {RequestTracker} from './request-tracker';

type PromiseOr<T> = T | Promise<T>;

/**
 * Dispatches requests, responses, and events.
 *
 * Consumers can send an inbound request. This returns a promise that will
 * either resolve with the corresponding outbound response, or error if any
 * Protocol Errors were encountered.
 *
 * Consumers can register callbacks for processing different types of outbound
 * requests. When an outbound request arrives, this runs the appropriate
 * registered callback to process it, then sends the result inbound. After
 * registering a callback, consumers receive a subscription to an Observable
 * that emits each request. If any Protocol Errors are encountered, these
 * subscriptions close quietly, and the error is not thrown to the consumer.
 *
 * Requests and responses do not need to have their ID set, since the dispatcher
 * handles setting the ID on all messages.
 *
 * Errors are exposed as an Observable that consumers may choose to subscribe
 * to. Subscribers must perform proper error handling.
 */
export class Dispatcher {
  // Tracks the IDs of all inbound requests. An outbound response with matching
  // ID and type will remove the ID.
  private readonly pendingInboundRequests = new RequestTracker();

  // Tracks the IDs of all outbound requests. An inbound response with matching
  // ID and type will remove the ID.
  private readonly pendingOutboundRequests = new RequestTracker();

  // All outbound messages. If we detect any errors while dispatching messages,
  // this completes.
  private readonly messages$ = new Subject<OutboundTypedMessage>();

  // If the dispatcher encounters an error, this errors out. It is publicly
  // exposed as a readonly Observable.
  private readonly errorInternal$ = new Subject<void>();

  /**
   * If the dispatcher encounters an error, this errors out. Upon error, the
   * dispatcher rejects all promises awaiting an outbound response, and silently
   * closes all subscriptions awaiting outbound requests and events.
   */
  readonly error$ = this.errorInternal$.pipe();

  /**
   * Outbound log events. If an error occurs, the dispatcher closes this
   * silently.
   */
  readonly logEvents$ = this.messages$.pipe(
    filter(message => message.type === OutboundMessage.MessageCase.LOGEVENT),
    map(message => message.payload as OutboundMessage.LogEvent)
  );

  constructor(
    private readonly outboundMessages$: Observable<OutboundTypedMessage>,
    private readonly writeInboundMessage: (message: InboundTypedMessage) => void
  ) {
    this.outboundMessages$
      .pipe(tap(message => this.registerOutboundMessage(message)))
      .subscribe(
        message => this.messages$.next(message),
        error => this.throwAndClose(error),
        () => {
          this.messages$.complete();
          this.errorInternal$.complete();
        }
      );
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
   * Subscribes to outbound ImportRequests, registering a callback `handler`
   * that runs when a request arrives. Returns the subscription.
   */
  onImportRequest(
    handler: (
      request: OutboundMessage.ImportRequest
    ) => PromiseOr<InboundMessage.ImportResponse>
  ): Subscription {
    return this.onOutboundRequest(
      handler,
      OutboundMessage.MessageCase.IMPORTREQUEST,
      InboundMessage.MessageCase.IMPORTRESPONSE
    );
  }

  /**
   * Subscribes to outbound FileImportRequests, registering a callback `handler`
   * that runs when a request arrives. Returns the subscription.
   */
  onFileImportRequest(
    handler: (
      request: OutboundMessage.FileImportRequest
    ) => PromiseOr<InboundMessage.FileImportResponse>
  ): Subscription {
    return this.onOutboundRequest(
      handler,
      OutboundMessage.MessageCase.FILEIMPORTREQUEST,
      InboundMessage.MessageCase.FILEIMPORTRESPONSE
    );
  }

  /**
   * Subscribes to outbound CanonicalizeRequests, registering a callback
   * `handler` that runs when a request arrives. Returns the subscription.
   */
  onCanonicalizeRequest(
    handler: (
      request: OutboundMessage.CanonicalizeRequest
    ) => PromiseOr<InboundMessage.CanonicalizeResponse>
  ): Subscription {
    return this.onOutboundRequest(
      handler,
      OutboundMessage.MessageCase.CANONICALIZEREQUEST,
      InboundMessage.MessageCase.CANONICALIZERESPONSE
    );
  }

  /**
   * Subscribes to outbound FunctionCallRequests, registering a callback
   * `handler` that runs when a request arrives. Returns the subscription.
   */
  onFunctionCallRequest(
    handler: (
      request: OutboundMessage.FunctionCallRequest
    ) => PromiseOr<InboundMessage.FunctionCallResponse>
  ): Subscription {
    return this.onOutboundRequest(
      handler,
      OutboundMessage.MessageCase.FUNCTIONCALLREQUEST,
      InboundMessage.MessageCase.FUNCTIONCALLRESPONSE
    );
  }

  // Rejects with `error` all promises awaiting an outbound response, and
  // silently closes all subscriptions awaiting outbound requests and events.
  private throwAndClose(error: Error) {
    this.messages$.complete();
    this.errorInternal$.error(error);
  }

  // Sends a `request` of type `requestType` inbound. Returns a promise that
  // resolves with an outbound response of type `responseType` answers the
  // request, or errors if any errors were encountered.
  private handleInboundRequest(
    request: InboundRequest,
    requestType: InboundRequestType,
    responseType: OutboundResponseType
  ): Promise<OutboundResponse> {
    return new Promise((resolve, reject) => {
      this.messages$
        .pipe(
          filter(message => message.type === responseType),
          map(message => message.payload as OutboundResponse),
          filter(response => response.getId() === request.getId())
        )
        .subscribe({next: resolve});

      this.error$.subscribe({error: reject});

      try {
        request.setId(this.pendingInboundRequests.nextId);
        this.sendInboundMessage(request, requestType);
      } catch (error) {
        this.throwAndClose(error);
      }
    });
  }

  // Subscribes to outbound requests of type `requestType`, registering a
  // callback that runs when a request arrives. Sends the result of running the
  // callback (which is of type `responseType`) inbound. Returns the
  // subscription so that consumers can unsubscribe.
  private onOutboundRequest<
    T1 extends OutboundRequest,
    T2 extends InboundResponse
  >(
    handler: (request: T1) => PromiseOr<T2>,
    requestType: OutboundRequestType,
    responseType: InboundResponseType
  ): Subscription {
    return this.messages$
      .pipe(
        filter(message => message.type === requestType),
        map(message => message.payload as OutboundRequest)
      )
      .subscribe(async request => {
        try {
          const response = await handler(request as T1);
          response.setId(request.getId());
          this.sendInboundMessage(response, responseType);
        } catch (error) {
          this.throwAndClose(error);
        }
      });
  }

  // Sends a message inbound. Keeps track of all pending inbound requests.
  private sendInboundMessage(
    payload: InboundRequest | InboundResponse,
    type: InboundRequestType | InboundResponseType
  ): void {
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
    } else {
      throw Error(`Unknown message type ${type}`);
    }

    this.writeInboundMessage({
      payload,
      type,
    });
  }

  // If the outbound `message` contains a request or response, registers it with
  // pendingOutboundRequests.
  private registerOutboundMessage(message: OutboundTypedMessage): void {
    switch (message.type) {
      case OutboundMessage.MessageCase.LOGEVENT:
        break;
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
      default:
        throw Error(`Unknown message type ${message.type}`);
    }
  }
}
