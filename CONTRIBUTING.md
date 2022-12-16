# How to Contribute

We'd love to accept your patches and contributions to this project. There are
just a few small guidelines you need to follow.

## Contributor License Agreement

Contributions to this project must be accompanied by a Contributor License
Agreement. You (or your employer) retain the copyright to your contribution;
this simply gives us permission to use and redistribute your contributions as
part of the project. Head over to <https://cla.developers.google.com/> to see
your current agreements on file or to sign a new one.

You generally only need to submit a CLA once, so if you've already submitted one
(even if it was for a different project), you probably don't need to do it
again.

## Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more
information on using pull requests.

## Release process

Because this package's version remains in lockstep with the current version of
Dart Sass, it's not released manually from this repository. Instead, a release
commit is automatically generated once a new Embedded Dart Sass version has been
released, which in turn is automatically triggered by a release of Dart Sass. As
such, manual commits should never:

* Update the `package.json`'s version to a non-`-dev` number. Changing it from
  non-`-dev` to dev when adding a new feature is fine.

* Update the `package.json`'s `"compiler-version"` field to a non-`-dev` number.
  Changing it from non-`-dev` to dev when using a new feature is fine.

# Keeping in Sync With Other Packages

The embedded host depends on several different components which come from
different repositories:

* The [Dart Sass embedded compiler].
* [Dart Sass] (transitively through the embedded compiler).
* The [Sass embedded protocol].
* The [Sass JS API definition].

[Dart Sass embedded compiler]: https://github.com/sass/dart-sass-embedded
[Dart Sass]: https://github.com/sass/dart-sass
[Sass embedded protocol]: https://github.com/sass/embedded-protocol
[JS API definition]: https://github.com/sass/sass/tree/main/spec/js-api

These dependencies are made available in different ways depending on context.

## Local Development

When developing locally, you can download all of these dependencies by running
`npm run init`. This provides the following options for `compiler` (for the
embedded compiler), `protocol` (for the embedded protocol), and `api` (for the
JS API):

* `--<type>-path`: The local filesystem path of the package to use. This is
  useful when doing local development on both the host and its dependencies at
  the same time.

* `--<type>-ref`: A Git reference for the GitHub repository of the package to
  clone.

* `--<type>-version`: The released version of the package to use. This isn't
  available for `api`, because the JS API definition doesn't have its own tagged
  versions.

By default:

* This uses the version of the embedded protocol and compiler specified by
  `protocol-version` and `compiler-version` in `package.json`, *unless* these
  versions end in `-dev` in which case it checks out the latest revision on
  GitHub.

* This uses the JS API definition from the latest revision on GitHub.

`npm run init` chooses the Dart Sass version as follows:

* If a released version of the embedded compiler was specified, it uses the
  version of Dart Sass compiled into that release.

* If `--compiler-path` was specified, it uses the version of Dart Sass linked to
  that compiler.

* If the embedded compiler was cloned from GitHub, it uses the version of Dart
  Sass specified in its pubspec *unless* that version ends in `-dev`, in which
  case it checks out the latest revision on GitHub.

## Continuous Integration

CI tests also use `npm run init`, so they use the same defaults as local
development. However, if the pull request description includes a link to a pull
request for the embedded compiler, Dart Sass, the embedded protocol, or the JS
API, this will check out that version and run tests against it instead.

## Release

When this package is released to npm, it downloads the embedded protocol version
that matches `protocol-version` in `package.json`. It downloads the latest JS
API revision on GitHub.

The release version of the `sass-embedded` package does *not* include the
embedded compiler or Dart Sass. Instead, we release optional packages of the
form `sass-embedded-<os>-<arch>`. Each of these contains the published version
of the embedded compiler that matches `compiler-version` in `package.json` for
the given operating system/architecture combination.

If either `protocol-version` or `compiler-version` ends with `-dev`, the release
will fail.

**Note:** As part of the holistic release process for Dart Sass, the embedded
compiler's CI will automatically update this repository's `package.json` file
with the latest `compiler-version` and optional dependency versions before
tagging it for a release.
