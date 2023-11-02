// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Value} from './index';
import {valueError} from '../utils';
import {fuzzyAssertInRange, fuzzyEquals} from './utils';
import {hash, List} from 'immutable';
import Color from 'colorjs.io';
import type ColorType from 'colorjs.io';

/** The HSL color space name. */
type ColorSpaceHsl = 'hsl';

/** The HSL color space channel names. */
type ChannelNameHsl = 'hue' | 'saturation' | 'lightness' | 'alpha';

/** The HWB color space name. */
type ColorSpaceHwb = 'hwb';

/** The HWB color space channel names. */
type ChannelNameHwb = 'hue' | 'whiteness' | 'blackness' | 'alpha';

/** The Lab / Oklab color space names. */
type ColorSpaceLab = 'lab' | 'oklab';

/** The Lab / Oklab color space channel names. */
type ChannelNameLab = 'lightness' | 'a' | 'b' | 'alpha';

/** The LCH / Oklch color space names. */
type ColorSpaceLch = 'lch' | 'oklch';

/** The LCH / Oklch color space channel names. */
type ChannelNameLch = 'lightness' | 'chroma' | 'hue' | 'alpha';

/** Names of color spaces with RGB channels. */
type ColorSpaceRgb =
  | 'a98-rgb'
  | 'display-p3'
  | 'prophoto-rgb'
  | 'rec2020'
  | 'rgb'
  | 'srgb'
  | 'srgb-linear';

/** RGB channel names. */
type ChannelNameRgb = 'red' | 'green' | 'blue' | 'alpha';

/** Names of color spaces with XYZ channels. */
type ColorSpaceXyz = 'xyz' | 'xyz-d50' | 'xyz-d65';

/** XYZ channel names. */
type ChannelNameXyz = 'x' | 'y' | 'z' | 'alpha';

/** All supported color space channel names. */
type ChannelName =
  | ChannelNameHsl
  | ChannelNameHwb
  | ChannelNameLab
  | ChannelNameLch
  | ChannelNameRgb
  | ChannelNameXyz;

/** All supported color space names. */
export type KnownColorSpace =
  | ColorSpaceHsl
  | ColorSpaceHwb
  | ColorSpaceLab
  | ColorSpaceLch
  | ColorSpaceRgb
  | ColorSpaceXyz;

type Channels = {
  [key in ChannelName]?: number | null;
};

function getColorSpace(options: Channels) {
  if (typeof options.red === 'number') {
    return 'rgb';
  }
  if (typeof options.saturation === 'number') {
    return 'hsl';
  }
  if (typeof options.whiteness === 'number') {
    return 'hwb';
  }
  throw valueError('No color space found');
}

function emitColor4ApiDeprecation(name: string) {
  console.warn(`\`${name}\` is deprecated, use \`channel\` instead.`);
}

function NaNtoNull(val: number) {
  return Number.isNaN(val) ? null : val;
}

function NaNtoZero(val: number) {
  return Number.isNaN(val) ? 0 : val;
}

/** A SassScript color. */
export class SassColor extends Value {
  private color: ColorType;
  private isRgb = false;

  constructor(options: Channels & {space?: KnownColorSpace}) {
    super();

    if (options.alpha === null && !options.space) {
      console.warn(
        'Passing `alpha: null` without setting `space` is deprecated.\n\n' +
          'More info: https://sass-lang.com/d/null-alpha'
      );
    }

    let space = options.space ?? getColorSpace(options);
    if (space === 'rgb') {
      space = 'srgb';
      this.isRgb = true;
    }
    let alpha;
    if (options.alpha === null) {
      alpha = NaN;
    } else if (options.alpha === undefined) {
      alpha = 1;
    } else {
      alpha = fuzzyAssertInRange(options.alpha, 0, 1, 'alpha');
    }

    switch (space) {
      case 'srgb':
        if (this.isRgb) {
          // Convert from 0-255 to 0-1
          this.color = new Color({
            spaceId: space,
            coords: [
              (options.red ?? NaN) / 255,
              (options.green ?? NaN) / 255,
              (options.blue ?? NaN) / 255,
            ],
            alpha,
          });
        } else {
          this.color = new Color({
            spaceId: space,
            coords: [
              options.red ?? NaN,
              options.green ?? NaN,
              options.blue ?? NaN,
            ],
            alpha,
          });
        }
        break;
      case 'srgb-linear':
      case 'display-p3':
      case 'a98-rgb':
      case 'prophoto-rgb':
      case 'rec2020':
        this.color = new Color({
          spaceId: space,
          coords: [
            options.red ?? NaN,
            options.green ?? NaN,
            options.blue ?? NaN,
          ],
          alpha,
        });
        break;

      case 'hsl':
        this.color = new Color({
          spaceId: space,
          coords: [
            options.hue ?? NaN,
            options.saturation ?? NaN,
            options.lightness ?? NaN,
          ],
          alpha,
        });
        break;

      case 'hwb':
        this.color = new Color({
          spaceId: space,
          coords: [
            options.hue ?? NaN,
            options.whiteness ?? NaN,
            options.blackness ?? NaN,
          ],
          alpha,
        });
        break;

      case 'lab':
      case 'oklab':
        this.color = new Color({
          spaceId: space,
          coords: [
            options.lightness ?? NaN,
            options.a ?? NaN,
            options.b ?? NaN,
          ],
          alpha,
        });
        break;

      case 'lch':
      case 'oklch':
        this.color = new Color({
          spaceId: space,
          coords: [
            options.lightness ?? NaN,
            options.chroma ?? NaN,
            options.hue ?? NaN,
          ],
          alpha,
        });
        break;

      case 'xyz':
      case 'xyz-d65':
      case 'xyz-d50':
        this.color = new Color({
          spaceId: space,
          coords: [options.x ?? NaN, options.y ?? NaN, options.z ?? NaN],
          alpha,
        });
        break;
    }
  }

  /** `this`'s red channel. */
  get red(): number {
    emitColor4ApiDeprecation('red');
    return NaNtoZero(this.color.srgb.red * 255);
  }

  /** `this`'s blue channel. */
  get blue(): number {
    emitColor4ApiDeprecation('blue');
    return NaNtoZero(this.color.srgb.blue * 255);
  }

  /** `this`'s green channel. */
  get green(): number {
    emitColor4ApiDeprecation('green');
    return NaNtoZero(this.color.srgb.green * 255);
  }

  /** `this`'s hue value. */
  get hue(): number {
    emitColor4ApiDeprecation('hue');
    return NaNtoZero(this.color.hsl.hue);
  }

  /** `this`'s saturation value. */
  get saturation(): number {
    emitColor4ApiDeprecation('saturation');
    return NaNtoZero(this.color.hsl.saturation);
  }

  /** `this`'s lightness value. */
  get lightness(): number {
    emitColor4ApiDeprecation('lightness');
    return NaNtoZero(this.color.hsl.lightness);
  }

  /** `this`'s whiteness value. */
  get whiteness(): number {
    emitColor4ApiDeprecation('whiteness');
    return NaNtoZero(this.color.hwb.whiteness);
  }

  /** `this`'s blackness value. */
  get blackness(): number {
    emitColor4ApiDeprecation('blackness');
    return NaNtoZero(this.color.hwb.blackness);
  }

  /** `this`'s alpha channel. */
  get alpha(): number {
    return NaNtoZero(this.color.alpha);
  }

  /** `this`'s color space. */
  get space(): string {
    const _space = this.color.space.id;
    if (_space === 'srgb' && this.isRgb) {
      return 'rgb';
    }
    return _space;
  }

  /** Whether `this` is in a legacy color space. */
  get isLegacy(): boolean {
    return ['rgb', 'hsl', 'hwb'].includes(this.space);
  }

  /** The values of this color's channels (excluding the alpha channel), or
   * `null` for [missing] channels.
   *
   * [missing]: https://www.w3.org/TR/css-color-4/#missing
   */
  get channelsOrNull(): List<number | null> {
    return List(this.color.coords.map(NaNtoNull));
  }

  /** The values of this color's channels (excluding the alpha channel). */
  get channels(): List<number> {
    return List(this.color.coords.map(NaNtoZero));
  }

  assertColor(): SassColor {
    return this;
  }

  /**
   * Returns a copy of `this` with its channels changed to match `color`.
   */
  // change(color: Partial<RgbColor>): SassColor;
  // change(color: Partial<HslColor>): SassColor;
  // change(color: Partial<HwbColor>): SassColor;
  // change(
  //   color: Partial<RgbColor> | Partial<HslColor> | Partial<HwbColor>
  // ): SassColor {
  //   if ('whiteness' in color || 'blackness' in color) {
  //     return new SassColor({
  //       hue: color.hue ?? this.hue,
  //       whiteness: color.whiteness ?? this.whiteness,
  //       blackness: color.blackness ?? this.blackness,
  //       alpha: color.alpha ?? this.alpha,
  //     });
  //   } else if (
  //     'hue' in color ||
  //     'saturation' in color ||
  //     'lightness' in color
  //   ) {
  //     // Tell TypeScript this isn't a Partial<HwbColor>.
  //     const hsl = color as Partial<HslColor>;
  //     return new SassColor({
  //       hue: hsl.hue ?? this.hue,
  //       saturation: hsl.saturation ?? this.saturation,
  //       lightness: hsl.lightness ?? this.lightness,
  //       alpha: hsl.alpha ?? this.alpha,
  //     });
  //   } else if (
  //     'red' in color ||
  //     'green' in color ||
  //     'blue' in color ||
  //     this.redInternal
  //   ) {
  //     const rgb = color as Partial<RgbColor>;
  //     return new SassColor({
  //       red: rgb.red ?? this.red,
  //       green: rgb.green ?? this.green,
  //       blue: rgb.blue ?? this.blue,
  //       alpha: rgb.alpha ?? this.alpha,
  //     });
  //   } else {
  //     return new SassColor({
  //       hue: this.hue,
  //       saturation: this.saturation,
  //       lightness: this.lightness,
  //       alpha: color.alpha ?? this.alpha,
  //     });
  //   }
  // }

  equals(other: Value): boolean {
    return (
      other instanceof SassColor &&
      fuzzyEquals(this.red, other.red) &&
      fuzzyEquals(this.green, other.green) &&
      fuzzyEquals(this.blue, other.blue) &&
      fuzzyEquals(this.alpha, other.alpha)
    );
  }

  hashCode(): number {
    return hash(this.red ^ this.green ^ this.blue ^ this.alpha);
  }

  toString(): string {
    const isOpaque = fuzzyEquals(this.alpha, 1);
    let string = isOpaque ? 'rgb(' : 'rgba(';
    string += `${this.red}, ${this.green}, ${this.blue}`;
    string += isOpaque ? ')' : `, ${this.alpha})`;
    return string;
  }
}
