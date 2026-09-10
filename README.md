# <img src="/firefox/icons/icon.svg" width=30> PwnFox

PwnFox is a Firefox/Burp extension that provides useful tools for security audits: one-click Burp proxying, per-container request tagging, a postMessage logger, a JS toolbox injector, and a security-header stripper.

This is a fork of [yeswehack/PwnFox](https://github.com/yeswehack/PwnFox) that adds compatibility with Firefox 153+, which renamed several `contextualIdentities` container colors (bug [2044354](https://bugzilla.mozilla.org/show_bug.cgi?id=2044354)).

## Features

![popup](/screenshots/popup.png)

### Single click BurpProxy

Connect to Burp with a single click. This removes the need for a separate proxy-switching addon like FoxyProxy for most workflows; leave this unchecked if you still need FoxyProxy's extra features.

### Containers Profiles

PwnFox gives you fast access to Firefox containers, letting you use multiple identities in the same browser. When PwnFox and the `Add container header` option are enabled, it automatically adds an `X-PwnFox-Color` header to highlight the request in Burp.

The PwnFox Burp extension automatically highlights and strips that header, but you can also customize this behavior with extensions like Logger++.

![tabs](/screenshots/tabs.png)
![burp](/screenshots/burp.png)

### PostMessage Logger

PwnFox adds a new message tab to your devtools, letting you quickly visualize all `postMessage` traffic between frames.

![](/screenshots/post-single.png)

You can also provide your own function to parse/filter the messages. It receives 3 arguments:
* `data` — the message payload
* `origin` — the origin URL of the sending window
* `destination` — the origin URL of the receiving window

The function can return a string or a JSON-serializable object.

![](/screenshots/post-dual.png)

### Toolbox

Inject your own JavaScript on page load, as early as possible. Use it for dangerous-behavior detection or to add helper functions to your JS console.

**Be careful: the injected toolbox runs in the page's window context — never inject secrets on an untrusted domain.**

![settings](/screenshots/settings.png)

### Security header remover

Sometimes it's easier to test with security headers disabled. Toggle them off with a single click — remember to re-enable them before testing your final payload.

Headers stripped:
* Content-Security-Policy
* X-XSS-Protection
* X-Frame-Options
* X-Content-Type-Options

## Installation

Download the latest signed Firefox XPI from
[Releases](https://github.com/dcduc168/PwnFox/releases), or build it yourself
(see [Build](#build)). To install the XPI, open `about:addons`, select the gear
menu, choose *Install Add-on From File*, and select the downloaded file. For a
source checkout, visit `about:debugging#/runtime/this-firefox`, select *Load
Temporary Add-on*, and open `firefox/manifest.json`.

* Burp: download the latest JAR from
  [Releases](https://github.com/dcduc168/PwnFox/releases), then open
  *Extensions* → *Installed* → *Add*, select *Java*, and choose the JAR.

The Firefox popup only offers colors that have a matching Burp highlight.
Firefox's `purple` is sent as Burp's equivalent `magenta`; unsupported colors
such as `violet` are omitted.

## Build

### Firefox

```shell
npm ci
npm run lint:firefox
npm run build:firefox
# The unsigned development ZIP is available in ./web-ext-artifacts.
```

The unified release workflow described below signs the Firefox extension through
Mozilla before publishing it.

Before the first release, create
[AMO API credentials](https://addons.mozilla.org/developers/addon/api/key/) and
store them as GitHub Actions secrets. Both commands prompt for the value without
putting it in shell history:

```shell
gh secret set AMO_JWT_ISSUER
gh secret set AMO_JWT_SECRET
```

Mozilla must approve each submitted version before the workflow can publish it.

### Burp

```shell
cd burp
./gradlew clean check jar
# The JAR is available in ./build/libs.
```

### Release

Keep the version in `firefox/manifest.json` and `burp/gradle.properties` in
sync, then push a conventional version tag such as `v1.0.4`. The workflow tests
and builds both extensions in parallel and creates one GitHub release containing
the signed Firefox XPI, the Burp JAR, and SHA-256 checksums for both. An existing
tag can also be released manually from the Actions tab.

## Changelog

This fork doesn't maintain a separate changelog — see the [commit history](https://github.com/dcduc168/PwnFox/commits/master) for changes made on top of [upstream](https://github.com/yeswehack/PwnFox).
