// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {SassException} from './exception';

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
    const span = {
      text: 'text',
      start: {
        offset: 0,
        line: 0,
        column: 0,
      },
      end: {
        offset: 1,
        line: 1,
        column: 1,
      },
      url: 'https://url',
      context: 'context',
    };
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
