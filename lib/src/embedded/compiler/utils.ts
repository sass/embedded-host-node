// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {ProtocolError} from '../../vendor/embedded_sass_pb';

/** Constructs a ProtocolError. */
export function protocolError(
  type: ProtocolError.ErrorTypeMap[keyof ProtocolError.ErrorTypeMap],
  description: string,
  id = -1
) {
  const error = new ProtocolError();
  error.setType(type);
  error.setMessage(description);
  error.setId(id);
  return error;
}
