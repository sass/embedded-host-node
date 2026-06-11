## Embedded Sass Host

This package is an alternative to the [`sass`] package. It supports the same JS
API as `sass` and is maintained by the same team, but where the `sass` package
is pure JavaScript, `sass-embedded` is instead a JavaScript wrapper around a
native Dart executable. This means `sass-embedded` will generally be much faster
especially for large Sass compilations, but it can only be installed on the
platforms that Dart supports: Windows, Mac OS, and Linux.

[`sass`]: https://www.npmjs.com/package/sass

Despite being different packages, both `sass` and `sass-embedded` are considered
"Dart Sass" since they have the same underlying implementation. Since the first
stable release of the `sass-embedded` package, both packages are released at the
same time and share the same version number.

## Usage

This package provides the same JavaScript API as the `sass` package, and can be
used as a drop-in replacement:

```js
const sass = require('sass-embedded');

const result = sass.compile(scssFilename);

// OR

const result = await sass.compileAsync(scssFilename);
```

Unlike the `sass` package, the asynchronous API in `sass-embedded` will
generally be faster than the synchronous API since the Sass compilation logic is
happening in a different process.

See [the Sass website] for full API documentation.

[the Sass website]: https://sass-lang.com/documentation/js-api

## How Does It Work?

The `sass-embedded` runs the Dart Sass [embedded compiler] as a separate
executable and uses the [Embedded Sass Protocol] to communicate with it over its
stdin and stdout streams. This protocol is designed to make it possible not only
to start a Sass compilation, but to control aspects of it that are exposed by an
API. This includes defining custom importers, functions, and loggers, all of
which are invoked by messages from the embedded compiler back to the host.

[embedded compiler]: https://github.com/sass/dart-sass#embedded-dart-sass
[Embedded Sass Protocol]: https://github.com/sass/sass/tree/main/spec/embedded-protocol.md

Although this sort of two-way communication with an embedded process is
inherently asynchronous in Node.js, this package supports the synchronous
`compile()` API using a custom [synchronous message-passing library] that's
implemented with the [`Atomics.wait()`] primitive.

[synchronous message-passing library]: https://github.com/sass/sync-message-port
[`Atomics.wait()`]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/wait

---

Disclaimer: this is not an official Google product.
