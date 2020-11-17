// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable} from 'rxjs';
import {SourceMapConsumer} from 'source-map';

import {
  OutboundMessage,
  SourceSpan,
} from '../../lib/src/vendor/embedded_sass_pb';

/**
 * Subscribes to `observable` and asserts that it errors with the expected
 * `errorMessage`. Calls `done()` to complete the spec.
 */
export function expectObservableToError<T>(
  observable: Observable<T>,
  errorMessage: string,
  done: () => void
): void {
  observable.subscribe(
    () => fail('expected error'),
    error => {
      expect(error.message).toBe(errorMessage);
      done();
    },
    () => fail('expected error')
  );
}

/**
 * Asserts that the `actual` path is equal to the `expected` one, accounting for
 * OS differences.
 */
export function expectEqualPaths(actual: string, expected: string) {
  if (process.platform === 'win32') {
    expect(actual).toBe(expected.toLowerCase());
  } else {
    expect(actual).toBe(expected);
  }
}

/**
 * Asserts that `response` contains a compilation success and returns the
 * success.
 */
export function getCompileSuccess(
  response: OutboundMessage.CompileResponse
): OutboundMessage.CompileResponse.CompileSuccess {
  const success = response.getSuccess();
  expect(success).not.toBe(undefined);
  return success!;
}

/**
 * Asserts that `response` contains a compilation failure and returns the
 * failure.
 */
export function getCompileFailure(
  response: OutboundMessage.CompileResponse
): OutboundMessage.CompileResponse.CompileFailure {
  const failure = response.getFailure();
  expect(failure).not.toBe(undefined);
  return failure!;
}

/**
 * Asserts that `response` contains a sourceMap. Parses and consumes the
 * sourceMap, then returns the resulting SourceMapConsumer.
 */
export async function getSourceMap(
  response: OutboundMessage.CompileResponse
): Promise<SourceMapConsumer> {
  const success = getCompileSuccess(response);
  const rawSourceMap = success.getSourceMap();
  expect(rawSourceMap).not.toBe('');
  const sourceMap = await new SourceMapConsumer(JSON.parse(rawSourceMap));
  sourceMap.computeColumnSpans();
  return sourceMap;
}

/**
 * Returns a SourceSpan populated with the given `params`.
 */
export function sourceSpan(params: {
  text: string;
  start: SourceSpan.SourceLocation;
  end: SourceSpan.SourceLocation;
  url: string;
  context: string;
}): SourceSpan {
  const span = new SourceSpan();
  span.setText(params.text);
  span.setStart(params.start);
  span.setEnd(params.end);
  span.setUrl(params.url);
  span.setContext(params.context);
  return span;
}

/**
 * Returns a SourceLocation with the given `offset`, `line`, and `column`.
 */
export function sourceLocation(
  offset: number,
  line: number,
  column: number
): SourceSpan.SourceLocation {
  const location = new SourceSpan.SourceLocation();
  location.setOffset(offset);
  location.setLine(line);
  location.setColumn(column);
  return location;
}
