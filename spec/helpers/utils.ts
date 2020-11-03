// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Observable} from 'rxjs';

/**
 * Subscribes to `observable` and ensures that it errors with the expected
 * `errorMessage`. Calls `done()` to complete the spec.
 */
export function expectError<T>(
  observable: Observable<T>,
  errorMessage: string,
  done: () => void
) {
  observable.subscribe(
    () => fail('expected error'),
    error => {
      expect(error.message).toBe(errorMessage);
      done();
    },
    () => fail('expected error')
  );
}
