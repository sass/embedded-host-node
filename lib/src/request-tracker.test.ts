// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {RequestTracker} from './request-tracker';

describe('request tracker', () => {
  let tracker: RequestTracker;

  beforeEach(() => {
    tracker = new RequestTracker();
  });

  it('returns the next ID when empty', () => {
    expect(tracker.nextId).toBe(0);
  });

  describe('tracking requests', () => {
    it('tracks when empty', () => {
      tracker.add(0, 'compileResponse');
      expect(tracker.nextId).toBe(1);
    });

    it('tracks multiple requests', () => {
      tracker.add(0, 'compileResponse');
      tracker.add(1, 'compileResponse');
      tracker.add(2, 'compileResponse');
      expect(tracker.nextId).toBe(3);
    });

    it('tracks starting from a non-zero ID', () => {
      tracker.add(1, 'compileResponse');
      expect(tracker.nextId).toBe(0);
      tracker.add(0, 'compileResponse');
      expect(tracker.nextId).toBe(2);
    });

    it('errors if the request ID is invalid', () => {
      expect(() => tracker.add(-1, 'compileResponse')).toThrowError(
        'Invalid request ID -1.',
      );
    });

    it('errors if the request ID overlaps that of an existing in-flight request', () => {
      tracker.add(0, 'compileResponse');
      expect(() => tracker.add(0, 'compileResponse')).toThrowError(
        'Request ID 0 is already in use by an in-flight request.',
      );
    });
  });

  describe('resolving requests', () => {
    it('resolves a single request', () => {
      tracker.add(0, 'compileResponse');
      tracker.resolve(0, 'compileResponse');
      expect(tracker.nextId).toBe(0);
    });

    it('resolves multiple requests', () => {
      tracker.add(0, 'compileResponse');
      tracker.add(1, 'compileResponse');
      tracker.add(2, 'compileResponse');
      tracker.resolve(1, 'compileResponse');
      tracker.resolve(2, 'compileResponse');
      tracker.resolve(0, 'compileResponse');
      expect(tracker.nextId).toBe(0);
    });

    it('reuses the ID of a resolved request', () => {
      tracker.add(0, 'compileResponse');
      tracker.add(1, 'compileResponse');
      tracker.resolve(0, 'compileResponse');
      expect(tracker.nextId).toBe(0);
    });

    it('errors if the response ID does not match any existing request IDs', () => {
      expect(() => tracker.resolve(0, 'compileResponse')).toThrowError(
        'Response ID 0 does not match any pending requests.',
      );
    });

    it('errors if the response type does not match what the request is expecting', () => {
      tracker.add(0, 'importResponse');
      expect(() => tracker.resolve(0, 'fileImportResponse')).toThrowError(
        "Response with ID 0 does not match pending request's type. Expected " +
          'importResponse but received fileImportResponse.',
      );
    });
  });
});
