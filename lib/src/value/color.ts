// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Value} from './value';
import {fuzzyAssertInRange, fuzzyEquals, fuzzyRound} from './utils';
import {hash} from 'immutable';

interface RgbColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

interface HslColor {
  hue: number;
  saturation: number;
  lightness: number;
  alpha: number;
}

/** A SassScript color. */
export class SassColor extends Value {
  private redInternal?: number;
  private greenInternal?: number;
  private blueInternal?: number;
  private hueInternal?: number;
  private saturationInternal?: number;
  private lightnessInternal?: number;
  private readonly alphaInternal: number;

  private constructor(color: RgbColor | HslColor) {
    super();

    if ('red' in color) {
      this.redInternal = color.red;
      this.greenInternal = color.green;
      this.blueInternal = color.blue;
    } else {
      this.hueInternal = color.hue;
      this.saturationInternal = color.saturation;
      this.lightnessInternal = color.lightness;
    }
    this.alphaInternal = color.alpha;
  }

  /**
   * Creates an RGB color.
   *
   * Throws an error if `red`, `green`, and `blue` aren't between `0` and `255`,
   * or if `alpha` isn't between `0` and `1`.
   */
  static rgb(
    red: number,
    green: number,
    blue: number,
    alpha?: number
  ): SassColor {
    return new SassColor({
      red: fuzzyAssertInRange(red, 0, 255, 'red'),
      green: fuzzyAssertInRange(green, 0, 255, 'green'),
      blue: fuzzyAssertInRange(blue, 0, 255, 'blue'),
      alpha: alpha === undefined ? 1 : fuzzyAssertInRange(alpha, 0, 1, 'alpha'),
    });
  }

  /**
   * Creates an HSL color.
   *
   * Throws an error if `saturation` or `lightness` aren't between `0` and
   * `100`, or if `alpha` isn't between `0` and `1`.
   */
  static hsl(
    hue: number,
    saturation: number,
    lightness: number,
    alpha?: number
  ) {
    return new SassColor({
      hue: hue % 360,
      saturation: fuzzyAssertInRange(saturation, 0, 100, 'saturation'),
      lightness: fuzzyAssertInRange(lightness, 0, 100, 'lightness'),
      alpha: alpha === undefined ? 1 : fuzzyAssertInRange(alpha, 0, 1, 'alpha'),
    });
  }

  /**
   * Creates an HWB color.
   *
   * Throws an error if `whiteness` or `blackness` aren't between `0` and `100`,
   * or if `alpha` isn't between `0` and `1`.
   */
  static hwb(
    hue: number,
    whiteness: number,
    blackness: number,
    alpha?: number
  ) {
    // From https://www.w3.org/TR/css-color-4/#hwb-to-rgb
    const scaledHue = (hue % 360) / 360;
    let scaledWhiteness =
      fuzzyAssertInRange(whiteness, 0, 100, 'whiteness') / 100;
    let scaledBlackness =
      fuzzyAssertInRange(blackness, 0, 100, 'blackness') / 100;

    const sum = scaledWhiteness + scaledBlackness;
    if (sum > 1) {
      scaledWhiteness /= sum;
      scaledBlackness /= sum;
    }

    const factor = 1 - scaledWhiteness - scaledBlackness;
    function toRgb(hue: number) {
      const channel = hueToRgb(0, 1, hue) * factor + scaledWhiteness;
      return fuzzyRound(channel * 255);
    }

    // Because HWB is (currently) used much less frequently than HSL or RGB, we
    // don't cache its values because we expect the memory overhead of doing so
    // to outweigh the cost of recalculating it on access. Instead, we eagerly
    // convert it to RGB and then convert back if necessary.
    return SassColor.rgb(
      toRgb(scaledHue + 1 / 3),
      toRgb(scaledHue),
      toRgb(scaledHue - 1 / 3),
      alpha
    );
  }

  /** `this`'s red channel. */
  get red(): number {
    if (this.redInternal === undefined) {
      this.hslToRgb();
    }
    return this.redInternal!;
  }

  /** `this`'s blue channel. */
  get blue(): number {
    if (this.blueInternal === undefined) {
      this.hslToRgb();
    }
    return this.blueInternal!;
  }

  /** `this`'s green channel. */
  get green(): number {
    if (this.greenInternal === undefined) {
      this.hslToRgb();
    }
    return this.greenInternal!;
  }

  /** `this`'s hue value. */
  get hue(): number {
    if (this.hueInternal === undefined) {
      this.rgbToHsl();
    }
    return this.hueInternal!;
  }

  /** `this`'s saturation value. */
  get saturation(): number {
    if (this.saturationInternal === undefined) {
      this.rgbToHsl();
    }
    return this.saturationInternal!;
  }

  /** `this`'s hue value. */
  get lightness(): number {
    if (this.lightnessInternal === undefined) {
      this.rgbToHsl();
    }
    return this.lightnessInternal!;
  }

  /** `this`'s whiteness value. */
  get whiteness(): number {
    // Because HWB is (currently) used much less frequently than HSL or RGB, we
    // don't cache its values because we expect the memory overhead of doing so
    // to outweigh the cost of recalculating it on access.
    return (Math.min(this.red, this.green, this.blue) / 255) * 100;
  }

  /** `this`'s blackness value. */
  get blackness(): number {
    // Because HWB is (currently) used much less frequently than HSL or RGB, we
    // don't cache its values because we expect the memory overhead of doing so
    // to outweigh the cost of recalculating it on access.
    return 100 - (Math.max(this.red, this.green, this.blue) / 255) * 100;
  }

  /** `this`'s alpha channel. */
  get alpha(): number {
    return this.alphaInternal;
  }

  assertColor(): SassColor {
    return this;
  }

  /**
   * Returns a copy of `this` with its RGB channels changed to `red`, `green`,
   * `blue`, and/or `alpha`.
   */
  changeRgb(options: {
    red?: number;
    green?: number;
    blue?: number;
    alpha?: number;
  }): SassColor {
    return SassColor.rgb(
      options.red ?? this.red,
      options.green ?? this.green,
      options.blue ?? this.blue,
      options.alpha ?? this.alpha
    );
  }

  /**
   * Returns a copy of `this` with its HSL values changed to `hue`,
   * `saturation`, `lightness`, and/or `alpha`.
   */
  changeHsl(options: {
    hue?: number;
    saturation?: number;
    lightness?: number;
    alpha?: number;
  }): SassColor {
    return SassColor.hsl(
      options.hue ?? this.hue,
      options.saturation ?? this.saturation,
      options.lightness ?? this.lightness,
      options.alpha ?? this.alpha
    );
  }

  /**
   * Returns a copy of `this` with its HWB values changed to `hue`, `whiteness`,
   * `blackness`, and/or `alpha`.
   */
  changeHwb(options: {
    hue?: number;
    whiteness?: number;
    blackness?: number;
    alpha?: number;
  }): SassColor {
    return SassColor.hwb(
      options.hue ?? this.hue,
      options.whiteness ?? this.whiteness,
      options.blackness ?? this.blackness,
      options.alpha ?? this.alpha
    );
  }

  /** Returns a copy of `this` with its alpha channel changed to `alpha`. */
  changeAlpha(alpha: number): SassColor {
    return new SassColor({
      red: this.red,
      green: this.green,
      blue: this.blue,
      alpha: fuzzyAssertInRange(alpha, 0, 1, 'alpha'),
    });
  }

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

  // Computes `this`'s `hue`, `saturation`, and `lightness` values based on
  // `red`, `green`, and `blue`.
  //
  // Algorithm from https://en.wikipedia.org/wiki/HSL_and_HSV#RGB_to_HSL_and_HSV
  private rgbToHsl(): void {
    const scaledRed = this.red / 255;
    const scaledGreen = this.green / 255;
    const scaledBlue = this.blue / 255;

    const max = Math.max(scaledRed, scaledGreen, scaledBlue);
    const min = Math.min(scaledRed, scaledGreen, scaledBlue);
    const delta = max - min;

    if (max === min) {
      this.hueInternal = 0;
    } else if (max === scaledRed) {
      this.hueInternal = ((60 * (scaledGreen - scaledBlue)) / delta) % 360;
    } else if (max === scaledGreen) {
      this.hueInternal = (120 + (60 * (scaledBlue - scaledRed)) / delta) % 360;
    } else if (max === scaledBlue) {
      this.hueInternal = (240 + (60 * (scaledRed - scaledGreen)) / delta) % 360;
    }

    this.lightnessInternal = 50 * (max + min);

    if (max === min) {
      this.saturationInternal = 0;
    } else if (this.lightnessInternal < 50) {
      this.saturationInternal = (100 * delta) / (max + min);
    } else {
      this.saturationInternal = (100 * delta) / (2 - max - min);
    }
  }

  // Computes `this`'s red`, `green`, and `blue` channels based on `hue`,
  // `saturation`, and `value`.
  //
  // Algorithm from the CSS3 spec: https://www.w3.org/TR/css3-color/#hsl-color.
  private hslToRgb(): void {
    const scaledHue = this.hue / 360;
    const scaledSaturation = this.saturation / 100;
    const scaledLightness = this.lightness / 100;

    const m2 =
      scaledLightness <= 0.5
        ? scaledLightness * (scaledSaturation + 1)
        : scaledLightness +
          scaledSaturation -
          scaledLightness * scaledSaturation;
    const m1 = scaledLightness * 2 - m2;

    this.redInternal = fuzzyRound(hueToRgb(m1, m2, scaledHue + 1 / 3) * 255);
    this.greenInternal = fuzzyRound(hueToRgb(m1, m2, scaledHue) * 255);
    this.blueInternal = fuzzyRound(hueToRgb(m1, m2, scaledHue - 1 / 3) * 255);
  }
}

// An algorithm from the CSS3 spec: http://www.w3.org/TR/css3-color/#hsl-color.
function hueToRgb(m1: number, m2: number, hue: number): number {
  if (hue < 0) hue += 1;
  if (hue > 1) hue -= 1;

  if (hue < 1 / 6) {
    return m1 + (m2 - m1) * hue * 6;
  } else if (hue < 1 / 2) {
    return m2;
  } else if (hue < 2 / 3) {
    return m1 + (m2 - m1) * (2 / 3 - hue) * 6;
  } else {
    return m1;
  }
}
