// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable, Subject} from 'rxjs';
import {filter, map, mergeMap} from 'rxjs/operators';

import {
  InboundMessage,
  OutboundMessage,
} from './vendor/embedded-protocol/embedded_sass_pb';
import {
  InboundRequest,
  InboundRequestType,
  InboundResponse,
  InboundResponseType,
  InboundTypedMessage,
  OutboundResponse,
  OutboundResponseType,
  OutboundTypedMessage,
} from './message-transformer';
import {RequestTracker} from './request-tracker';
import {PromiseOr, thenOr} from './utils';

/**
 * Dispatches requests, responses, and events.
 *
 * Accepts callbacks for processing different types of outbound requests. When
 * an outbound request arrives, this runs the appropriate callback to process
 * it, and then sends the result inbound. A single callback must be provided for
 * each outbound request type. The callback does not need to set the response
 * ID; the dispatcher handles it.
 *
 * Consumers can send an inbound request. This returns a promise that will
 * either resolve with the corresponding outbound response, or error if any
 * Protocol Errors were encountered. The consumer does not need to set the
 * request ID; the dispatcher handles it.
 *
 * Outbound events are exposed as Observables.
 *
 * Errors are not otherwise exposed to the top-level. Instead, they are surfaced
 * as an Observable that consumers may choose to subscribe to. Subscribers must
 * perform proper error handling.
 */
export class Dispatcher<sync extends 'sync' | 'async'> {
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
   * closes all subscriptions to outbound events.
   */
  readonly error$ = this.errorInternal$.pipe();

  /**
   * Outbound log events. If an error occurs, the dispatcher closes this
   * silently.
   */
  readonly logEvents$ = this.messages$.pipe(
    filter(message => message.type === OutboundMessage.MessageCase.LOG_EVENT),
    map(message => message.payload as OutboundMessage.LogEvent)
  );

  constructor(
    private readonly outboundMessages$: Observable<OutboundTypedMessage>,
    private readonly writeInboundMessage: (
      message: InboundTypedMessage
    ) => void,
    private readonly outboundRequestHandlers: DispatcherHandlers<sync>
  ) {
    this.outboundMessages$
      .pipe(
        mergeMap(message => {
          const result = this.handleOutboundMessage(message);
          return result instanceof Promise
            ? result.then(() => message)
            : [message];
        })
      )
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
   * Sends a CompileRequest inbound. Passes the corresponding outbound
   * CompileResponse or an error to `callback`.
   *
   * This uses an old-style callback argument so that it can work either
   * synchronously or asynchronously. If the underlying stdout stream emits
   * events synchronously, `callback` will be called synchronously.
   */
  sendCompileRequest(
    request: InboundMessage.CompileRequest,
    callback: (
      err: unknown,
      response: OutboundMessage.CompileResponse | undefined
    ) => void
  ): void {
    this.handleInboundRequest(
      request,
      InboundMessage.MessageCase.COMPILE_REQUEST,
      OutboundMessage.MessageCase.COMPILE_RESPONSE,
      callback
    );
  }

  // Rejects with `error` all promises awaiting an outbound response, and
  // silently closes all subscriptions awaiting outbound events.
  private throwAndClose(error: unknown): void {
    this.messages$.complete();
    this.errorInternal$.error(error);
  }

  // Keeps track of all outbound messages. If the outbound `message` contains a
  // request or response, registers it with pendingOutboundRequests. If it
  // contains a request, runs the appropriate callback to generate an inbound
  // response, and then sends it inbound.
  private handleOutboundMessage(
    message: OutboundTypedMessage
  ): PromiseOr<void, sync> {
    switch (message.type) {
      case OutboundMessage.MessageCase.LOG_EVENT:
        return undefined;

      case OutboundMessage.MessageCase.COMPILE_RESPONSE:
        this.pendingInboundRequests.resolve(
          (message.payload as OutboundResponse).getId(),
          message.type
        );
        return undefined;

      case OutboundMessage.MessageCase.IMPORT_REQUEST: {
        const request = message.payload as OutboundMessage.ImportRequest;
        const id = request.getId();
        const type = InboundMessage.MessageCase.IMPORT_RESPONSE;
        this.pendingOutboundRequests.add(id, type);

        return thenOr(
          this.outboundRequestHandlers.handleImportRequest(request),
          response => {
            this.sendInboundMessage(id, response, type);
          }
        );
      }

      case OutboundMessage.MessageCase.FILE_IMPORT_REQUEST: {
        const request = message.payload as OutboundMessage.FileImportRequest;
        const id = request.getId();
        const type = InboundMessage.MessageCase.FILE_IMPORT_RESPONSE;
        this.pendingOutboundRequests.add(id, type);
        return thenOr(
          this.outboundRequestHandlers.handleFileImportRequest(request),
          response => {
            this.sendInboundMessage(id, response, type);
          }
        );
      }

      case OutboundMessage.MessageCase.CANONICALIZE_REQUEST: {
        const request = message.payload as OutboundMessage.CanonicalizeRequest;
        const id = request.getId();
        const type = InboundMessage.MessageCase.CANONICALIZE_RESPONSE;
        this.pendingOutboundRequests.add(id, type);
        return thenOr(
          this.outboundRequestHandlers.handleCanonicalizeRequest(request),
          response => {
            this.sendInboundMessage(id, response, type);
          }
        );
      }

      case OutboundMessage.MessageCase.FUNCTION_CALL_REQUEST: {
        const request = message.payload as OutboundMessage.FunctionCallRequest;
        const id = request.getId();
        const type = InboundMessage.MessageCase.FUNCTION_CALL_RESPONSE;
        this.pendingOutboundRequests.add(id, type);
        return thenOr(
          this.outboundRequestHandlers.handleFunctionCallRequest(request),
          response => {
            this.sendInboundMessage(id, response, type);
          }
        );
      }

      default:
        throw Error(`Unknown message type ${message.type}`);
    }
  }

  // Sends a `request` of type `requestType` inbound. Returns a promise that
  // will either resolve with the corresponding outbound response of type
  // `responseType`, or error if any Protocol Errors were encountered.
  private handleInboundRequest(
    request: InboundRequest,
    requestType: InboundRequestType,
    responseType: OutboundResponseType,
    callback: (err: unknown, response: OutboundResponse | undefined) => void
  ): void {
    if (this.messages$.isStopped) {
      callback(new Error('Tried writing to closed dispatcher'), undefined);
      return;
    }

    this.messages$
      .pipe(
        filter(message => message.type === responseType),
        map(message => message.payload as OutboundResponse),
        filter(response => response.getId() === request.getId())
      )
      .subscribe({next: response => callback(null, response)});

    this.error$.subscribe({error: error => callback(error, undefined)});

    try {
      this.sendInboundMessage(
        this.pendingInboundRequests.nextId,
        request,
        requestType
      );
    } catch (error) {
      this.throwAndClose(error);
    }
  }

  // Sends a message inbound. Keeps track of all pending inbound requests.
  private sendInboundMessage(
    id: number,
    payload: InboundRequest | InboundResponse,
    type: InboundRequestType | InboundResponseType
  ): void {
    payload.setId(id);

    if (type === InboundMessage.MessageCase.COMPILE_REQUEST) {
      this.pendingInboundRequests.add(
        id,
        OutboundMessage.MessageCase.COMPILE_RESPONSE
      );
    } else if (
      type === InboundMessage.MessageCase.IMPORT_RESPONSE ||
      type === InboundMessage.MessageCase.FILE_IMPORT_RESPONSE ||
      type === InboundMessage.MessageCase.CANONICALIZE_RESPONSE ||
      type === InboundMessage.MessageCase.FUNCTION_CALL_RESPONSE
    ) {
      this.pendingOutboundRequests.resolve(id, type);
    } else {
      throw Error(`Unknown message type ${type}`);
    }

    this.writeInboundMessage({
      payload,
      type,
    });
  }
}

/**
 * An interface for the handler callbacks that are passed to `new Dispatcher()`.
 */
export interface DispatcherHandlers<sync extends 'sync' | 'async'> {
  handleImportRequest: (
    request: OutboundMessage.ImportRequest
  ) => PromiseOr<InboundMessage.ImportResponse, sync>;
  handleFileImportRequest: (
    request: OutboundMessage.FileImportRequest
  ) => PromiseOr<InboundMessage.FileImportResponse, sync>;
  handleCanonicalizeRequest: (
    request: OutboundMessage.CanonicalizeRequest
  ) => PromiseOr<InboundMessage.CanonicalizeResponse, sync>;
  handleFunctionCallRequest: (
    request: OutboundMessage.FunctionCallRequest
  ) => PromiseOr<InboundMessage.FunctionCallResponse, sync>;
}
