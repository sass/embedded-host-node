// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable} from 'rxjs';
import {create} from '@bufbuild/protobuf';

import {
  InboundResponse,
  InboundResponseType,
  OutboundRequest,
} from './messages';
import * as proto from './vendor/embedded_sass_pb';
import {RequestTracker} from './request-tracker';
import {PromiseOr, catchOr, compilerError, hostError, thenOr} from './utils';

/**
 * Dispatches requests, responses, and events for a single compilation request.
 *
 * The `outboundMessages$` observable should be an observable of messages for
 * this `compilationId`. The `writeInboundMessage` callback should send messages
 * back to the host.
 *
 * Accepts callbacks for processing different types of outbound messages. When
 * an outbound message arrives, this runs the appropriate callback to process
 * it, and then (for requests) sends the result inbound. A callback must be
 * provided for each outbound request type. The callback does not need to set
 * the response ID; the dispatcher handles it.
 *
 * This returns a {@link PromiseOrValue} that will either resolve with the
 * corresponding outbound response or error if any Protocol Errors were
 * encountered. As long as `outboundMessages$` emits events synchronously, the
 * return value will resolve synchronously.
 *
 * This uses an old-style callback argument so that it can work either
 * synchronously or asynchronously. If the underlying `outboundMessages$` stream
 * emits events synchronously, `callback` will be called synchronously.
 */
export function dispatchCompilation<sync extends 'sync' | 'async'>(
  compilationId: number,
  request: proto.InboundMessage_CompileRequest,
  outboundMessages$: Observable<proto.OutboundMessage>,
  writeInboundMessage: (message: [number, proto.InboundMessage]) => void,
  outboundHandlers: DispatcherHandlers<sync>,
  callback: (
    err: unknown,
    response: proto.OutboundMessage_CompileResponse | undefined,
  ) => void,
): void {
  // Tracks the IDs of all outbound requests. An inbound response with matching
  // ID and type will remove the ID.
  const pendingOutboundRequests = new RequestTracker();

  // Make a Promise-like interface for calling the callback.
  function resolve(value: proto.OutboundMessage_CompileResponse): void {
    if (!subscription.closed) callback(undefined, value);
    subscription.unsubscribe();
  }
  function reject(error: unknown): void {
    if (!subscription.closed) callback(error, undefined);
    subscription.unsubscribe();
  }

  function handleRequest<O extends OutboundRequest, I extends InboundResponse>(
    request: O,
    type: InboundResponseType,
    handler: (request: O) => PromiseOr<I, sync>,
  ): void {
    const id = request.id;
    pendingOutboundRequests.add(id, type);

    void catchOr(
      () =>
        thenOr(handler(request), response => {
          response.id = id;
          pendingOutboundRequests.resolve(id, type);

          writeInboundMessage([
            compilationId,
            // We have to cast here because there's no way to convince the type
            // analyzer that `type` is actually `I`'s type.
            create(proto.InboundMessageSchema, {
              message: {case: type, value: response},
            } as proto.InboundMessage),
          ]);
        }),
      reject,
    );
  }

  const subscription = outboundMessages$.subscribe({
    next: message => {
      switch (message.message.case) {
        case 'logEvent':
          outboundHandlers.handleLogEvent(message.message.value);
          break;

        case 'compileResponse':
          subscription.unsubscribe();
          resolve(message.message.value);
          break;

        case 'importRequest':
          handleRequest(
            message.message.value,
            'importResponse',
            outboundHandlers.handleImportRequest,
          );
          break;

        case 'fileImportRequest':
          handleRequest(
            message.message.value,
            'fileImportResponse',
            outboundHandlers.handleFileImportRequest,
          );
          break;

        case 'canonicalizeRequest':
          handleRequest(
            message.message.value,
            'canonicalizeResponse',
            outboundHandlers.handleCanonicalizeRequest,
          );
          break;

        case 'functionCallRequest':
          handleRequest(
            message.message.value,
            'functionCallResponse',
            outboundHandlers.handleFunctionCallRequest,
          );
          break;

        case 'error':
          reject(hostError(message.message.value.message));
          break;

        default:
          reject(compilerError(`Unknown message type ${message.message.case}`));
          break;
      }
    },
    error: reject,
    // Note that if the promise has already resolved, calling
    // `completer.reject()` is a no-op.
    complete: () =>
      reject(new Error('Dispatcher closed before compilation completed')),
  });

  writeInboundMessage([
    compilationId,
    create(proto.InboundMessageSchema, {
      message: {value: request, case: 'compileRequest'},
    }),
  ]);
}

/**
 * An interface for the handler callbacks that are passed to `new Dispatcher()`.
 */
export interface DispatcherHandlers<sync extends 'sync' | 'async'> {
  handleImportRequest: (
    request: proto.OutboundMessage_ImportRequest,
  ) => PromiseOr<proto.InboundMessage_ImportResponse, sync>;
  handleFileImportRequest: (
    request: proto.OutboundMessage_FileImportRequest,
  ) => PromiseOr<proto.InboundMessage_FileImportResponse, sync>;
  handleCanonicalizeRequest: (
    request: proto.OutboundMessage_CanonicalizeRequest,
  ) => PromiseOr<proto.InboundMessage_CanonicalizeResponse, sync>;
  handleFunctionCallRequest: (
    request: proto.OutboundMessage_FunctionCallRequest,
  ) => PromiseOr<proto.InboundMessage_FunctionCallResponse, sync>;
  handleLogEvent: (request: proto.OutboundMessage_LogEvent) => void;
}
