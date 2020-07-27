// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {MessageTransformer} from './message-transformer';
import {Subject, Observable} from 'rxjs';
import {take, toArray} from 'rxjs/operators';
import {InboundMessage, OutboundMessage} from '../../vendor/embedded_sass_pb';

describe('encode', () => {
  let encoded$: Subject<Buffer>;
  let transformer: MessageTransformer;
  let encoded: Promise<Buffer[]>;

  beforeEach(() => {
    encoded$ = new Subject<Buffer>();
    transformer = new MessageTransformer(new Observable<Buffer>(), encoded$);
    encoded = encoded$.pipe(toArray()).pipe(take(1)).toPromise();
  });

  afterEach(() => transformer.close());

  it('encodes an InboundMessage to buffer', async () => {
    const input = new InboundMessage.CompileRequest.StringInput();
    input.setSource('a {b: c}');
    const request = new InboundMessage.CompileRequest();
    request.setString(input);
    request.setId(1);
    const message = new InboundMessage();
    message.setCompilerequest(request);

    transformer.write$.next(message);
    encoded$.complete();
    expect(await encoded).toEqual([
      Buffer.from([
        18,
        14,
        8,
        1,
        18,
        10,
        10,
        8,
        97,
        32,
        123,
        98,
        58,
        32,
        99,
        125,
      ]),
    ]);
  });
});

describe('decode', () => {
  let toDecode$: Subject<Buffer>;
  let transformer: MessageTransformer;
  let decoded: Promise<OutboundMessage>;

  beforeEach(() => {
    toDecode$ = new Subject<Buffer>();
    transformer = new MessageTransformer(toDecode$, new Subject<Buffer>());
    decoded = transformer.read$
      .pipe(toArray())
      .pipe(take(1))
      .toPromise()
      .then(messages => messages[0]);
  });

  afterEach(() => toDecode$.complete());

  it('decodes buffer to OutboundMessage', async () => {
    toDecode$.next(
      Buffer.from([
        18,
        14,
        8,
        1,
        18,
        10,
        10,
        8,
        97,
        32,
        123,
        98,
        58,
        32,
        99,
        125,
      ])
    );
    transformer.close();
    expect(
      (await decoded).getCompileresponse()?.getSuccess()?.getCss()
    ).toEqual('a {b: c}');
  });

  describe('protocol error', () => {
    let protocolError: Promise<string>;

    beforeEach(async () => {
      protocolError = transformer.protocolError$
        .pipe(toArray())
        .pipe(take(1))
        .toPromise()
        .then(protocolErrors => protocolErrors[0].getMessage());
    });

    it('fails on invalid buffer', async () => {
      toDecode$.next(Buffer.from([-1]));
      transformer.close();
      expect(await protocolError).toEqual('Invalid buffer');
    });

    it('fails on empty message', async () => {
      toDecode$.next(Buffer.from(new OutboundMessage().serializeBinary()));
      transformer.close();
      expect(await protocolError).toEqual(
        'OutboundMessage.message is not set.'
      );
    });

    describe('compile response', () => {
      it('fails on missing id', async () => {
        const response = new OutboundMessage.CompileResponse();
        const message = new OutboundMessage();
        message.setCompileresponse(response);

        toDecode$.next(Buffer.from(message.serializeBinary()));
        transformer.close();
        expect(await protocolError).toEqual(
          'OutboundMessage.CompileResponse.id is not set'
        );
      });

      it('fails on missing result', async () => {
        const response = new OutboundMessage.CompileResponse();
        response.setId(1);
        const message = new OutboundMessage();
        message.setCompileresponse(response);

        toDecode$.next(Buffer.from(message.serializeBinary()));
        transformer.close();
        expect(await protocolError).toEqual(
          'OutboundMessage.CompileResponse.result is not set'
        );
      });
    });

    describe('log event', () => {
      it('fails on missing compilation id', async () => {
        const event = new OutboundMessage.LogEvent();
        const message = new OutboundMessage();
        message.setLogevent(event);

        toDecode$.next(Buffer.from(message.serializeBinary()));
        transformer.close();
        expect(await protocolError).toEqual(
          'OutboundMessage.LogEvent.compilationId is not set'
        );
      });
    });

    describe('canonicalize request', () => {
      it('fails on missing compilation id', async () => {
        const request = new OutboundMessage.CanonicalizeRequest();
        const message = new OutboundMessage();
        message.setCanonicalizerequest(request);

        toDecode$.next(Buffer.from(message.serializeBinary()));
        transformer.close();
        expect(await protocolError).toEqual(
          'OutboundMessage.CanonicalizeRequest.compilationId is not set'
        );
      });

      it('fails on missing importer id', async () => {
        const request = new OutboundMessage.CanonicalizeRequest();
        request.setCompilationId(1);
        const message = new OutboundMessage();
        message.setCanonicalizerequest(request);

        toDecode$.next(Buffer.from(message.serializeBinary()));
        transformer.close();
        expect(await protocolError).toEqual(
          'OutboundMessage.CanonicalizeRequest.importerId is not set'
        );
      });
    });

    describe('import request', () => {
      it('fails on missing compilation id', async () => {
        const request = new OutboundMessage.ImportRequest();
        const message = new OutboundMessage();
        message.setImportrequest(request);

        toDecode$.next(Buffer.from(message.serializeBinary()));
        transformer.close();
        expect(await protocolError).toEqual(
          'OutboundMessage.ImportRequest.compilationId is not set'
        );
      });

      it('fails on missing importer id', async () => {
        const request = new OutboundMessage.ImportRequest();
        request.setCompilationId(1);
        const message = new OutboundMessage();
        message.setImportrequest(request);

        toDecode$.next(Buffer.from(message.serializeBinary()));
        transformer.close();
        expect(await protocolError).toEqual(
          'OutboundMessage.ImportRequest.importerId is not set'
        );
      });
    });

    describe('file import request', () => {
      it('fails on missing compilation id', async () => {
        const request = new OutboundMessage.FileImportRequest();
        const message = new OutboundMessage();
        message.setFileimportrequest(request);

        toDecode$.next(Buffer.from(message.serializeBinary()));
        transformer.close();
        expect(await protocolError).toEqual(
          'OutboundMessage.FileImportRequest.compilationId is not set'
        );
      });

      it('fails on missing importer id', async () => {
        const request = new OutboundMessage.FileImportRequest();
        request.setCompilationId(1);
        const message = new OutboundMessage();
        message.setFileimportrequest(request);

        toDecode$.next(Buffer.from(message.serializeBinary()));
        transformer.close();
        expect(await protocolError).toEqual(
          'OutboundMessage.FileImportRequest.importerId is not set'
        );
      });
    });

    describe('function call request', () => {
      it('fails on missing compilation id', async () => {
        const request = new OutboundMessage.FunctionCallRequest();
        const message = new OutboundMessage();
        message.setFunctioncallrequest(request);

        toDecode$.next(Buffer.from(message.serializeBinary()));
        transformer.close();
        expect(await protocolError).toEqual(
          'OutboundMessage.FunctionCallRequest.compilationId is not set'
        );
      });

      it('fails on missing identifier', async () => {
        const request = new OutboundMessage.FunctionCallRequest();
        request.setCompilationId(1);
        const message = new OutboundMessage();
        message.setFunctioncallrequest(request);

        toDecode$.next(Buffer.from(message.serializeBinary()));
        transformer.close();
        expect(await protocolError).toEqual(
          'OutboundMessage.FunctionCallRequest.identifier is not set'
        );
      });
    });
  });
});
