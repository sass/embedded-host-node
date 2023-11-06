// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Value} from './index';
import {valueError} from '../utils';
import {
  fuzzyAssertInRange,
  fuzzyEquals,
  fuzzyHashCode,
  fuzzyRound,
  positiveMod,
} from './utils';
import {List, hash} from 'immutable';
import Color from 'colorjs.io/dist/color.legacy';
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

/** Polar color space names (HSL, HWB, LCH, and Oklch spaces). */
type PolarColorSpace = ColorSpaceHsl | ColorSpaceHwb | ColorSpaceLch;

/**
 * Methods by which two hues are adjusted when interpolating between polar
 * colors.
 */
type HueInterpolationMethod =
  | 'decreasing'
  | 'increasing'
  | 'longer'
  | 'shorter';

type ChannelOptions = {
  [key in ChannelName]?: number | null;
};

/** Legacy determination of color space by channel name. */
function getColorSpace(options: ChannelOptions): KnownColorSpace {
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

function NaNtoNull(val: number): number | null {
  return Number.isNaN(val) ? null : val;
}

function NaNtoZero(val: number): number {
  return Number.isNaN(val) ? 0 : val;
}

function assertClamped(
  val: number,
  min: number,
  max: number,
  name: string
): number {
  return Number.isNaN(val) ? val : fuzzyAssertInRange(val, min, max, name);
}

function coordToRgb(val: number): number {
  return val * 255;
}

function normalizeHue(val: number): number {
  return positiveMod(val, 360);
}

/**
 * Normalize discrepancies between Sass color spaces and ColorJS color space
 * ids.
 */
function encodeSpaceForColorJs(space?: KnownColorSpace): string | undefined {
  switch (space) {
    case 'rgb':
      return 'srgb';
    case 'a98-rgb':
      return 'a98rgb';
    case 'display-p3':
      return 'p3';
    case 'prophoto-rgb':
      return 'prophoto';
  }
  return space;
}

/**
 * Normalize discrepancies between Sass color spaces and ColorJS color space
 * ids.
 */
function decodeSpaceFromColorJs(space: string, isRgb = false): KnownColorSpace {
  switch (space) {
    case 'srgb':
      return isRgb ? 'rgb' : space;
    case 'xyz-d65':
      return 'xyz';
    case 'a98rgb':
      return 'a98-rgb';
    case 'p3':
      return 'display-p3';
    case 'prophoto':
      return 'prophoto-rgb';
  }
  return space as KnownColorSpace;
}

// @TODO For some spaces (e.g. Lab and Oklab), ColorJS only accepts `l` and not
// `lightness` as a channel name. Maybe a bug?
/**
 * Normalize discrepancies between Sass channel names and ColorJS channel ids.
 */
function encodeChannelForColorJs(channel: ChannelName): string {
  if (channel === 'lightness') return 'l';
  return channel;
}

/**
 * Implement our own check of channel name validity for a given space, because
 * ColorJS allows e.g. `b` for either `blue` or `blackness` or `b` channels.
 */
function validateChannelInSpace(
  channel: ChannelName,
  space: KnownColorSpace
): void {
  let valid = false;
  switch (space) {
    case 'rgb':
    case 'srgb':
    case 'srgb-linear':
    case 'display-p3':
    case 'a98-rgb':
    case 'prophoto-rgb':
    case 'rec2020':
      valid = ['red', 'green', 'blue'].includes(channel);
      break;
    case 'hsl':
      valid = ['hue', 'saturation', 'lightness'].includes(channel);
      break;
    case 'hwb':
      valid = ['hue', 'whiteness', 'blackness'].includes(channel);
      break;
    case 'lab':
    case 'oklab':
      valid = ['lightness', 'a', 'b'].includes(channel);
      break;
    case 'lch':
    case 'oklch':
      valid = ['lightness', 'chroma', 'hue'].includes(channel);
      break;
    case 'xyz':
    case 'xyz-d65':
    case 'xyz-d50':
      valid = ['x', 'y', 'z'].includes(channel);
      break;
  }
  if (!valid) {
    throw valueError(
      `Unknown channel name "${channel}" for color space "${space}".`
    );
  }
}

/** Determine whether the given space is a polar color space. */
function isPolarColorSpace(space: KnownColorSpace): space is PolarColorSpace {
  switch (space) {
    case 'hsl':
    case 'hwb':
    case 'lch':
    case 'oklch':
      return true;
    default:
      return false;
  }
}

/**
 * Normalize between ColorJS coordinates (which use `NaN`) and Sass Color
 * coordinates (which use `null`).
 */
function getCoordsFromColor(
  coords: [number, number, number],
  isRgb = false
): [number | null, number | null, number | null] {
  let newCoords: [number | null, number | null, number | null] = coords;
  if (isRgb) {
    newCoords = (newCoords as [number, number, number]).map(coordToRgb) as [
      number,
      number,
      number,
    ];
  }
  return (newCoords as [number, number, number]).map(NaNtoNull) as [
    number | null,
    number | null,
    number | null,
  ];
}

function emitColor4ApiDeprecation(name: string) {
  console.warn(
    `Deprecation [color-4-api]: \`${name}\` is deprecated; use \`channel\` instead.`
  );
}

function emitNullAlphaDeprecation() {
  console.warn(
    'Deprecation [null-alpha]: ' +
      'Passing `alpha: null` without setting `space` is deprecated.' +
      '\n' +
      'More info: https://sass-lang.com/d/null-alpha'
  );
}

// @TODO remove this
Color.defaults.precision = 15;

/** A SassScript color. */
export class SassColor extends Value {
  // ColorJS color object
  private color: ColorType;
  // Boolean indicating whether this color is in RGB format
  private isRgb = false;
  // Boolean indicating whether this color has a missing `alpha` channel
  private alphaMissing = false;
  // Names for the channels of this color
  private channel0Id: ChannelName;
  private channel1Id: ChannelName;
  private channel2Id: ChannelName;
  // Private method for cloning this as a new SassColor
  private clone(): SassColor {
    const coords = getCoordsFromColor(this.color.coords, this.space === 'rgb');
    return new SassColor({
      space: this.space,
      [this.channel0Id]: coords[0],
      [this.channel1Id]: coords[1],
      [this.channel2Id]: coords[2],
      alpha: NaNtoNull(this.color.alpha),
    });
  }

  constructor(options: ChannelOptions & {space?: KnownColorSpace}) {
    super();

    if (options.alpha === null && !options.space) {
      console.warn(
        'Passing `alpha: null` without setting `space` is deprecated.\n\n' +
          'More info: https://sass-lang.com/d/null-alpha'
      );
    }

    const space = options.space ?? getColorSpace(options);
    if (space === 'rgb') {
      this.isRgb = true;
    }
    let alpha;
    if (options.alpha === null) {
      if (!options.space) {
        emitNullAlphaDeprecation();
      }
      alpha = NaN;
      this.alphaMissing = true;
    } else if (options.alpha === undefined) {
      alpha = 1;
    } else {
      alpha = fuzzyAssertInRange(options.alpha, 0, 1, 'alpha');
    }

    switch (space) {
      case 'rgb':
      case 'srgb': {
        this.channel0Id = 'red';
        this.channel1Id = 'green';
        this.channel2Id = 'blue';
        const red = options.red ?? NaN;
        const green = options.green ?? NaN;
        const blue = options.blue ?? NaN;
        if (this.isRgb) {
          this.color = new Color({
            spaceId: encodeSpaceForColorJs(space),
            // convert from 0-255 to 0-1
            coords: [red / 255, green / 255, blue / 255],
            alpha,
          });
        } else {
          this.color = new Color({
            spaceId: encodeSpaceForColorJs(space),
            coords: [red, green, blue],
            alpha,
          });
        }
        break;
      }

      case 'srgb-linear':
      case 'display-p3':
      case 'a98-rgb':
      case 'prophoto-rgb':
      case 'rec2020':
        this.channel0Id = 'red';
        this.channel1Id = 'green';
        this.channel2Id = 'blue';
        this.color = new Color({
          spaceId: encodeSpaceForColorJs(space),
          coords: [
            options.red ?? NaN,
            options.green ?? NaN,
            options.blue ?? NaN,
          ],
          alpha,
        });
        break;

      case 'hsl': {
        this.channel0Id = 'hue';
        this.channel1Id = 'saturation';
        this.channel2Id = 'lightness';
        const hue = normalizeHue(options.hue ?? NaN);
        const saturation = options.saturation ?? NaN;
        let lightness = options.lightness ?? NaN;
        lightness = assertClamped(lightness, 0, 100, 'lightness');
        this.color = new Color({
          spaceId: encodeSpaceForColorJs(space),
          coords: [hue, saturation, lightness],
          alpha,
        });
        break;
      }

      case 'hwb': {
        this.channel0Id = 'hue';
        this.channel1Id = 'whiteness';
        this.channel2Id = 'blackness';
        const hue = normalizeHue(options.hue ?? NaN);
        const whiteness = options.whiteness ?? NaN;
        const blackness = options.blackness ?? NaN;
        this.color = new Color({
          spaceId: encodeSpaceForColorJs(space),
          coords: [hue, whiteness, blackness],
          alpha,
        });
        break;
      }

      case 'lab':
      case 'oklab': {
        this.channel0Id = 'lightness';
        this.channel1Id = 'a';
        this.channel2Id = 'b';
        let lightness = options.lightness ?? NaN;
        const a = options.a ?? NaN;
        const b = options.b ?? NaN;
        const maxLightness = space === 'lab' ? 100 : 1;
        lightness = assertClamped(lightness, 0, maxLightness, 'lightness');
        this.color = new Color({
          spaceId: encodeSpaceForColorJs(space),
          coords: [lightness, a, b],
          alpha,
        });
        break;
      }

      case 'lch':
      case 'oklch': {
        this.channel0Id = 'lightness';
        this.channel1Id = 'chroma';
        this.channel2Id = 'hue';
        let lightness = options.lightness ?? NaN;
        const chroma = options.chroma ?? NaN;
        const hue = normalizeHue(options.hue ?? NaN);
        const maxLightness = space === 'lch' ? 100 : 1;
        lightness = assertClamped(lightness, 0, maxLightness, 'lightness');
        this.color = new Color({
          spaceId: encodeSpaceForColorJs(space),
          coords: [lightness, chroma, hue],
          alpha,
        });
        break;
      }

      case 'xyz':
      case 'xyz-d65':
      case 'xyz-d50':
        this.channel0Id = 'x';
        this.channel1Id = 'y';
        this.channel2Id = 'z';
        this.color = new Color({
          spaceId: encodeSpaceForColorJs(space),
          coords: [options.x ?? NaN, options.y ?? NaN, options.z ?? NaN],
          alpha,
        });
        break;
    }

    // @TODO ColorJS doesn't seem to allow initial `alpha` to be missing?
    if (this.alphaMissing) {
      this.color.alpha = NaN;
    }
  }

  /** This color's alpha channel, between `0` and `1`. */
  get alpha(): number {
    return NaNtoZero(this.color.alpha);
  }

  /** The name of this color's color space. */
  get space(): KnownColorSpace {
    return decodeSpaceFromColorJs(this.color.spaceId, this.isRgb);
  }

  /**
   * A boolean indicating whether this color is in a legacy color space (`rgb`,
   * `hsl`, or `hwb`).
   */
  get isLegacy(): boolean {
    return ['rgb', 'hsl', 'hwb'].includes(this.space);
  }

  /**
   * A list of this color's channel values (excluding alpha), with [missing
   * channels] converted to `null`.
   *
   * [missing channels]: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#missing_color_components
   */
  get channelsOrNull(): List<number | null> {
    let coords = this.color.coords;
    if (this.space === 'rgb') {
      coords = coords.map(coordToRgb) as [number, number, number];
    }
    return List(coords.map(NaNtoNull));
  }

  /**
   * A list of this color's channel values (excluding alpha), with [missing
   * channels] converted to `0`.
   *
   * [missing channels]: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#missing_color_components
   */
  get channels(): List<number> {
    let coords = this.color.coords;
    if (this.space === 'rgb') {
      coords = coords.map(coordToRgb) as [number, number, number];
    }
    return List(coords.map(NaNtoZero));
  }

  /**
   * This color's red channel in the RGB color space, between `0` and `255`.
   *
   * @deprecated Use {@link channel} instead.
   */
  get red(): number {
    emitColor4ApiDeprecation('red');
    const val = NaNtoZero(coordToRgb(this.color.srgb.red));
    return fuzzyRound(val);
  }

  /**
   * This color's green channel in the RGB color space, between `0` and `255`.
   *
   * @deprecated Use {@link channel} instead.
   */
  get green(): number {
    emitColor4ApiDeprecation('green');
    const val = NaNtoZero(coordToRgb(this.color.srgb.green));
    return fuzzyRound(val);
  }

  /**
   * This color's blue channel in the RGB color space, between `0` and `255`.
   *
   * @deprecated Use {@link channel} instead.
   */
  get blue(): number {
    emitColor4ApiDeprecation('blue');
    const val = NaNtoZero(coordToRgb(this.color.srgb.blue));
    return fuzzyRound(val);
  }

  /**
   * This color's hue in the HSL color space, between `0` and `360`.
   *
   * @deprecated Use {@link channel} instead.
   */
  get hue(): number {
    emitColor4ApiDeprecation('hue');
    return NaNtoZero(this.color.hsl.hue);
  }

  /**
   * This color's saturation in the HSL color space, between `0` and `100`.
   *
   * @deprecated Use {@link channel} instead.
   */
  get saturation(): number {
    emitColor4ApiDeprecation('saturation');
    return NaNtoZero(this.color.hsl.saturation);
  }

  /**
   * This color's lightness in the HSL color space, between `0` and `100`.
   *
   * @deprecated Use {@link channel} instead.
   */
  get lightness(): number {
    emitColor4ApiDeprecation('lightness');
    return NaNtoZero(this.color.hsl.lightness);
  }

  /**
   * This color's whiteness in the HWB color space, between `0` and `100`.
   *
   * @deprecated Use {@link channel} instead.
   */
  get whiteness(): number {
    emitColor4ApiDeprecation('whiteness');
    return NaNtoZero(this.color.hwb.whiteness);
  }

  /**
   * This color's blackness in the HWB color space, between `0` and `100`.
   *
   * @deprecated Use {@link channel} instead.
   */
  get blackness(): number {
    emitColor4ApiDeprecation('blackness');
    return NaNtoZero(this.color.hwb.blackness);
  }

  assertColor(): SassColor {
    return this;
  }

  // Internal helper which mutates the current color object.
  _toSpaceInternal(space: KnownColorSpace): void {
    this.isRgb = space === 'rgb';
    this.color = this.color.to(encodeSpaceForColorJs(space) as string);
  }

  /**
   * Returns this color converted to the specified `space`.
   */
  toSpace(space: KnownColorSpace): SassColor {
    if (space === this.space) return this;
    const color = this.clone();
    color._toSpaceInternal(space);
    return color;
  }

  /**
   * Returns a boolean indicating whether this color is in-gamut (as opposed to
   * having one or more of its channels out of bounds) for the specified
   * `space`, or its current color space if `space` is not specified.
   */
  isInGamut(space?: KnownColorSpace): boolean {
    return this.color.inGamut(encodeSpaceForColorJs(space));
  }

  // Internal helper which mutates the current color object.
  _toGamutInternal(space?: KnownColorSpace): void {
    this.color.toGamut({space: encodeSpaceForColorJs(space)});
  }

  /**
   * Returns this color, modified so it is in-gamut for the specified `space`—or
   * the current color space if `space` is not specified—using the recommended
   * [CSS Gamut Mapping Algorithm][css-mapping] to map out-of-gamut colors into
   * the desired gamut with as little perceptual change as possible.
   *
   * [css-mapping]: https://www.w3.org/TR/css-color-4/#css-gamut-mapping-algorithm
   */
  toGamut(space?: KnownColorSpace): SassColor {
    if (this.isInGamut(space)) return this;
    const color = this.clone();
    color._toGamutInternal(space);
    return color;
  }

  /**
   * Returns the value of a single specified `channel` of this color (optionally
   * after converting this color to the specified `space`), with [missing
   * channels] converted to `0`.
   *
   * [missing channels]: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#missing_color_components
   */
  channel(channel: ChannelNameHsl, options: {space: ColorSpaceHsl}): number;
  channel(channel: ChannelNameHwb, options: {space: ColorSpaceHwb}): number;
  channel(channel: ChannelNameLab, options: {space: ColorSpaceLab}): number;
  channel(channel: ChannelNameLch, options: {space: ColorSpaceLch}): number;
  channel(channel: ChannelNameRgb, options: {space: ColorSpaceRgb}): number;
  channel(channel: ChannelNameXyz, options: {space: ColorSpaceXyz}): number;
  channel(channel: ChannelName, options?: {space: KnownColorSpace}): number {
    if (channel === 'alpha') return this.alpha;
    let val: number;
    const space = options?.space ?? this.space;
    validateChannelInSpace(channel, space);
    if (options?.space) {
      val = this.color.get({
        space: encodeSpaceForColorJs(options.space) as string,
        coordId: encodeChannelForColorJs(channel),
      });
    } else {
      val = this.color.get({
        space: this.color.spaceId,
        coordId: encodeChannelForColorJs(channel),
      });
    }
    if (space === 'rgb') {
      val = coordToRgb(val);
    }
    return NaNtoZero(val);
  }

  /**
   * Returns a boolean indicating whether a given channel value is a [missing
   * channel].
   *
   * [missing channel]: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#missing_color_components
   */
  isChannelMissing(channel: ChannelName): boolean {
    if (channel === 'alpha') return Number.isNaN(this.color.alpha);
    validateChannelInSpace(channel, this.space);
    return Number.isNaN(
      this.color.get({
        space: this.color.spaceId,
        coordId: encodeChannelForColorJs(channel),
      })
    );
  }

  /**
   * Returns a boolean indicating whether a given `channel` is [powerless] in
   * this color. This is a special state that's defined for individual color
   * spaces, which indicates that a channel's value won't affect how a color is
   * displayed.
   *
   * [powerless]: https://www.w3.org/TR/css-color-4/#powerless
   */
  isChannelPowerless(
    channel: ChannelNameHsl,
    options?: {space: ColorSpaceHsl}
  ): boolean;
  isChannelPowerless(
    channel: ChannelNameHwb,
    options?: {space: ColorSpaceHwb}
  ): boolean;
  isChannelPowerless(
    channel: ChannelNameLab,
    options?: {space: ColorSpaceLab}
  ): boolean;
  isChannelPowerless(
    channel: ChannelNameLch,
    options?: {space: ColorSpaceLch}
  ): boolean;
  isChannelPowerless(
    channel: ChannelNameRgb,
    options?: {space: ColorSpaceRgb}
  ): boolean;
  isChannelPowerless(
    channel: ChannelNameXyz,
    options?: {space: ColorSpaceXyz}
  ): boolean;
  isChannelPowerless(
    channel: ChannelName,
    options?: {space: KnownColorSpace}
  ): boolean {
    if (channel === 'alpha') return false;
    const color = options?.space ? this.toSpace(options.space) : this;
    validateChannelInSpace(channel, color.space);
    const channels = color.channels.toArray();
    switch (channel) {
      case color.channel0Id:
        if (color.space === 'hsl') {
          return fuzzyEquals(channels[1], 0);
        }
        if (color.space === 'hwb') {
          return fuzzyEquals(channels[1] + channels[2], 100);
        }
        return false;
      case color.channel2Id:
        switch (color.space) {
          case 'lch':
          case 'oklch':
            return fuzzyEquals(channels[1], 0);
        }
        return false;
    }
    return false;
  }

  /**
   * Returns a color partway between this color and `color2` according to
   * `method`, as defined by the CSS Color 4 [color interpolation] procedure.
   *
   * [color interpolation]: https://www.w3.org/TR/css-color-4/#interpolation
   *
   * If `method` is missing and this color is in a polar color space (HSL, HWB,
   * LCH, and Oklch spaces), `method` defaults to "shorter".
   *
   * The `weight` is a number between 0 and 1 that indicates how much of this
   * color should be in the resulting color. If omitted, it defaults to 0.5.
   */
  interpolate(
    color2: SassColor,
    options?: {
      weight?: number;
      method?: HueInterpolationMethod;
    }
  ): SassColor {
    const hueInterpolationMethod =
      options?.method ??
      (isPolarColorSpace(this.space) ? 'shorter' : undefined);
    const weight = options?.weight ?? 0.5;

    if (fuzzyEquals(weight, 0)) return color2;
    if (fuzzyEquals(weight, 1)) return this;

    if (weight < 0 || weight > 1) {
      throw valueError(
        `Expected \`weight\` between \`0\` and \`1\`; received \`${weight}\`.`
      );
    }

    // ColorJS inverses the `weight` argument, where `0` is `this` and `1` is
    // `color2`.
    const color = this.color.mix(color2.color, 1 - weight, {
      space: encodeSpaceForColorJs(this.space),
      hue: hueInterpolationMethod,
    } as any); // @TODO Waiting on new ColorJS release to fix type defs
    const coords = getCoordsFromColor(color.coords, this.space === 'rgb');
    return new SassColor({
      space: this.space,
      [this.channel0Id]: coords[0],
      [this.channel1Id]: coords[1],
      [this.channel2Id]: coords[2],
      alpha: NaNtoNull(this.color.alpha),
    });
  }

  // TODO(jgerigmeyer): Temp fn to pass type checks
  change(
    options: {
      [key in ChannelName]?: number | null;
    } & {
      space?: KnownColorSpace;
    }
  ) {
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
    if (!(other instanceof SassColor)) return false;
    let coords = this.color.coords;
    let otherCoords = other.color.coords;
    if (this.isLegacy) {
      if (!other.isLegacy) return false;
      if (!fuzzyEquals(this.alpha, other.alpha)) return false;
      if (!(this.space === 'rgb' && other.space === 'rgb')) {
        coords = this.color
          .to('srgb')
          .coords.map(coordToRgb)
          .map(fuzzyRound) as [number, number, number];
        otherCoords = other.color
          .to('srgb')
          .coords.map(coordToRgb)
          .map(fuzzyRound) as [number, number, number];
      }
      return (
        fuzzyEquals(coords[0], otherCoords[0]) &&
        fuzzyEquals(coords[1], otherCoords[1]) &&
        fuzzyEquals(coords[2], otherCoords[2])
      );
    }
    return (
      this.space === other.space &&
      fuzzyEquals(coords[0], otherCoords[0]) &&
      fuzzyEquals(coords[1], otherCoords[1]) &&
      fuzzyEquals(coords[2], otherCoords[2]) &&
      fuzzyEquals(this.alpha, other.alpha)
    );
  }

  hashCode(): number {
    let coords = this.color.coords;
    if (this.isLegacy) {
      coords = this.color.to('srgb').coords.map(coordToRgb).map(fuzzyRound) as [
        number,
        number,
        number,
      ];
      return (
        fuzzyHashCode(coords[0]) ^
        fuzzyHashCode(coords[1]) ^
        fuzzyHashCode(coords[2]) ^
        fuzzyHashCode(this.alpha)
      );
    }
    return (
      hash(this.space) ^
      fuzzyHashCode(coords[0]) ^
      fuzzyHashCode(coords[1]) ^
      fuzzyHashCode(coords[2]) ^
      fuzzyHashCode(this.alpha)
    );
  }

  toString(): string {
    return this.color.toString({inGamut: false});
  }
}
