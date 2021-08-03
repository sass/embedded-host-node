## Embedded Sass Host

This is a Node.js library that implements the host side of the [Embedded Sass
protocol][]. It exposes a JS API for Sass that's backed by a native [Dart
Sass][] executable. It's much faster than running [Dart Sass compiled to
JavaScript][] while still providing a full JS API, with the ability to define
custom functions and importers.

[embedded sass protocol]: https://github.com/sass/sass-embedded-protocol/blob/main/README.md#readme
[dart sass]: https://sass-lang.com/dart-sass
[dart sass compiled to javascript]: https://www.npmjs.com/package/sass

Disclaimer: this is not an official Google product.
