// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Subject} from 'rxjs';
import {filter, map} from 'rxjs/operators';
import {InboundMessage, OutboundMessage} from '../vendor/embedded_sass_pb';
import {Dispatcher} from './dispatcher';
import {InboundTypedMessage, OutboundTypedMessage} from './message-transformer';

describe('dispatcher', () => {
  let outbound$: Subject<OutboundTypedMessage>;
  let inbound$: Subject<InboundTypedMessage>;
  let dispatcher: Dispatcher;

  beforeEach(() => {
    outbound$ = new Subject();
    inbound$ = new Subject();
    dispatcher = new Dispatcher(outbound$, inbound$);
  });

  afterEach(() => {
    outbound$.complete();
    inbound$.complete();
  });

  describe('events', () => {
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

      // Answer compile request.
      inbound$
        .pipe(
          filter(
            message =>
              message.type === InboundMessage.MessageCase.COMPILEREQUEST
          ),
          map(message => message.payload)
        )
        .subscribe(request => {
          const success = new OutboundMessage.CompileResponse.CompileSuccess();
          success.setCss(expectedCss);
          const response = new OutboundMessage.CompileResponse();
          response.setSuccess(success);
          response.setId(request.getId());
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
      const request = new OutboundMessage.ImportRequest();
      request.setId(id);

      dispatcher.onImportRequest(() => new InboundMessage.ImportResponse());

      inbound$.subscribe(message => {
        const expectedResponse = new InboundMessage.ImportResponse();
        expectedResponse.setId(id);
        expect(message.payload).toEqual(expectedResponse);
        expect(message.type).toEqual(InboundMessage.MessageCase.IMPORTRESPONSE);
        done();
      });

      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.IMPORTREQUEST,
      });
    });

    it('triggers the file import request callback', async done => {
      const id = 1;
      const request = new OutboundMessage.FileImportRequest();
      request.setId(id);

      dispatcher.onFileImportRequest(
        () => new InboundMessage.FileImportResponse()
      );

      inbound$.subscribe(message => {
        const expectedResponse = new InboundMessage.FileImportResponse();
        expectedResponse.setId(id);
        expect(message.payload).toEqual(expectedResponse);
        expect(message.type).toEqual(
          InboundMessage.MessageCase.FILEIMPORTRESPONSE
        );
        done();
      });

      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.FILEIMPORTREQUEST,
      });
    });

    it('triggers the canonicalize request callback', async done => {
      const id = 1;
      const request = new OutboundMessage.CanonicalizeRequest();
      request.setId(id);

      dispatcher.onCanonicalizeRequest(
        () => new InboundMessage.CanonicalizeResponse()
      );

      inbound$.subscribe(message => {
        const expectedResponse = new InboundMessage.CanonicalizeResponse();
        expectedResponse.setId(id);
        expect(message.payload).toEqual(expectedResponse);
        expect(message.type).toEqual(
          InboundMessage.MessageCase.CANONICALIZERESPONSE
        );
        done();
      });

      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.CANONICALIZEREQUEST,
      });
    });

    it('triggers the function call request callback', async done => {
      const id = 1;
      const request = new OutboundMessage.FunctionCallRequest();
      request.setId(id);

      dispatcher.onFunctionCallRequest(
        () => new InboundMessage.FunctionCallResponse()
      );

      inbound$.subscribe(message => {
        const expectedResponse = new InboundMessage.FunctionCallResponse();
        expectedResponse.setId(id);
        expect(message.payload).toEqual(expectedResponse);
        expect(message.type).toEqual(
          InboundMessage.MessageCase.FUNCTIONCALLRESPONSE
        );
        done();
      });

      outbound$.next({
        payload: request,
        type: OutboundMessage.MessageCase.FUNCTIONCALLREQUEST,
      });
    });
  });

  describe('protocol errors', () => {
    it('throws if a request ID overlaps with that of an in-flight request', async done => {
      dispatcher
        .sendCompileRequest(new InboundMessage.CompileRequest())
        .catch(error => {
          expect(error.message).toEqual(
            'Request ID 0 is already in use by an in-flight request.'
          );
          done();
        });

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
      dispatcher
        .sendCompileRequest(new InboundMessage.CompileRequest())
        .catch(error => {
          expect(error.message).toEqual(
            'Response ID 1 does not match any pending requests.'
          );
          done();
        });

      const response = new OutboundMessage.CompileResponse();
      response.setId(1);
      outbound$.next({
        payload: response,
        type: OutboundMessage.MessageCase.COMPILERESPONSE,
      });
    });
  });
});
