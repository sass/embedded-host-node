## Embedded Sass Host

This is a Node.js library that implements the host side of the [Embedded Sass
protocol][]. It exposes a JS API for Sass that's backed by a native [Dart
Sass][] executable. It's much faster than running [Dart Sass compiled to
JavaScript][] while still providing a full JS API, with the ability to define
custom functions and importers.

[Embedded Sass protocol]: https://github.com/sass/sass-embedded-protocol/blob/master/README.md#readme
[Dart Sass]: https://sass-lang.com/dart-sass
[Dart Sass compiled to JavaScript]: https://www.npmjs.com/package/sass

Disclaimer: this is not an official Google product.
