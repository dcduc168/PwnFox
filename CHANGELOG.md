# Changelog

Firefox and Burp share a version. Related changes ship together; documentation, formatting, history cleanup, and internal refactors alone do not trigger a release. Fixes increment the patch, new features the minor, and incompatible changes the major.

## 1.0.14 — Consolidated stable release

This release combines the changes previously published across the fork's small patch releases.

### Firefox

- Support Firefox 153+ container colors and consistent Burp highlights.
- Add a reusable proxy catalog with per-container routing and editing of saved proxies.
- Refresh popup/settings views, use native options controls, and restore options page contrast.
- Run toolbox scripts in the page JavaScript world at page load.
- Scope DevTools postMessage logging to the inspected tab while its Messages panel is open.
- Reduce idle browsing, request processing, and message overhead; flush pending logger batches and isolate configuration defaults.
- Start disabled and make container color request tagging opt-in.

### Burp

- Migrate to the Montoya API and Java 21.
- Highlight requests independently of optional upstream color-header removal.
- Optimize color lookup and separate received/upstream request stages.

### Distribution

- Provide a Mozilla-signed Firefox XPI and an installable Burp JAR.
- Verify Firefox packages against tagged source and prevent replacement of published artifacts.

Git tags 1.0.4–1.0.13 remain as historical source snapshots. Their GitHub release entries are retired in favor of this consolidated release. The 1.0.12 signed Firefox package used source from before its tag was moved; 1.0.13 and this release contain consistent source and artifacts.
