// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Subject} from 'rxjs';

import {InboundMessage, OutboundMessage} from '../vendor/embedded_sass_pb';
import {InboundTypedMessage, OutboundTypedMessage} from './message-transformer';
import {Dispatcher} from './dispatcher';
import {PromiseOr} from '../utils';
import {expectError} from '../../../spec/helpers/utils';

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

    it('exposes log events', async done => {
      const message = 'This is a log!';
      const log = new OutboundMessage.LogEvent();
      log.setMessage(message);

      dispatcher.logEvents$.subscribe(log => {
        expect(log.getMessage()).toEqual(message);
        done();
      });

      outbound$.next({
        payload: log,
        type: OutboundMessage.MessageCase.LOGEVENT,
      });
    });
  });

  describe('inbound requests', () => {
    it('dispatches a compile request and returns the response', async done => {
      const expectedCss = 'a {b: c}';

      dispatcher = createDispatcher(outbound$, message => {
        if (message.type !== InboundMessage.MessageCase.COMPILEREQUEST) return;
        const success = new OutboundMessage.CompileResponse.CompileSuccess();
        success.setCss(expectedCss);
        const response = new OutboundMessage.CompileResponse();
        response.setSuccess(success);
        response.setId(message.payload.getId());
        outbound$.next({
          payload: response,
          type: OutboundMessage.MessageCase.COMPILERESPONSE,
        });
      });

      dispatcher
        .sendCompileRequest(new InboundMessage.CompileRequest())
        .then(response => {
          expect(response.getSuccess()?.getCss()).toEqual(expectedCss);
          done();
        });
    });
  });

  describe('outbound requests', () => {
    it('triggers the import request callback', async done => {
      const id = 1;

      createDispatcher(outbound$, message => {
        const expectedResponse = new InboundMessage.ImportResponse();
        expectedResponse.setId(id);
        expect(message.payload).toEqual(expectedResponse);
        expect(message.type).toEqual(InboundMessage.MessageCase.IMPORTRESPONSE);
        done();
      });

      const request = new OutboundMessage.ImportRequest();
      request.setId(id);
      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.IMPORTREQUEST,
      });
    });

    it('triggers the file import request callback', async done => {
      const id = 1;

      createDispatcher(outbound$, message => {
        const expectedResponse = new InboundMessage.FileImportResponse();
        expectedResponse.setId(id);
        expect(message.payload).toEqual(expectedResponse);
        expect(message.type).toEqual(
          InboundMessage.MessageCase.FILEIMPORTRESPONSE
        );
        done();
      });

      const request = new OutboundMessage.FileImportRequest();
      request.setId(id);
      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.FILEIMPORTREQUEST,
      });
    });

    it('triggers the canonicalize request callback', async done => {
      const id = 1;

      createDispatcher(outbound$, message => {
        const expectedResponse = new InboundMessage.CanonicalizeResponse();
        expectedResponse.setId(id);
        expect(message.payload).toEqual(expectedResponse);
        expect(message.type).toEqual(
          InboundMessage.MessageCase.CANONICALIZERESPONSE
        );
        done();
      });

      const request = new OutboundMessage.CanonicalizeRequest();
      request.setId(id);
      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.CANONICALIZEREQUEST,
      });
    });

    it('triggers the function call request callback', async done => {
      const id = 1;

      createDispatcher(outbound$, message => {
        const expectedResponse = new InboundMessage.FunctionCallResponse();
        expectedResponse.setId(id);
        expect(message.payload).toEqual(expectedResponse);
        expect(message.type).toEqual(
          InboundMessage.MessageCase.FUNCTIONCALLRESPONSE
        );
        done();
      });

      const request = new OutboundMessage.FunctionCallRequest();
      request.setId(id);
      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.FUNCTIONCALLREQUEST,
      });
    });
  });

  describe('multiple request listeners', () => {
    it('supports multiple request callbacks', async done => {
      const receivedRequests: number[] = [];

      createDispatcher(
        outbound$,
        message => {
          if (message.type === InboundMessage.MessageCase.FILEIMPORTRESPONSE) {
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
        type: OutboundMessage.MessageCase.IMPORTREQUEST,
      });

      const request2 = new OutboundMessage.FileImportRequest();
      request2.setId(2);
      outbound$.next({
        payload: request2,
        type: OutboundMessage.MessageCase.FILEIMPORTREQUEST,
      });
    });
  });

  describe('protocol errors', () => {
    beforeEach(() => {
      dispatcher = createDispatcher(outbound$);
    });

    it('throws if a request ID overlaps with that of an in-flight request', async done => {
      expectError(
        dispatcher.error$,
        'Request ID 0 is already in use by an in-flight request.',
        done
      );

      const request = new OutboundMessage.ImportRequest();
      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.IMPORTREQUEST,
      });
      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.IMPORTREQUEST,
      });
    });

    it('throws if a response ID does not match any in-flight request IDs', async done => {
      expectError(
        dispatcher.error$,
        'Response ID 1 does not match any pending requests.',
        done
      );

      const response = new OutboundMessage.CompileResponse();
      response.setId(1);
      outbound$.next({
        payload: response,
        type: OutboundMessage.MessageCase.COMPILERESPONSE,
      });
    });

    it('throws error to compile request senders', async () => {
      const error = 'fail';
      outbound$.error(error);

      await expectAsync(
        dispatcher.sendCompileRequest(new InboundMessage.CompileRequest())
      ).toBeRejectedWith(error);
    });

    it('cleans up log event subscriptions upon error', async done => {
      dispatcher.logEvents$.subscribe(
        () => fail('expected silent completion'),
        () => fail('expected silent completion'),
        () => done()
      );

      outbound$.error('');
    });
  });
});
