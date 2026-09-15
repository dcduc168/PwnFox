# PwnFox

Firefox containers plus a Burp extension for web security testing. Fork of [yeswehack/PwnFox](https://github.com/yeswehack/PwnFox); per-container proxies follow [bekh6ex/firefox-container-proxy](https://github.com/bekh6ex/firefox-container-proxy). Requires Firefox 153+.

## Install

From the [latest release](https://github.com/dcduc168/PwnFox/releases/latest):

- Firefox: `about:addons` → gear → **Install Add-on From File** → the `.xpi`
- Burp: **Extensions → Installed → Add** → Java → the `.jar`

PwnFox starts disabled.

## Use

- **Containers** — popup swatches open isolated tabs. Assign proxies in the options page.
- **Color tagging** — popup **Tag requests with container color** adds `X-PwnFox-Color`. Burp highlights that request. **Settings → Extensions → PwnFox → Replace color header** strips it only when sending upstream. Purple maps to Burp magenta.
- **Toolbox** — options page scripts, popup **Inject on page load**. Runs in the page JavaScript world at `document_start` (hooks and `window` helpers work in that tab's Console). The page can read the script; do not put secrets in it.
- **Messages** — DevTools panel logs `postMessage` for the inspected tab while the panel is open.

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

Use only on systems you are authorized to test. Proxying, toolbox injection, and stripped security headers all weaken isolation; enable them only when needed.
