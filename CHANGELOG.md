## 1.0.0-beta.8

* Support custom importers for the new JS API.

* Support the `SassArgumentList` value type.

* Support the `SassFunction` value type.

## 1.0.0-beta.7

* Expose the `Exception` class and ensure that syntax errors match the official
  JS API.

* Add support for the `style`, `alertColor`, `alertAscii`, `quietDeps`,
  `verbose`, and `functions` options in `compile()`, `compileString()`,
  `compileAsync()`, and `compileStringAsync()`.

* Add support for `CompileResult.loadedUrls`.

## 1.0.0-beta.6

* Expose (as yet incomplete) `compile()`, `compileString()`, `compileAsync()`,
  and `compileStringAsync()` functions.

* Include the official TypeScript definition files.

## 1.0.0-beta.5

- Function and Values API
  - Add `SassColor` class.
  - Add `SassList` and `SassMap` classes.

- Add `indentedSyntax` option to `render()`

## 1.0.0-beta.4

- Allow installing on arm64.

- Function and Values API
  - Add `sassTrue` and `sassFalse` singletons.
  - Add `SassColor` class.
  - Add `SassNumber` class.
  - Add `SassString` class.

## 1.0.0-beta.3

- Properly handle `data:` URIs in sourceMap sources.

- Function and Values API
  - Add `Value` abstract class.
  - Add `sassNull` singleton.

## 1.0.0-beta.2

- No user visible changes.

## 1.0.0-beta.1

- Download the compiler binary to the correct directory on Windows.

## 1.0.0-beta.0

- Release Embedded Host beta with limited support for `render()`, which compiles
  Sass files and strings by communicating with the Embedded Compiler via the
  Embedded protocol. Does not yet support the entire `render` API, including
  custom functions and importers.
