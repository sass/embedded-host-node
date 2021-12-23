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
      const string = new proto.Value.String();
      string.setText(value.text);
      string.setQuoted(value.hasQuotes);
      result.setString(string);
    } else if (value instanceof SassNumber) {
      result.setNumber(this.protofyNumber(value));
    } else if (value instanceof SassColor) {
      if (value.hasCalculatedHsl) {
        const color = new proto.Value.HslColor();
        color.setHue(value.hue);
        color.setSaturation(value.saturation);
        color.setLightness(value.lightness);
        color.setAlpha(value.alpha);
        result.setHslColor(color);
      } else {
        const color = new proto.Value.RgbColor();
        color.setRed(value.red);
        color.setGreen(value.green);
        color.setBlue(value.blue);
        color.setAlpha(value.alpha);
        result.setRgbColor(color);
      }
    } else if (value instanceof SassList) {
      const list = new proto.Value.List();
      list.setSeparator(this.protofySeparator(value.separator));
      list.setHasBrackets(value.hasBrackets);
      for (const element of value.asList) {
        list.addContents(this.protofy(element));
      }
      result.setList(list);
    } else if (value instanceof SassArgumentList) {
      const list = new proto.Value.ArgumentList();
      list.setId(value.id);
      list.setSeparator(this.protofySeparator(value.separator));
      for (const element of value.asList) {
        list.addContents(this.protofy(element));
      }
      const keywords = list.getKeywordsMap();
      for (const [key, mapValue] of value.keywordsInternal) {
        keywords.set(key, this.protofy(mapValue));
      }
      result.setArgumentList(list);
    } else if (value instanceof SassMap) {
      const map = new proto.Value.Map();
      for (const [key, mapValue] of value.contents) {
        const entry = new proto.Value.Map.Entry();
        entry.setKey(this.protofy(key));
        entry.setValue(this.protofy(mapValue));
        map.addEntries(entry);
      }
      result.setMap(map);
    } else if (value instanceof SassFunction) {
      if (value.id !== undefined) {
        const fn = new proto.Value.CompilerFunction();
        fn.setId(value.id);
        result.setCompilerFunction(fn);
      } else {
        const fn = new proto.Value.HostFunction();
        fn.setId(this.functions.register(value.callback!));
        fn.setSignature(value.signature!);
        result.setHostFunction(fn);
      }
    } else if (value === sassTrue) {
      result.setSingleton(proto.SingletonValue.TRUE);
    } else if (value === sassFalse) {
      result.setSingleton(proto.SingletonValue.FALSE);
    } else if (value === sassNull) {
      result.setSingleton(proto.SingletonValue.NULL);
    } else {
      throw utils.compilerError(`Unknown Value ${value}`);
    }
    return result;
  }

  /** Converts `number` to its protocol buffer representation. */
  private protofyNumber(number: SassNumber): proto.Value.Number {
    const value = new proto.Value.Number();
    value.setValue(number.value);
    for (const unit of number.numeratorUnits) {
      value.addNumerators(unit);
    }
    for (const unit of number.denominatorUnits) {
      value.addDenominators(unit);
    }
    return value;
  }

  /** Converts `separator` to its protocol buffer representation. */
  private protofySeparator(
    separator: ListSeparator
  ): proto.ListSeparatorMap[keyof proto.ListSeparatorMap] {
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
    switch (value.getValueCase()) {
      case proto.Value.ValueCase.STRING: {
        const string = value.getString()!;
        return string.getText().length === 0
          ? SassString.empty({quotes: string.getQuoted()})
          : new SassString(string.getText(), {quotes: string.getQuoted()});
      }

      case proto.Value.ValueCase.NUMBER:
        return this.deprotofyNumber(value.getNumber()!);

      case proto.Value.ValueCase.RGB_COLOR: {
        const color = value.getRgbColor()!;
        return new SassColor({
          red: color.getRed(),
          green: color.getGreen(),
          blue: color.getBlue(),
          alpha: color.getAlpha(),
        });
      }

      case proto.Value.ValueCase.HSL_COLOR: {
        const color = value.getHslColor()!;
        return new SassColor({
          hue: color.getHue(),
          saturation: color.getSaturation(),
          lightness: color.getLightness(),
          alpha: color.getAlpha(),
        });
      }

      case proto.Value.ValueCase.LIST: {
        const list = value.getList()!;
        const separator = this.deprotofySeparator(list.getSeparator());

        const contents = list.getContentsList();
        if (separator === null && contents.length > 1) {
          throw utils.compilerError(
            `Value.List ${list} can't have an undecided separator because it ` +
              `has ${contents.length} elements`
          );
        }

        return new SassList(
          contents.map(element => this.deprotofy(element)),
          {separator, brackets: list.getHasBrackets()}
        );
      }

      case proto.Value.ValueCase.ARGUMENT_LIST: {
        const list = value.getArgumentList()!;
        const separator = this.deprotofySeparator(list.getSeparator());

        const contents = list.getContentsList();
        if (separator === null && contents.length > 1) {
          throw utils.compilerError(
            `Value.List ${list} can't have an undecided separator because it ` +
              `has ${contents.length} elements`
          );
        }

        const result = new SassArgumentList(
          contents.map(element => this.deprotofy(element)),
          OrderedMap(
            [...list.getKeywordsMap().entries()].map(([key, value]) => [
              key,
              this.deprotofy(value),
            ])
          ),
          separator,
          list.getId()
        );
        this.argumentLists.push(result);
        return result;
      }

      case proto.Value.ValueCase.MAP:
        return new SassMap(
          OrderedMap(
            value
              .getMap()!
              .getEntriesList()
              .map(entry => {
                const key = entry.getKey();
                if (!key) throw utils.mandatoryError('Value.Map.Entry.key');
                const value = entry.getValue();
                if (!value) throw utils.mandatoryError('Value.Map.Entry.value');

                return [this.deprotofy(key), this.deprotofy(value)];
              })
          )
        );

      case proto.Value.ValueCase.COMPILER_FUNCTION:
        return new SassFunction(value.getCompilerFunction()!.getId());

      case proto.Value.ValueCase.HOST_FUNCTION:
        throw utils.compilerError(
          'The compiler may not send Value.host_function.'
        );

      case proto.Value.ValueCase.SINGLETON:
        switch (value.getSingleton()) {
          case proto.SingletonValue.TRUE:
            return sassTrue;
          case proto.SingletonValue.FALSE:
            return sassFalse;
          case proto.SingletonValue.NULL:
            return sassNull;
          default:
            throw utils.compilerError(
              `Unknown Value.singleton ${value.getSingleton()}`
            );
        }

      default:
        throw utils.mandatoryError('Value.value');
    }
  }

  /** Converts `number` to its JS representation. */
  private deprotofyNumber(number: proto.Value.Number): SassNumber {
    return new SassNumber(number.getValue(), {
      numeratorUnits: number.getNumeratorsList(),
      denominatorUnits: number.getDenominatorsList(),
    });
  }

  /** Converts `separator` to its JS representation. */
  private deprotofySeparator(
    separator: proto.ListSeparatorMap[keyof proto.ListSeparatorMap]
  ): ListSeparator {
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
