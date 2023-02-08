// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {OrderedMap} from 'immutable';

import * as proto from './vendor/embedded-protocol/embedded_sass_pb';
import * as utils from './utils';
import {FunctionRegistry} from './function-registry';
import {SassArgumentList} from './value/argument-list';
import {SassColor} from './value/color';
import {SassFunction} from './value/function';
import {SassList, ListSeparator} from './value/list';
import {SassMap} from './value/map';
import {SassNumber} from './value/number';
import {SassString} from './value/string';
import {Value} from './value';
import {sassNull} from './value/null';
import {sassTrue, sassFalse} from './value/boolean';

/**
 * A class that converts [Value] objects into protobufs.
 *
 * A given [Protofier] instance is valid only within the scope of a single
 * custom function call.
 */
export class Protofier {
  /** All the argument lists returned by `deprotofy()`. */
  private readonly argumentLists: SassArgumentList[] = [];

  /**
   * Returns IDs of all argument lists passed to `deprotofy()` whose keywords
   * have been accessed.
   */
  get accessedArgumentLists(): number[] {
    return this.argumentLists
      .filter(list => list.keywordsAccessed)
      .map(list => list.id);
  }

  constructor(
    /**
     * The registry of custom functions that can be invoked by the compiler.
     * This is used to register first-class functions so that the compiler may
     * invoke them.
     */
    private readonly functions: FunctionRegistry<'sync' | 'async'>
  ) {}

  /** Converts `value` to its protocol buffer representation. */
  protofy(value: Value): proto.Value {
    const result = new proto.Value();
    if (value instanceof SassString) {
      const string = new proto.Value_String();
      string.text = value.text;
      string.quoted = value.hasQuotes;
      result.value = {case: 'string', value: string};
    } else if (value instanceof SassNumber) {
      const number = new proto.Value_Number();
      number.value = value.value;
      number.numerators = value.numeratorUnits.toArray();
      number.denominators = value.denominatorUnits.toArray();
      result.value = {case: 'number', value: number};
    } else if (value instanceof SassColor) {
      if (value.hasCalculatedHsl) {
        const color = new proto.Value_HslColor();
        color.hue = value.hue;
        color.saturation = value.saturation;
        color.lightness = value.lightness;
        color.alpha = value.alpha;
        result.value = {case: 'hslColor', value: color};
      } else {
        const color = new proto.Value_RgbColor();
        color.red = value.red;
        color.green = value.green;
        color.blue = value.blue;
        color.alpha = value.alpha;
        result.value = {case: 'rgbColor', value: color};
      }
    } else if (value instanceof SassList) {
      const list = new proto.Value_List();
      list.separator = this.protofySeparator(value.separator);
      list.hasBrackets = value.hasBrackets;
      for (const element of value.asList) {
        list.contents.push(this.protofy(element));
      }
      result.value = {case: 'list', value: list};
    } else if (value instanceof SassArgumentList) {
      const list = new proto.Value_ArgumentList();
      list.id = value.id;
      list.separator = this.protofySeparator(value.separator);
      list.contents = value.asList
        .map(element => this.protofy(element))
        .toArray();
      for (const [key, mapValue] of value.keywordsInternal) {
        list.keywords[key] = this.protofy(mapValue);
      }
      result.value = {case: 'argumentList', value: list};
    } else if (value instanceof SassMap) {
      const map = new proto.Value_Map();
      for (const [key, mapValue] of value.contents) {
        const entry = new proto.Value_Map_Entry();
        entry.key = this.protofy(key);
        entry.value = this.protofy(mapValue);
        map.entries.push(entry);
      }
      result.value = {case: 'map', value: map};
    } else if (value instanceof SassFunction) {
      if (value.id !== undefined) {
        const fn = new proto.Value_CompilerFunction();
        fn.id = value.id;
        result.value = {case: 'compilerFunction', value: fn};
      } else {
        const fn = new proto.Value_HostFunction();
        fn.id = this.functions.register(value.callback!);
        fn.signature = value.signature!;
        result.value = {case: 'hostFunction', value: fn};
      }
    } else if (value === sassTrue) {
      result.value = {case: 'singleton', value: proto.SingletonValue.TRUE};
    } else if (value === sassFalse) {
      result.value = {case: 'singleton', value: proto.SingletonValue.FALSE};
    } else if (value === sassNull) {
      result.value = {case: 'singleton', value: proto.SingletonValue.NULL};
    } else {
      throw utils.compilerError(`Unknown Value ${value}`);
    }
    return result;
  }

  /** Converts `separator` to its protocol buffer representation. */
  private protofySeparator(separator: ListSeparator): proto.ListSeparator {
    switch (separator) {
      case ',':
        return proto.ListSeparator.COMMA;
      case ' ':
        return proto.ListSeparator.SPACE;
      case '/':
        return proto.ListSeparator.SLASH;
      case null:
        return proto.ListSeparator.UNDECIDED;
      default:
        throw utils.compilerError(`Unknown ListSeparator ${separator}`);
    }
  }

  /** Converts `value` to its JS representation. */
  deprotofy(value: proto.Value): Value {
    switch (value.value.case) {
      case 'string': {
        const string = value.value.value;
        return string.text.length === 0
          ? SassString.empty({quotes: string.quoted})
          : new SassString(string.text, {quotes: string.quoted});
      }

      case 'number': {
        const number = value.value.value;
        return new SassNumber(number.value, {
          numeratorUnits: number.numerators,
          denominatorUnits: number.denominators,
        });
      }

      case 'rgbColor': {
        const color = value.value.value;
        return new SassColor({
          red: color.red,
          green: color.green,
          blue: color.blue,
          alpha: color.alpha,
        });
      }

      case 'hslColor': {
        const color = value.value.value;
        return new SassColor({
          hue: color.hue,
          saturation: color.saturation,
          lightness: color.lightness,
          alpha: color.alpha,
        });
      }

      case 'list': {
        const list = value.value.value;
        const separator = this.deprotofySeparator(list.separator);

        if (separator === null && list.contents.length > 1) {
          throw utils.compilerError(
            `Value.List ${list} can't have an undecided separator because it ` +
              `has ${list.contents.length} elements`
          );
        }

        return new SassList(
          list.contents.map(element => this.deprotofy(element)),
          {separator, brackets: list.hasBrackets}
        );
      }

      case 'argumentList': {
        const list = value.value.value;
        const separator = this.deprotofySeparator(list.separator);

        if (separator === null && list.contents.length > 1) {
          throw utils.compilerError(
            `Value.List ${list} can't have an undecided separator because it ` +
              `has ${list.contents.length} elements`
          );
        }

        const result = new SassArgumentList(
          list.contents.map(element => this.deprotofy(element)),
          OrderedMap(
            Object.entries(list.keywords).map(([key, value]) => [
              key,
              this.deprotofy(value),
            ])
          ),
          separator,
          list.id
        );
        this.argumentLists.push(result);
        return result;
      }

      case 'map':
        return new SassMap(
          OrderedMap(
            value.value.value.entries.map(entry => {
              const key = entry.key;
              if (!key) throw utils.mandatoryError('Value.Map.Entry.key');
              const value = entry.value;
              if (!value) throw utils.mandatoryError('Value.Map.Entry.value');

              return [this.deprotofy(key), this.deprotofy(value)];
            })
          )
        );

      case 'compilerFunction':
        return new SassFunction(value.value.value.id);

      case 'hostFunction':
        throw utils.compilerError(
          'The compiler may not send Value.host_function.'
        );

      case 'singleton':
        switch (value.value.value) {
          case proto.SingletonValue.TRUE:
            return sassTrue;
          case proto.SingletonValue.FALSE:
            return sassFalse;
          case proto.SingletonValue.NULL:
            return sassNull;
        }

      // eslint-disable-next-line no-fallthrough
      default:
        throw utils.mandatoryError('Value.value');
    }
  }

  /** Converts `separator` to its JS representation. */
  private deprotofySeparator(separator: proto.ListSeparator): ListSeparator {
    switch (separator) {
      case proto.ListSeparator.COMMA:
        return ',';
      case proto.ListSeparator.SPACE:
        return ' ';
      case proto.ListSeparator.SLASH:
        return '/';
      case proto.ListSeparator.UNDECIDED:
        return null;
      default:
        throw utils.compilerError(`Unknown separator ${separator}`);
    }
  }
}
