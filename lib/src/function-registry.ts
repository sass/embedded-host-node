// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {inspect} from 'util';

import * as types from './vendor/sass';
import * as utils from './utils';
import {CustomFunction} from './vendor/sass';
import * as proto from './vendor/embedded_sass_pb';
import {PromiseOr, catchOr, compilerError, thenOr} from './utils';
import {Protofier} from './protofier';
import {Value} from './value';
import {
  CalculationOperation,
  CalculationValue,
  SassCalculation,
} from './value/calculations';
import {List} from 'immutable';

/**
 * The next ID to use for a function. The embedded protocol requires that
 * function IDs be globally unique.
 */
let nextFunctionID = 0;

/**
 * Tracks functions that are defined on the host so that the compiler can
 * execute them.
 */
export class FunctionRegistry<sync extends 'sync' | 'async'> {
  private readonly functionsByName = new Map<string, CustomFunction<sync>>();
  private readonly functionsById = new Map<number, CustomFunction<sync>>();
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
      const id = nextFunctionID;
      nextFunctionID += 1;
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
            result = simplify(result) as any;
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

            return new proto.InboundMessage_FunctionCallResponse({
              result: {case: 'success', value: protofier.protofy(result)},
              accessedArgumentLists: protofier.accessedArgumentLists,
            });
          }
        );
      },
      error =>
        new proto.InboundMessage_FunctionCallResponse({
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

/**
 * Implements the simplification algorithm for custom function return values.
 *  {@link https://github.com/sass/sass/blob/main/spec/types/calculation.md#simplifying-a-calculationvalue}
 */
function simplify(value: unknown): unknown {
  if (value instanceof SassCalculation) {
    const simplifiedArgs = value.arguments.map(
      simplify
    ) as List<CalculationValue>;
    if (value.name == 'calc') {
      return simplifiedArgs.get(0);
    }
    if (value.name == 'clamp') {
      if (simplifiedArgs.size != 3) {
        throw new Error('clamp() requires exactly 3 arguments.');
      }
      return SassCalculation.clamp(
        simplifiedArgs.get(0) as CalculationValue,
        simplifiedArgs.get(1),
        simplifiedArgs.get(2)
      );
    }
    if (value.name == 'min') {
      return SassCalculation.min(simplifiedArgs);
    }
    if (value.name == 'max') {
      return SassCalculation.max(simplifiedArgs);
    }
    // @ts-expect-error: Constructor is private, but we need a new instance here
    return new SassCalculation(value.name, simplifiedArgs);
  }
  if (value instanceof CalculationOperation) {
    return simplify(
      new CalculationOperation(
        value.operator,
        simplify(value.left) as CalculationValue,
        simplify(value.right) as CalculationValue
      )
    );
  }
  return value;
}
