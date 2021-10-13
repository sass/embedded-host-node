// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Subject} from 'rxjs';

import {
  InboundMessage,
  OutboundMessage,
} from '../vendor/embedded-protocol/embedded_sass_pb';
import {InboundTypedMessage, OutboundTypedMessage} from './message-transformer';
import {Dispatcher} from './dispatcher';
import {PromiseOr} from '../utils';
import {expectObservableToError} from '../../../spec/helpers/utils';

describe('dispatcher', () => {
  let dispatcher: Dispatcher;
  let outbound$: Subject<OutboundTypedMessage>;

  function createDispatcher(
    outboundMessages$: Subject<OutboundTypedMessage>,
    writeInboundMessage?: (message: InboundTypedMessage) => void,
    outboundRequestHandlers?: {
      handleImportRequest?: (
        request: OutboundMessage.ImportRequest
      ) => PromiseOr<InboundMessage.ImportResponse>;
      handleFileImportRequest?: (
        request: OutboundMessage.FileImportRequest
      ) => PromiseOr<InboundMessage.FileImportResponse>;
      handleCanonicalizeRequest?: (
        request: OutboundMessage.CanonicalizeRequest
      ) => PromiseOr<InboundMessage.CanonicalizeResponse>;
      handleFunctionCallRequest?: (
        request: OutboundMessage.FunctionCallRequest
      ) => PromiseOr<InboundMessage.FunctionCallResponse>;
    }
  ) {
    return new Dispatcher(
      outboundMessages$,
      writeInboundMessage ?? (() => {}),
      {
        handleImportRequest:
          outboundRequestHandlers?.handleImportRequest ??
          (() => new InboundMessage.ImportResponse()),
        handleFileImportRequest:
          outboundRequestHandlers?.handleFileImportRequest ??
          (() => new InboundMessage.FileImportResponse()),
        handleCanonicalizeRequest:
          outboundRequestHandlers?.handleCanonicalizeRequest ??
          (() => new InboundMessage.CanonicalizeResponse()),
        handleFunctionCallRequest:
          outboundRequestHandlers?.handleFunctionCallRequest ??
          (() => new InboundMessage.FunctionCallResponse()),
      }
    );
  }

  beforeEach(() => {
    outbound$ = new Subject();
  });

  afterEach(() => {
    outbound$.complete();
  });

  describe('events', () => {
    beforeEach(() => {
      dispatcher = createDispatcher(outbound$);
    });

    it('exposes log events', done => {
      const message = 'This is a log!';
      const log = new OutboundMessage.LogEvent();
      log.setMessage(message);

      dispatcher.logEvents$.subscribe(log => {
        expect(log.getMessage()).toEqual(message);
        done();
      });

      outbound$.next({
        payload: log,
        type: OutboundMessage.MessageCase.LOG_EVENT,
      });
    });
  });

  describe('inbound requests', () => {
    it('dispatches a compile request and returns the response', done => {
      const expectedCss = 'a {b: c}';

      dispatcher = createDispatcher(outbound$, message => {
        if (message.type !== InboundMessage.MessageCase.COMPILE_REQUEST) return;
        const success = new OutboundMessage.CompileResponse.CompileSuccess();
        success.setCss(expectedCss);
        const response = new OutboundMessage.CompileResponse();
        response.setSuccess(success);
        response.setId(message.payload.getId());
        outbound$.next({
          payload: response,
          type: OutboundMessage.MessageCase.COMPILE_RESPONSE,
        });
      });

      dispatcher
        .sendCompileRequest(new InboundMessage.CompileRequest())
        .then(response => {
          expect(response.getSuccess()?.getCss()).toEqual(expectedCss);
          done();
        });
    });

    it('errors if dispatcher is already closed', async () => {
      dispatcher = createDispatcher(outbound$, () => {});
      outbound$.complete();

      await expect(
        dispatcher.sendCompileRequest(new InboundMessage.CompileRequest())
      ).rejects.toEqual(new Error('Tried writing to closed dispatcher'));
    });
  });

  describe('outbound requests', () => {
    it('triggers the import request callback', done => {
      const id = 1;

      createDispatcher(outbound$, message => {
        const expectedResponse = new InboundMessage.ImportResponse();
        expectedResponse.setId(id);
        expect(message.payload).toEqual(expectedResponse);
        expect(message.type).toEqual(
          InboundMessage.MessageCase.IMPORT_RESPONSE
        );
        done();
      });

      const request = new OutboundMessage.ImportRequest();
      request.setId(id);
      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.IMPORT_REQUEST,
      });
    });

    it('triggers the file import request callback', done => {
      const id = 1;

      createDispatcher(outbound$, message => {
        const expectedResponse = new InboundMessage.FileImportResponse();
        expectedResponse.setId(id);
        expect(message.payload).toEqual(expectedResponse);
        expect(message.type).toEqual(
          InboundMessage.MessageCase.FILE_IMPORT_RESPONSE
        );
        done();
      });

      const request = new OutboundMessage.FileImportRequest();
      request.setId(id);
      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.FILE_IMPORT_REQUEST,
      });
    });

    it('triggers the canonicalize request callback', done => {
      const id = 1;

      createDispatcher(outbound$, message => {
        const expectedResponse = new InboundMessage.CanonicalizeResponse();
        expectedResponse.setId(id);
        expect(message.payload).toEqual(expectedResponse);
        expect(message.type).toEqual(
          InboundMessage.MessageCase.CANONICALIZE_RESPONSE
        );
        done();
      });

      const request = new OutboundMessage.CanonicalizeRequest();
      request.setId(id);
      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.CANONICALIZE_REQUEST,
      });
    });

    it('triggers the function call request callback', done => {
      const id = 1;

      createDispatcher(outbound$, message => {
        const expectedResponse = new InboundMessage.FunctionCallResponse();
        expectedResponse.setId(id);
        expect(message.payload).toEqual(expectedResponse);
        expect(message.type).toEqual(
          InboundMessage.MessageCase.FUNCTION_CALL_RESPONSE
        );
        done();
      });

      const request = new OutboundMessage.FunctionCallRequest();
      request.setId(id);
      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.FUNCTION_CALL_REQUEST,
      });
    });
  });

  describe('multiple request listeners', () => {
    it('supports multiple request callbacks', done => {
      const receivedRequests: number[] = [];

      createDispatcher(
        outbound$,
        message => {
          if (
            message.type === InboundMessage.MessageCase.FILE_IMPORT_RESPONSE
          ) {
            expect(receivedRequests).toEqual([1, 2]);
            done();
          }
        },
        {
          handleImportRequest: importRequest => {
            receivedRequests.push(importRequest.getId());
            return new InboundMessage.ImportResponse();
          },
          handleFileImportRequest: fileImportRequest => {
            receivedRequests.push(fileImportRequest.getId());
            return new InboundMessage.FileImportResponse();
          },
        }
      );

      const request1 = new OutboundMessage.ImportRequest();
      request1.setId(1);
      outbound$.next({
        payload: request1,
        type: OutboundMessage.MessageCase.IMPORT_REQUEST,
      });

      const request2 = new OutboundMessage.FileImportRequest();
      request2.setId(2);
      outbound$.next({
        payload: request2,
        type: OutboundMessage.MessageCase.FILE_IMPORT_REQUEST,
      });
    });
  });

  describe('protocol errors', () => {
    beforeEach(() => {
      dispatcher = createDispatcher(outbound$);
    });

    it('throws if a request ID overlaps with that of an in-flight request', done => {
      expectObservableToError(
        dispatcher.error$,
        'Request ID 0 is already in use by an in-flight request.',
        done
      );

      const request = new OutboundMessage.ImportRequest();
      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.IMPORT_REQUEST,
      });
      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.IMPORT_REQUEST,
      });
    });

    it('throws if a response ID does not match any in-flight request IDs', done => {
      expectObservableToError(
        dispatcher.error$,
        'Response ID 1 does not match any pending requests.',
        done
      );

      const response = new OutboundMessage.CompileResponse();
      response.setId(1);
      outbound$.next({
        payload: response,
        type: OutboundMessage.MessageCase.COMPILE_RESPONSE,
      });
    });

    it('throws error to compile request senders', async () => {
      const error = 'fail';
      dispatcher = createDispatcher(outbound$, () => outbound$.error(error));

      await expect(
        dispatcher.sendCompileRequest(new InboundMessage.CompileRequest())
      ).rejects.toBe(error);
    });

    it('cleans up log event subscriptions upon error', done => {
      dispatcher.logEvents$.subscribe(
        () => fail('expected silent completion'),
        () => fail('expected silent completion'),
        () => done()
      );

      outbound$.error('');
    });
  });
});
