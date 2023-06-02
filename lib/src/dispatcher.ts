// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable, Subject} from 'rxjs';
import {filter, map, mergeMap} from 'rxjs/operators';

import {OutboundResponse} from './messages';
import * as proto from './vendor/embedded_sass_pb';
import {RequestTracker} from './request-tracker';
import {PromiseOr, compilerError, thenOr, hostError} from './utils';

/**
 * Dispatches requests, responses, and events for a single compilation.
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
  // Tracks the IDs of all outbound requests. An inbound response with matching
  // ID and type will remove the ID.
  private readonly pendingOutboundRequests = new RequestTracker();

  // All outbound messages for this compilation. If we detect any errors while
  // dispatching messages, this completes.
  private readonly messages$ = new Subject<proto.OutboundMessage>();

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
    filter(message => message.message.case === 'logEvent'),
    map(message => message.message.value as proto.OutboundMessage_LogEvent)
  );

  constructor(
    private readonly compilationId: number,
    private readonly outboundMessages$: Observable<
      [number, proto.OutboundMessage]
    >,
    private readonly writeInboundMessage: (
      message: [number, proto.InboundMessage]
    ) => void,
    private readonly outboundRequestHandlers: DispatcherHandlers<sync>
  ) {
    if (compilationId < 1) {
      throw Error(`Invalid compilation ID ${compilationId}.`);
    }

    this.outboundMessages$
      .pipe(
        filter(([compilationId]) => compilationId === this.compilationId),
        map(([, message]) => message),
        mergeMap(message => {
          const result = this.handleOutboundMessage(message);
          return result instanceof Promise
            ? result.then(() => message)
            : [message];
        })
      )
      .subscribe({
        next: message => this.messages$.next(message),
        error: error => this.throwAndClose(error),
        complete: () => {
          this.messages$.complete();
          this.errorInternal$.complete();
        },
      });
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
    request: proto.InboundMessage_CompileRequest,
    callback: (
      err: unknown,
      response: proto.OutboundMessage_CompileResponse | undefined
    ) => void
  ): void {
    if (this.messages$.isStopped) {
      callback(new Error('Tried writing to closed dispatcher'), undefined);
      return;
    }

    this.messages$
      .pipe(
        filter(message => message.message.case === 'compileResponse'),
        map(message => message.message.value as OutboundResponse)
      )
      .subscribe({next: response => callback(null, response)});

    this.error$.subscribe({error: error => callback(error, undefined)});

    try {
      this.writeInboundMessage([
        this.compilationId,
        new proto.InboundMessage({
          message: {value: request, case: 'compileRequest'},
        }),
      ]);
    } catch (error) {
      this.throwAndClose(error);
    }
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
    message: proto.OutboundMessage
  ): PromiseOr<void, sync> {
    switch (message.message.case) {
      case 'logEvent':
        // Handled separately by `logEvents$`.
        return undefined;

      case 'compileResponse':
        // Handled separately by `sendCompileRequest`.
        return undefined;

      case 'importRequest': {
        const request = message.message.value;
        const id = request.id;
        const type = 'importResponse';
        this.pendingOutboundRequests.add(id, type);

        return thenOr(
          this.outboundRequestHandlers.handleImportRequest(request),
          response => {
            this.sendInboundMessage(id, {case: type, value: response});
          }
        );
      }

      case 'fileImportRequest': {
        const request = message.message.value;
        const id = request.id;
        const type = 'fileImportResponse';
        this.pendingOutboundRequests.add(id, type);
        return thenOr(
          this.outboundRequestHandlers.handleFileImportRequest(request),
          response => {
            this.sendInboundMessage(id, {case: type, value: response});
          }
        );
      }

      case 'canonicalizeRequest': {
        const request = message.message.value;
        const id = request.id;
        const type = 'canonicalizeResponse';
        this.pendingOutboundRequests.add(id, type);
        return thenOr(
          this.outboundRequestHandlers.handleCanonicalizeRequest(request),
          response => {
            this.sendInboundMessage(id, {case: type, value: response});
          }
        );
      }

      case 'functionCallRequest': {
        const request = message.message.value;
        const id = request.id;
        const type = 'functionCallResponse';
        this.pendingOutboundRequests.add(id, type);
        return thenOr(
          this.outboundRequestHandlers.handleFunctionCallRequest(request),
          response => {
            this.sendInboundMessage(id, {case: type, value: response});
          }
        );
      }

      case 'error':
        throw hostError(message.message.value.message);

      default:
        throw compilerError(`Unknown message type ${message.message.case}`);
    }
  }

  // Sends a message inbound. Keeps track of all pending inbound requests.
  private sendInboundMessage(
    requestId: number,
    message: Exclude<
      proto.InboundMessage['message'],
      {case: undefined | 'compileRequest'}
    >
  ): void {
    message.value.id = requestId;

    if (
      message.case === 'importResponse' ||
      message.case === 'fileImportResponse' ||
      message.case === 'canonicalizeResponse' ||
      message.case === 'functionCallResponse'
    ) {
      this.pendingOutboundRequests.resolve(requestId, message.case);
    } else {
      throw Error(`Unknown message type ${message.case}`);
    }

    this.writeInboundMessage([
      this.compilationId,
      new proto.InboundMessage({message}),
    ]);
  }
}

/**
 * An interface for the handler callbacks that are passed to `new Dispatcher()`.
 */
export interface DispatcherHandlers<sync extends 'sync' | 'async'> {
  handleImportRequest: (
    request: proto.OutboundMessage_ImportRequest
  ) => PromiseOr<proto.InboundMessage_ImportResponse, sync>;
  handleFileImportRequest: (
    request: proto.OutboundMessage_FileImportRequest
  ) => PromiseOr<proto.InboundMessage_FileImportResponse, sync>;
  handleCanonicalizeRequest: (
    request: proto.OutboundMessage_CanonicalizeRequest
  ) => PromiseOr<proto.InboundMessage_CanonicalizeResponse, sync>;
  handleFunctionCallRequest: (
    request: proto.OutboundMessage_FunctionCallRequest
  ) => PromiseOr<proto.InboundMessage_FunctionCallResponse, sync>;
}
