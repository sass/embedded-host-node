## 1.0.0-beta.5

- Function and Values API
  - Add `SassColor` class.

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
