// Copyright 2022 Google LLC. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {SassColor} from '../../value/color';
import {LegacyValueBase} from './base';

export class LegacyColor extends LegacyValueBase<SassColor> {
  constructor(red: number, green: number, blue: number, alpha?: number);
  constructor(argb: number);
  constructor(inner: SassColor);

  constructor(
    redOrArgb: number | SassColor,
    green?: number,
    blue?: number,
    alpha?: number
  ) {
    if (redOrArgb instanceof SassColor) {
      super(redOrArgb);
      return;
    }

    let red: number;
    if (!green || !blue) {
      const argb = redOrArgb as number;
      alpha = (argb >> 24) / 0xff;
      red = (argb >> 16) % 0x100;
      green = (argb >> 8) % 0x100;
      blue = argb % 0x100;
    } else {
      red = redOrArgb!;
    }

    super(
      new SassColor({
        red: clamp(red, 0, 255),
        green: clamp(green as number, 0, 255),
        blue: clamp(blue as number, 0, 255),
        alpha: alpha ? clamp(alpha, 0, 1) : 1,
      })
    );
  }

  getR(): number {
    return this.inner.red;
  }

  setR(value: number): void {
    this.inner = this.inner.change({red: clamp(value, 0, 255)});
  }

  getG(): number {
    return this.inner.green;
  }

  setG(value: number): void {
    this.inner = this.inner.change({green: clamp(value, 0, 255)});
  }

  getB(): number {
    return this.inner.blue;
  }

  setB(value: number): void {
    this.inner = this.inner.change({blue: clamp(value, 0, 255)});
  }

  getA(): number {
    return this.inner.alpha;
  }

  setA(value: number): void {
    this.inner = this.inner.change({alpha: clamp(value, 0, 1)});
  }
}

Object.defineProperty(LegacyColor, 'name', {value: 'sass.types.Color'});

// Returns `number` clamped to between `min` and `max`.
function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}
