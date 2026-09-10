# PwnFox

PwnFox connects Firefox containers to Burp Suite for focused web security testing. It combines a lightweight Firefox extension with a small Burp Montoya extension.

This repository is a fork of [yeswehack/PwnFox](https://github.com/yeswehack/PwnFox), updated for current Firefox container APIs and a unified release process.

## Features

- Create isolated Firefox container tabs from the popup.
- Route each container through a configurable proxy.
- Tag container requests and highlight them in Burp.
- Strip selected response security headers when explicitly enabled.
- Inject user-defined toolbox scripts at page start.
- Inspect `postMessage` traffic in Firefox DevTools.

PwnFox is disabled by default. It does not inject a static content script into every page. The toolbox and `postMessage` logger are registered only while their switches are enabled, and the logger is off by default.

## Install

Download both files from the [latest release](https://github.com/dcduc168/PwnFox/releases/latest):

- `pwnfox-firefox-<version>.xpi`
- `pwnfox-burp-<version>.jar`

For Firefox, open `about:addons`, choose the gear menu, select **Install Add-on From File**, and open the signed XPI.

For Burp Suite, open **Extensions → Installed → Add**, select **Java**, and open the JAR.

## Color mapping

The popup exposes only Firefox colors with a one-to-one Burp highlight. The Firefox request header is removed by the Burp extension before the request is sent upstream.

| Firefox | Burp |
| --- | --- |
| Red | Red |
| Orange | Orange |
| Yellow | Yellow |
| Green | Green |
| Cyan | Cyan |
| Blue | Blue |
| Purple | Magenta |
| Pink | Pink |
| Gray | Gray |

Unsupported colors such as violet are hidden. Legacy Firefox names `turquoise` and `toolbar` remain compatible as `cyan` and `gray`.

## Build

Requirements:

- Node.js 24
- Java 21

Build the Firefox extension:

```shell
npm ci
npm run lint:firefox
npm run build:firefox
```

The unsigned development ZIP is written to `web-ext-artifacts/`.

Build the Burp extension:

```shell
./burp/gradlew --project-dir burp clean jar
```

The JAR is written to `burp/build/libs/`.

## Release

Keep the versions in `firefox/manifest.json` and `burp/gradle.properties` identical, then push a bare semantic-version tag such as `1.2.3`.

The release workflow lints and signs the Firefox extension, builds and verifies the Burp JAR, and publishes both files in one GitHub release named after the version.

Mozilla signing requires these GitHub Actions secrets:

```shell
gh secret set AMO_JWT_ISSUER
gh secret set AMO_JWT_SECRET
```

## Security

Use PwnFox only on systems you are authorized to test. Toolbox code runs in page contexts, proxying exposes browser traffic to the configured endpoint, and removing response security headers weakens browser protections. Enable these features only when needed.

Project changes follow [Conventional Commits](https://www.conventionalcommits.org/).
