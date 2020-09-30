// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Compiler} from './compiler';
import {InboundMessage} from '../vendor/embedded_sass_pb';

describe('compiler', () => {
  let compiler: Compiler;
  beforeEach(() => (compiler = new Compiler()));
  afterEach(() => compiler.close());

  it('compiles valid css input', async done => {
    const input = new InboundMessage.CompileRequest.StringInput();
    input.setSource('a {b: c}');
    const request = new InboundMessage.CompileRequest();
    request.setString(input);
    const message = new InboundMessage();
    message.setCompilerequest(request);

    compiler.write$.next(message);
    compiler.read$.subscribe(message => {
      expect(message.getCompileresponse()?.getSuccess()?.getCss()).toEqual(
        'a {\n  b: c;\n}'
      );
      done();
    });
  });

  it('reports a ProtocolError', async done => {
    compiler.write$.next(new InboundMessage());
    compiler.error$.subscribe(error => {
      expect(error.message).toEqual(
        'Compiler reported error: InboundMessage.message is not set.'
      );
      done();
    });
  });

  it('shuts itself down when a ProtocolError occurs', async done => {
    compiler.write$.next(new InboundMessage());
    compiler.read$.subscribe(
      // Response callback
      () => {},
      // Error callback
      () => {},
      // Completion callback
      () => done()
    );
  });
});
