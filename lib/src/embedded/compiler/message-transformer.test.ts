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
    const message = new InboundMessage();
    message.setCompilerequest(request);

    transformer.write$.next(message);
    encoded$.complete();
    expect(await encoded).toEqual([Buffer.from(message.serializeBinary())]);
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
    const input = new InboundMessage.CompileRequest.StringInput();
    input.setSource('a {b: c}');
    const request = new InboundMessage.CompileRequest();
    request.setString(input);
    const message = new InboundMessage();
    message.setCompilerequest(request);

    toDecode$.next(Buffer.from(message.serializeBinary()));
    transformer.close();
    expect(
      (await decoded).getCompileresponse()?.getSuccess()?.getCss()
    ).toEqual('a {b: c}');
  });

  describe('protocol error', () => {
    let error: Promise<string>;

    beforeEach(async () => {
      error = transformer.error$
        .pipe(toArray())
        .pipe(take(1))
        .toPromise()
        .then(errors => errors[0].message);
    });

    it('fails on invalid buffer', async () => {
      toDecode$.next(Buffer.from([-1]));
      transformer.close();
      expect(await error).toEqual('Compiler caused error: Invalid buffer.');
    });

    it('fails on empty message', async () => {
      toDecode$.next(Buffer.from(new OutboundMessage().serializeBinary()));
      transformer.close();
      expect(await error).toEqual(
        'Compiler caused error: OutboundMessage.message is not set.'
      );
    });

    it('fails on compile response with missing result', async () => {
      const response = new OutboundMessage.CompileResponse();
      const message = new OutboundMessage();
      message.setCompileresponse(response);
      toDecode$.next(Buffer.from(message.serializeBinary()));
      transformer.close();
      expect(await error).toEqual(
        'Compiler caused error: OutboundMessage.CompileResponse.result is not set.'
      );
    });

    it('fails on function call request with missing identifier', async () => {
      const request = new OutboundMessage.FunctionCallRequest();
      const message = new OutboundMessage();
      message.setFunctioncallrequest(request);
      toDecode$.next(Buffer.from(message.serializeBinary()));
      transformer.close();
      expect(await error).toEqual(
        'Compiler caused error: OutboundMessage.FunctionCallRequest.identifier is not set.'
      );
    });
  });
});
