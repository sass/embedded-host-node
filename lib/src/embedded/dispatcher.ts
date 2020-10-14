// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable, Subject} from 'rxjs';
import {filter, take, takeUntil} from 'rxjs/operators';

import {InboundMessage, OutboundMessage} from '../vendor/embedded_sass_pb';

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

export class Dispatcher {
  // Tracks the IDs of all outstanding requests. Dispatched responses with
  // matching IDs clear the ID from this set.
  private readonly outstandingRequests = new Set<number>();

  private readonly error$ = new Subject<Error>();

  private readonly logEventsInternal$ = new Subject<OutboundMessage.LogEvent>();

  private readonly compileRequestsInternal$ = new Subject<
    InboundMessage.CompileRequest
  >();

  private readonly importRequestsInternal$ = new Subject<
    OutboundMessage.ImportRequest
  >();

  private readonly fileImportRequestsInternal$ = new Subject<
    OutboundMessage.FileImportRequest
  >();

  private readonly canonicalizeRequestsInternal$ = new Subject<
    OutboundMessage.CanonicalizeRequest
  >();

  private readonly functionCallRequestsInternal$ = new Subject<
    OutboundMessage.FunctionCallRequest
  >();

  private readonly compileResponsesInternal$ = new Subject<
    OutboundMessage.CompileResponse
  >();

  private readonly importResponsesInternal$ = new Subject<
    InboundMessage.ImportResponse
  >();

  private readonly fileImportResponsesInternal$ = new Subject<
    InboundMessage.FileImportResponse
  >();

  private readonly canonicalizeResponsesInternal$ = new Subject<
    InboundMessage.CanonicalizeResponse
  >();

  private readonly functionCallResponsesInternal$ = new Subject<
    InboundMessage.FunctionCallResponse
  >();

  readonly logEvents$ = this.logEventsInternal$.pipe(takeUntil(this.error$));

  readonly compileRequests$ = this.compileRequestsInternal$.pipe(
    takeUntil(this.error$)
  );

  readonly importRequests$ = this.importRequestsInternal$.pipe(
    takeUntil(this.error$)
  );

  readonly fileImportRequests$ = this.fileImportRequestsInternal$.pipe(
    takeUntil(this.error$)
  );

  readonly canonicalizeRequests$ = this.canonicalizeRequestsInternal$.pipe(
    takeUntil(this.error$)
  );

  readonly functionCallRequests$ = this.functionCallRequestsInternal$.pipe(
    takeUntil(this.error$)
  );

  /**
   * Triggers an error, closing all dispatch Observables.
   */
  sendError(error: Error) {
    this.error$.next(error);
  }

  /**
   * Dispatches a log event.
   */
  sendLogEvent(event: OutboundMessage.LogEvent) {
    this.logEventsInternal$.next(event);
  }

  /**
   * Dispatches a compile request. Returns a promise that resolves when a
   * compile response with a matching ID is dispatched.
   */
  sendCompileRequest(request: InboundMessage.CompileRequest) {
    this.dispatchRequest(this.compileRequestsInternal$, request);
    return this.matchingResponse(
      this.compileResponsesInternal$,
      request.getId()
    );
  }

  /**
   * Dispatches an import request. Returns a promise that resolves when an
   * import response with a matching ID is dispatched.
   */
  sendImportRequest(request: OutboundMessage.ImportRequest) {
    this.dispatchRequest(this.importRequestsInternal$, request);
    return this.matchingResponse(
      this.importResponsesInternal$,
      request.getId()
    );
  }

  /**
   * Dispatches a file import request. Returns a promise that resolves when a
   * file import response with a matching ID is dispatched.
   */
  sendFileImportRequest(request: OutboundMessage.FileImportRequest) {
    this.dispatchRequest(this.fileImportRequestsInternal$, request);
    return this.matchingResponse(
      this.fileImportResponsesInternal$,
      request.getId()
    );
  }

  /**
   * Dispatches a canonicalize request. Returns a promise that resolves when a
   * canonicalize response with a matching ID is dispatched.
   */
  sendCanonicalizeRequest(request: OutboundMessage.CanonicalizeRequest) {
    this.dispatchRequest(this.canonicalizeRequestsInternal$, request);
    return this.matchingResponse(
      this.canonicalizeResponsesInternal$,
      request.getId()
    );
  }

  /**
   * Dispatches a function call request. Returns a promise that resolves when a
   * function call response with a matching ID is dispatched.
   */
  sendFunctionCallRequest(request: OutboundMessage.FunctionCallRequest) {
    this.dispatchRequest(this.functionCallRequestsInternal$, request);
    return this.matchingResponse(
      this.functionCallResponsesInternal$,
      request.getId()
    );
  }

  sendCompileResponse(response: OutboundMessage.CompileResponse) {
    this.dispatchResponse(this.compileResponsesInternal$, response);
  }

  sendImportResponse(response: InboundMessage.ImportResponse) {
    this.dispatchResponse(this.importResponsesInternal$, response);
  }

  sendFileImportResponse(response: InboundMessage.FileImportResponse) {
    this.dispatchResponse(this.fileImportResponsesInternal$, response);
  }

  sendCanonicalizeResponse(response: InboundMessage.CanonicalizeResponse) {
    this.dispatchResponse(this.canonicalizeResponsesInternal$, response);
  }

  sendFunctionCallResponse(response: InboundMessage.FunctionCallResponse) {
    this.dispatchResponse(this.functionCallResponsesInternal$, response);
  }

  // Dispatches a request. Adds the request ID to outstandingRequests.
  private dispatchRequest<T extends Request>(requests: Subject<T>, request: T) {
    let id;
    for (let i = 0; i < this.outstandingRequests.size; i++) {
      if (!this.outstandingRequests.has(i)) {
        id = i;
        break;
      }
    }
    id = id ?? this.outstandingRequests.size;
    this.outstandingRequests.add(id);
    request.setId(id);
    requests.next(request);
  }

  // Dispatches a response if outstandingRequests contains an id matching the
  // response's id. Otherwise, dispatches an error.
  private dispatchResponse<T extends Response>(
    responses: Subject<T>,
    response: T
  ) {
    const id = response.getId();
    if (this.outstandingRequests.has(id)) {
      this.outstandingRequests.delete(id);
      responses.next(response);
    } else {
      this.error$.next(
        Error('Response id does not match any outstanding request ids.')
      );
    }
  }

  // Returns a promise that resolves when a dispatched response's ID corresponds
  // to the requestId.
  private matchingResponse<T extends Response>(
    responses: Observable<T>,
    requestId: number
  ) {
    return responses
      .pipe(
        filter(response => response.getId() === requestId),
        take(1),
        takeUntil(this.error$)
      )
      .toPromise();
  }
}
