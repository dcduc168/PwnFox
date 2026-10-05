# PwnFox

Firefox containers plus a Burp extension for web security testing. Fork of [yeswehack/PwnFox](https://github.com/yeswehack/PwnFox); per-container proxies follow [bekh6ex/firefox-container-proxy](https://github.com/bekh6ex/firefox-container-proxy). Requires Firefox 153+.

## Install

From the [latest release](https://github.com/dcduc168/PwnFox/releases/latest):

- Firefox: `about:addons` → gear → **Install Add-on From File** → the `.xpi`
- Burp: **Extensions → Installed → Add** → Java → the `.jar`

PwnFox starts disabled.

## Use

Popup swatches open isolated container tabs. Assign proxies on the options page.

Enable **Tag requests with container color** in the popup to add `X-PwnFox-Color`. Burp highlights that request. **Settings → Extensions → PwnFox → Replace color header** strips it only when sending upstream. Purple maps to Burp magenta.

Write toolbox scripts on the options page and turn on **Inject on page load** in the popup. They run in the page JavaScript world at `document_start`, so hooks and `window` helpers work in that tab's Console. The page can read the script; do not put secrets in it.

The DevTools Messages panel logs `postMessage` for the inspected tab while the panel is open.

## Build

Node.js 24 and Java 21.

```shell
npm ci
npm run lint:firefox
npm run build:firefox
./burp/gradlew --project-dir burp clean jar
```

Unsigned Firefox zip: `web-ext-artifacts/`. Burp jar: `burp/build/libs/`.

Keep `firefox/manifest.json` and `burp/gradle.properties` on the same version, then push a tag of that version to release.

Use one purpose per commit and a separate `chore(release)` commit for the version bump. Fixes and internal refactors increment the patch; new features increment the minor; incompatible changes increment the major. Create annotated tags after all changes for that version are committed. Published tags and artifacts stay fixed; corrections ship in a new version. After history consolidation, published tags keep pointing to the original release commits; changelog predecessors are chosen by version rather than ancestry. See [CHANGELOG.md](CHANGELOG.md) for release history.

To restore a missing historical release, dispatch the Release workflow from `master` with its existing tag. The workflow verifies artifact source, compares against the preceding version tag, and keeps older versions from becoming the latest release.

Use only on systems you are authorized to test. Proxying, toolbox injection, and stripped security headers all weaken isolation; enable them only when needed.
