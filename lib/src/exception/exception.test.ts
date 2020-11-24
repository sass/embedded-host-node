// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {URL} from 'url';

import {SassException} from './exception';
import {SourceLocation} from './location';
import {SourceSpan} from './span';

describe('SassException', () => {
  it('has the correct name', () => {
    const error = new SassException();

    try {
      throw error;
    } catch (error) {
      const stackTraceLine1 = error.stack.split('\n')[0];
      expect(/SassException/.test(stackTraceLine1)).toBe(true);
    }
  });

  it('has the correct message', () => {
    const message = 'sad';
    const error = new SassException(message);

    try {
      throw error;
    } catch (error) {
      expect(error.message).toBe(message);
    }
  });

  it('has the given span', () => {
    const start = new SourceLocation(0, 0, 0);
    const end = new SourceLocation(1, 1, 1);
    const span = new SourceSpan(
      'text',
      start,
      end,
      new URL('https://url'),
      'context'
    );
    const error = new SassException('', span);

    try {
      throw error;
    } catch (error) {
      expect(error.span).toEqual(span);
    }
  });

  it('has the default stack trace', () => {
    const message = 'default';
    const error = new SassException(message);

    try {
      throw error;
    } catch (error) {
      const stackTraceLine1 = error.stack.split('\n')[0];
      expect(stackTraceLine1).toBe(`SassException: ${message}`);
    }
  });

  it('overrides the default stack trace', () => {
    const stack = 'override';
    const error = new SassException('', undefined, stack);

    try {
      throw error;
    } catch (error) {
      expect(error.stack).toBe(stack);
    }
  });
});
