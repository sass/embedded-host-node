// Copyright 2021 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {Value} from './index';
import {
  fuzzyAssertInRange,
  fuzzyEquals,
  fuzzyRound,
  positiveMod,
} from './utils';
import {hash} from 'immutable';

interface RgbColor {
  red: number;
  green: number;
  blue: number;
  alpha?: number;
}

interface HslColor {
  hue: number;
  saturation: number;
  lightness: number;
  alpha?: number;
}

interface HwbColor {
  hue: number;
  whiteness: number;
  blackness: number;
  alpha?: number;
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

  constructor(color: RgbColor);
  constructor(color: HslColor);
  constructor(color: HwbColor);
  constructor(color: RgbColor | HslColor | HwbColor) {
    super();

    if ('red' in color) {
      this.redInternal = fuzzyAssertInRange(
        Math.round(color.red),
        0,
        255,
        'red'
      );
      this.greenInternal = fuzzyAssertInRange(
        Math.round(color.green),
        0,
        255,
        'green'
      );
      this.blueInternal = fuzzyAssertInRange(
        Math.round(color.blue),
        0,
        255,
        'blue'
      );
    } else if ('saturation' in color) {
      this.hueInternal = positiveMod(color.hue, 360);
      this.saturationInternal = fuzzyAssertInRange(
        color.saturation,
        0,
        100,
        'saturation'
      );
      this.lightnessInternal = fuzzyAssertInRange(
        color.lightness,
        0,
        100,
        'lightness'
      );
    } else {
      // From https://www.w3.org/TR/css-color-4/#hwb-to-rgb
      const scaledHue = positiveMod(color.hue, 360) / 360;
      let scaledWhiteness =
        fuzzyAssertInRange(color.whiteness, 0, 100, 'whiteness') / 100;
      let scaledBlackness =
        fuzzyAssertInRange(color.blackness, 0, 100, 'blackness') / 100;

      const sum = scaledWhiteness + scaledBlackness;
      if (sum > 1) {
        scaledWhiteness /= sum;
        scaledBlackness /= sum;
      }

      // Because HWB is (currently) used much less frequently than HSL or RGB, we
      // don't cache its values because we expect the memory overhead of doing so
      // to outweigh the cost of recalculating it on access. Instead, we eagerly
      // convert it to RGB and then convert back if necessary.
      this.redInternal = hwbToRgb(
        scaledHue + 1 / 3,
        scaledWhiteness,
        scaledBlackness
      );
      this.greenInternal = hwbToRgb(
        scaledHue,
        scaledWhiteness,
        scaledBlackness
      );
      this.blueInternal = hwbToRgb(
        scaledHue - 1 / 3,
        scaledWhiteness,
        scaledBlackness
      );
    }

    this.alphaInternal =
      color.alpha === undefined
        ? 1
        : fuzzyAssertInRange(color.alpha, 0, 1, 'alpha');
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

  /**
   * Whether `this` has already calculated the HSL components for the color.
   *
   * This is an internal property that's not an official part of Sass's JS API,
   * and may be broken at any time.
   */
  get hasCalculatedHsl(): boolean {
    return !!this.hueInternal;
  }

  assertColor(): SassColor {
    return this;
  }

  /**
   * Returns a copy of `this` with its channels changed to match `color`.
   */
  change(color: Partial<RgbColor>): SassColor;
  change(color: Partial<HslColor>): SassColor;
  change(color: Partial<HwbColor>): SassColor;
  change(
    color: Partial<RgbColor> | Partial<HslColor> | Partial<HwbColor>
  ): SassColor {
    if ('whiteness' in color || 'blackness' in color) {
      return new SassColor({
        hue: color.hue ?? this.hue,
        whiteness: color.whiteness ?? this.whiteness,
        blackness: color.blackness ?? this.blackness,
        alpha: color.alpha ?? this.alpha,
      });
    } else if (
      'hue' in color ||
      'saturation' in color ||
      'lightness' in color
    ) {
      // Tell TypeScript this isn't a Partial<HwbColor>.
      const hsl = color as Partial<HslColor>;
      return new SassColor({
        hue: hsl.hue ?? this.hue,
        saturation: hsl.saturation ?? this.saturation,
        lightness: hsl.lightness ?? this.lightness,
        alpha: hsl.alpha ?? this.alpha,
      });
    } else if (
      'red' in color ||
      'green' in color ||
      'blue' in color ||
      this.redInternal
    ) {
      const rgb = color as Partial<RgbColor>;
      return new SassColor({
        red: rgb.red ?? this.red,
        green: rgb.green ?? this.green,
        blue: rgb.blue ?? this.blue,
        alpha: rgb.alpha ?? this.alpha,
      });
    } else {
      return new SassColor({
        hue: this.hue,
        saturation: this.saturation,
        lightness: this.lightness,
        alpha: color.alpha ?? this.alpha,
      });
    }
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
      this.hueInternal = positiveMod(
        (60 * (scaledGreen - scaledBlue)) / delta,
        360
      );
    } else if (max === scaledGreen) {
      this.hueInternal = positiveMod(
        120 + (60 * (scaledBlue - scaledRed)) / delta,
        360
      );
    } else if (max === scaledBlue) {
      this.hueInternal = positiveMod(
        240 + (60 * (scaledRed - scaledGreen)) / delta,
        360
      );
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

// A helper for converting HWB colors to RGB.
function hwbToRgb(
  hue: number,
  scaledWhiteness: number,
  scaledBlackness: number
): number {
  const factor = 1 - scaledWhiteness - scaledBlackness;
  const channel = hueToRgb(0, 1, hue) * factor + scaledWhiteness;
  return fuzzyRound(channel * 255);
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
