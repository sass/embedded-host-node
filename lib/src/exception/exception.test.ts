// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {SassException} from './exception';

describe('SassException', () => {
  it('has the correct message', () => {
    try {
      throw new SassException('sad', '');
    } catch (error) {
      expect(error.message).toBe('sad');
    }
  });

  it('has the correct span', () => {
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
    try {
      throw new SassException('', '', span);
    } catch (error) {
      expect(error.span).toEqual(span);
    }
  });

  it('has the correct trace', () => {
    try {
      throw new SassException('', '', undefined, 'sherlock');
    } catch (error) {
      expect(error.trace).toBe('sherlock');
    }
  });

  it('has a useful toString() method', () => {
    try {
      throw new SassException('', 'Error: aesthetically sad');
    } catch (error) {
      expect(error.toString()).toBe('Error: aesthetically sad');
    }
  });

  it('contains the Sass stack inside the JS stack', () => {
    try {
      throw new SassException('sad', 'Error: aesthetically\n  sad');
    } catch (error) {
      expect(/^Error: aesthetically\n\s\ssad\n\s+at/.test(error.stack)).toBe(
        true
      );
    }
  });
});
