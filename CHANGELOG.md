# Changelog

Firefox and Burp share a version. Historical version numbers are preserved even where features were shipped as patch releases; future releases use major/minor/patch according to compatibility, new features, and fixes.

## 1.0.14

- Keep release changelog comparisons correct when published tags retain the original commit history after commit consolidation.

## 1.0.13

- Fix toolbox scripts to run in the page JavaScript world.
- Remove unused Firefox feature grouping and helpers.
- Clarify installation, usage, and per-container proxy attribution.
- Prevent replacement of published release artifacts and verify that Firefox packages match the tagged source.
- Choose changelog predecessors by version and preserve the latest release when restoring older versions.
- Record release history and versioning rules.

## 1.0.12

- Make Burp header replacement optional while highlighting independently of replacement.
- Split Burp request stages and simplify Firefox feature startup and color helpers.

Historical packaging discrepancy: this tag was moved from `9d49658` to `939312e` after publication. The signed Firefox artifact contains the earlier source, while the Burp artifact was rebuilt. Version 1.0.13 includes the current source consistently; the existing 1.0.12 assets are preserved.

## 1.0.11

- Make Firefox container color request tagging opt-in.
- Simplify release notes to a full changelog link.

## 1.0.10

- Allow editing saved proxies.
- Flush pending message logger batches and isolate default configuration values.
- Improve popup and message panel presentation.

## 1.0.9

- Reduce request processing and DevTools message overhead.

## 1.0.8

- Restore options page contrast and styling after switching to native controls.

## 1.0.7

- Scope tooling and message logging to active views.
- Replace custom file selection and options controls with native controls.
- Optimize Burp highlight color lookup.
- Remove obsolete screenshots and document message logging scope.

## 1.0.6

- Eliminate idle browsing overhead and load tooling only when needed.
- Publish only installable Firefox and Burp artifacts.
- Normalize Firefox source and streamline documentation.
- Remove the previous unit test suites.

## 1.0.5

- Sort container colors by hue.

## 1.0.4

- Support updated Firefox container colors and redesign extension views.
- Add a reusable proxy catalog with per-container routing.
- Cache configuration and container lookups on request paths.
- Migrate the Burp extension to the Montoya API and Java 21.
- Unify extension versioning and automate signed Firefox and Burp releases.
- Recover existing AMO signatures and avoid duplicate submissions.

Earlier 1.0.0–1.0.3/component-prefixed versions were build and signing iterations before unified releases. They are not recreated as additional stable releases.
