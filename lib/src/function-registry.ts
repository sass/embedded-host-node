// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {inspect} from 'util';

import * as types from './vendor/sass';
import * as utils from './utils';
import {CustomFunction} from './vendor/sass';
import {
  InboundMessage,
  OutboundMessage,
} from './vendor/embedded-protocol/embedded_sass_pb';
import {PromiseOr, catchOr, thenOr} from './utils';
import {Protofier} from './protofier';
import {Value} from './value';

export class FunctionRegistry<sync extends 'sync' | 'async'> {
  private readonly functionsByName = new Map<string, CustomFunction<sync>>();
  private readonly functionsById = new Array<CustomFunction<sync>>();
  private readonly idsByFunction = new Map<CustomFunction<sync>, number>();

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
      const id = this.functionsById.length;
      this.functionsById.push(fn);
      return id;
    });
  }

  /**
   * Returns the function to which `request` refers and returns its response.
   */
  call(
    request: OutboundMessage.FunctionCallRequest
  ): PromiseOr<InboundMessage.FunctionCallResponse, sync> {
    const protofier = new Protofier();
    const fn = this.get(request);

    return catchOr(
      () => {
        return thenOr(
          fn(
            request
              .getArgumentsList()
              .map(value => protofier.deprotofy(value) as types.Value)
          ),
          result => {
            if (!(result instanceof Value)) {
              const name =
                request.getName().length === 0
                  ? 'anonymous function'
                  : `"${request.getName()}"`;
              throw (
                `options.functions: ${name} returned non-Value: ` +
                inspect(result)
              );
            }

            const response = new InboundMessage.FunctionCallResponse();
            response.setSuccess(protofier.protofy(result));
            return response;
          }
        );
      },
      error => {
        const response = new InboundMessage.FunctionCallResponse();
        response.setError(`${error}`);
        return response;
      }
    );
  }

  /** Returns the function to which `request` refers. */
  private get(
    request: OutboundMessage.FunctionCallRequest
  ): CustomFunction<sync> {
    if (
      request.getIdentifierCase() ===
      OutboundMessage.FunctionCallRequest.IdentifierCase.NAME
    ) {
      const fn = this.functionsByName.get(request.getName());
      if (fn) return fn;

      throw new Error(
        'Invalid OutboundMessage.FunctionCallRequest: there is no function ' +
          `named "${request.getName()}"`
      );
    } else {
      const fn = this.functionsById[request.getFunctionId()];
      if (fn) return fn;

      throw new Error(
        'Invalid OutboundMessage.FunctionCallRequest: there is no function ' +
          `with ID "${request.getFunctionId()}"`
      );
    }
  }
}
