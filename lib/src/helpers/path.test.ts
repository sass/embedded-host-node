// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import * as p from './path';
import {join, resolve} from 'path';

describe('path', () => {
  describe('toUrl', () => {
    it('handles an absolute path', () => {
      expect(p.toUrl('/path')).toBe('file:///path');
    });

    it('handles a relative path', () => {
      expect(p.toUrl('path')).toBe('path');
    });

    it('handles a URL', () => {
      expect(p.toUrl('https://path')).toBe('https://path/');
    });

    it('handles a file URL', () => {
      expect(p.toUrl('file:///path')).toBe('file:///path');
    });
  });

  describe('toPath', () => {
    it('handles an absolute path', () => {
      expect(p.toPath('/path')).toBe('/path');
    });

    it('handles a relative path', () => {
      expect(p.toPath('path')).toBe('path');
    });

    it('handles a URL', () => {
      expect(p.toPath('https://path')).toBe('https://path');
    });

    it('handles a file URL', () => {
      expect(p.toPath('file:///path')).toBe('/path');
    });
  });

  describe('isRootRelative', () => {
    it('handles an absolute path', () => {
      expect(p.isRootRelative('/path')).toBe(true);
    });

    it('handles a relative path', () => {
      expect(p.isRootRelative('path')).toBe(false);
    });

    it('handles a URL', () => {
      expect(p.isRootRelative('https://path')).toBe(false);
    });

    it('handles a file URL', () => {
      expect(p.isRootRelative('file:///path')).toBe(false);
    });
  });

  describe('isAbsolute', () => {
    it('handles an absolute path', () => {
      expect(p.isAbsolute('/path')).toBe(true);
    });

    it('handles a relative path', () => {
      expect(p.isAbsolute('path')).toBe(false);
    });

    it('handles a URL', () => {
      expect(p.isAbsolute('https://path')).toBe(true);
    });

    it('handles a file URL', () => {
      expect(p.isAbsolute('file:///path')).toBe(true);
    });
  });

  describe('relative', () => {
    it('handles absolute path to absolute path', () => {
      expect(p.relative('/from', '/from/to')).toBe('to');
      expect(p.relative('/from', '/to')).toBe(join('..', 'to'));
    });

    it('handles absolute path to relative path', () => {
      expect(p.relative(resolve('from'), 'from/to')).toBe('to');
      expect(p.relative(resolve('from'), 'to')).toBe(join('..', 'to'));
    });

    it('handles relative path to absolute path', () => {
      expect(p.relative('from', resolve('from/to'))).toBe('to');
      expect(p.relative('from', resolve('to'))).toBe(join('..', 'to'));
    });

    it('handles relative path to relative path', () => {
      expect(p.relative('from', 'from/to')).toBe('to');
      expect(p.relative('from', 'to')).toBe(join('..', 'to'));
    });

    it('handles url to url', () => {
      expect(p.relative('https://from', 'https://from/to')).toBe('to');
      expect(p.relative('https://from', 'https://to')).toBe(join('..', 'to'));
    });

    it('handles file URL to file URL', () => {
      expect(p.relative('file:///from', 'file:///from/to')).toBe('to');
      expect(p.relative('file:///from', 'file:///to')).toBe(join('..', 'to'));
    });

    it('handles file URL to path', () => {
      expect(p.relative('file:///from', '/from/to')).toBe('to');
      expect(p.relative('file:///from', '/to')).toBe(join('..', 'to'));
    });

    it('handles path to file URL', () => {
      expect(p.relative('/from', 'file:///from/to')).toBe('to');
      expect(p.relative('/from', 'file:///to')).toBe(join('..', 'to'));
    });
  });
});
