// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {inspect} from 'util';
import {create} from '@bufbuild/protobuf';

import * as types from './vendor/sass';
import * as utils from './utils';
import {CustomFunction} from './vendor/sass';
import * as proto from './vendor/embedded_sass_pb';
import {PromiseOr, catchOr, compilerError, thenOr} from './utils';
import {Protofier} from './protofier';
import {Value} from './value';

/**
 * Tracks functions that are defined on the host so that the compiler can
 * execute them.
 */
export class FunctionRegistry<sync extends 'sync' | 'async'> {
  private readonly functionsByName = new Map<string, CustomFunction<sync>>();
  private readonly functionsById = new Map<number, CustomFunction<sync>>();
  private readonly idsByFunction = new Map<CustomFunction<sync>, number>();

  /** The next ID to use for a function. */
  private id = 0;

  constructor(functionsBySignature?: Record<string, CustomFunction<sync>>) {
    for (const [signature, fn] of Object.entries(functionsBySignature ?? {})) {
      const openParen = signature.indexOf('(');
      if (openParen === -1) {
        throw new Error(`options.functions: "${signature}" is missing "("`);
      }

      this.functionsByName.set(signature.substring(0, openParen), fn);
    }
  }

  /** Registers `fn` as a function that can be called using the returned ID. */
  register(fn: CustomFunction<sync>): number {
    return utils.putIfAbsent(this.idsByFunction, fn, () => {
      const id = this.id;
      this.id += 1;
      this.functionsById.set(id, fn);
      return id;
    });
  }

  /**
   * Returns the function to which `request` refers and returns its response.
   */
  call(
    request: proto.OutboundMessage_FunctionCallRequest
  ): PromiseOr<proto.InboundMessage_FunctionCallResponse, sync> {
    const protofier = new Protofier(this);
    const fn = this.get(request);

    return catchOr(
      () => {
        return thenOr(
          fn(
            request.arguments.map(
              value => protofier.deprotofy(value) as types.Value
            )
          ),
          result => {
            if (!(result instanceof Value)) {
              const name =
                request.identifier.case === 'name'
                  ? `"${request.identifier.value}"`
                  : 'anonymous function';
              throw (
                `options.functions: ${name} returned non-Value: ` +
                inspect(result)
              );
            }

            return create(proto.InboundMessage_FunctionCallResponseSchema, {
              result: {case: 'success', value: protofier.protofy(result)},
              accessedArgumentLists: protofier.accessedArgumentLists,
            });
          }
        );
      },
      error =>
        create(proto.InboundMessage_FunctionCallResponseSchema, {
          result: {case: 'error', value: `${error}`},
        })
    );
  }

  /** Returns the function to which `request` refers. */
  private get(
    request: proto.OutboundMessage_FunctionCallRequest
  ): CustomFunction<sync> {
    if (request.identifier.case === 'name') {
      const fn = this.functionsByName.get(request.identifier.value);
      if (fn) return fn;

      throw compilerError(
        'Invalid OutboundMessage_FunctionCallRequest: there is no function ' +
          `named "${request.identifier.value}"`
      );
    } else if (request.identifier.case === 'functionId') {
      const fn = this.functionsById.get(request.identifier.value);
      if (fn) return fn;

      throw compilerError(
        'Invalid OutboundMessage_FunctionCallRequest: there is no function ' +
          `with ID "${request.identifier.value}"`
      );
    } else {
      throw compilerError(
        'Invalid OutboundMessage_FunctionCallRequest: function identifier is ' +
          'unset'
      );
    }
  }
}
