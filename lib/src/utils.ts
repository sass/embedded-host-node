// Copyright 2020 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

export type PromiseOr<T> = T | Promise<T>;

export function compilerError(message: string): Error {
  return Error(`Compiler caused error: ${message}.`);
}

export function hostError(message: string): Error {
  return Error(`Compiler reported error: ${message}.`);
}
