class Feature {
    constructor(config, configName) {
        this.config = config
        this.configName = configName
        this.started = false
        config.onChange(configName, v => {
            v ? this.start() : this.stop()
        })
    }

    async maybeStart() {
        if (await this.config.get(this.configName)) {
            this.start();
        } else {
            this.stop();
        }
    }

    start() {
        this.started = true
    }

    stop() {
        this.started = false
    }
}


/* Burp Proxy */

function proxify(config, onlyContainers) {
    return async function (e) {
        if (onlyContainers && e.cookieStoreId == 'firefox-default')
            return { type: "direct" };
        // A container without its own entry in containerProxies falls back
        // to the global Burp host/port -- config.get() is cache-backed, so
        // this adds no extra storage round-trip per request.
        const override = (await config.get("containerProxies"))[e.cookieStoreId]
        const host = override?.host || await config.get("burpProxyHost")
        const port = override?.port || await config.get("burpProxyPort")
        return {
            type: "http",
            host,
            port: Number(port)
        };
    }
}



class UseBurpProxyAll extends Feature {
    constructor(config) {
        super(config, 'useBurpProxyAll')
        this.proxy = proxify(config, false)
    }

    async start() {
        super.start()
        if (!await this.config.get("enabled")) return

        browser.proxy.onRequest.addListener(this.proxy, { urls: ["<all_urls>"] })

    }

    stop() {
        browser.proxy.onRequest.removeListener(this.proxy)
        super.stop()
    }
}


class UseBurpProxyContainers extends Feature {
    constructor(config) {
        super(config, 'useBurpProxyContainer')
        this.proxy = proxify(config, true)
    }

    async start() {
        super.start()
        if (!await this.config.get("enabled")) return

        browser.proxy.onRequest.addListener(this.proxy, { urls: ["<all_urls>"] })
    }

    stop() {
        super.stop()
        browser.proxy.onRequest.removeListener(this.proxy)
    }
}


/* Add Color Headers */


/* colorHeaderHandler runs on every request; a tab's cookieStoreId never
 * changes after creation, and an identity's color rarely does, so cache
 * both instead of paying a tabs.get()/contextualIdentities.get() round-trip
 * per request. The invalidation listeners below keep them correct. */
const tabCookieStoreCache = new Map()
const identityCache = new Map()

async function getCookieStoreId(tabId) {
    if (tabCookieStoreCache.has(tabId)) return tabCookieStoreCache.get(tabId)
    const { cookieStoreId } = await browser.tabs.get(tabId)
    tabCookieStoreCache.set(tabId, cookieStoreId)
    return cookieStoreId
}

async function getIdentity(cookieStoreId) {
    if (identityCache.has(cookieStoreId)) return identityCache.get(cookieStoreId)
    const identity = await browser.contextualIdentities.get(cookieStoreId)
    identityCache.set(cookieStoreId, identity)
    return identity
}

function forgetTab(tabId) {
    tabCookieStoreCache.delete(tabId)
}

function forgetIdentity({ contextualIdentity }) {
    identityCache.delete(contextualIdentity.cookieStoreId)
}

async function colorHeaderHandler(e) {
    if (e.tabId < 0) return

    const cookieStoreId = await getCookieStoreId(e.tabId)
    if (cookieStoreId === "firefox-default") {
        return {}
    }
    const identity = await getIdentity(cookieStoreId)
    if (identity.name.startsWith("PwnFox-")) {
        const name = "X-PwnFox-Color"
        // Firefox's "purple" container color is rendered as magenta; every
        // other contextualIdentities color name is used as-is, so renames
        // Firefox makes to its color list (e.g. turquoise -> cyan in
        // Firefox 153, bug 2044354) are picked up automatically.
        const value = identity.color === "purple" ? "magenta" : identity.color
        e.requestHeaders.push({ name, value })
    }
    return { requestHeaders: e.requestHeaders }
}

class AddContainerHeader extends Feature {
    constructor(config) {
        super(config, 'addContainerHeader')
    }

    async start() {
        super.start()
        if (!await this.config.get("enabled")) return

        browser.webRequest.onBeforeSendHeaders.addListener(colorHeaderHandler,
            { urls: ["<all_urls>"] },
            ["blocking", "requestHeaders"]
        );
        browser.tabs.onRemoved.addListener(forgetTab)
        browser.contextualIdentities.onUpdated.addListener(forgetIdentity)
        browser.contextualIdentities.onRemoved.addListener(forgetIdentity)
    }

    stop() {
        browser.webRequest.onBeforeSendHeaders.removeListener(colorHeaderHandler)
        browser.tabs.onRemoved.removeListener(forgetTab)
        browser.contextualIdentities.onUpdated.removeListener(forgetIdentity)
        browser.contextualIdentities.onRemoved.removeListener(forgetIdentity)
        tabCookieStoreCache.clear()
        identityCache.clear()
        super.stop()
    }
}


/* Remove security Headers */
function removeHeaders(response) {
    const { responseHeaders: origHeaders } = response
    const blacklistedHeaders = [
        "Content-Security-Policy",
        "X-XSS-Protection",
        "X-Frame-Options",
        "X-Content-Type-Options"
    ]
    const newHeaders = origHeaders.filter(({ name }) => {
        return !blacklistedHeaders.includes(name)
    })
    return { responseHeaders: newHeaders }
}


class RemoveSecurityHeaders extends Feature {
    constructor(config) {
        super(config, 'removeSecurityHeaders')
    }

    async start() {
        super.start()
        if (!await this.config.get("enabled")) return

        browser.webRequest.onHeadersReceived.addListener(removeHeaders,
            { urls: ["<all_urls>"] },
            ["blocking", "responseHeaders"]
        );
    }

    stop() {
        super.stop()
        browser.webRequest.onHeadersReceived.removeListener(removeHeaders)
    }
}

/* Toolbox */

class InjectToolBox extends Feature {
    constructor(config) {
        super(config, "injectToolbox")
        this.script = null
        config.onChange("activeToolbox", () => this.maybeStart())
        config.onChange("savedToolbox", () => this.maybeStart())
    }


    async start() {
        super.start()
        if (!await this.config.get("enabled")) return



        const toolboxName = await this.config.get("activeToolbox")
        const toolbox = (await this.config.get("savedToolbox"))[toolboxName] || ""

        if (this.script) {
            this.script.unregister()
        }

        this.script = await browser.contentScripts.register({
            allFrames: true,
            matches: ["<all_urls>"],
            runAt: "document_start",
            js: [{
                code: toolbox,
            }]
        })
    }

    stop() {
        super.stop()
        if (this.script) {
            this.script.unregister()
        }
    }

}


/* Post Message */
function logMessage({ data, origin }) {
    browser.runtime.sendMessage({ data, origin, destination: window.origin })
}

class LogPostMessage extends Feature {
    constructor(config) {
        super(config, "logPostMessage")
    }

    async start() {
        super.start()
        if (!await this.config.get("enabled")) return
        window.addEventListener("message", logMessage);

    }

    stop() {
        super.stop()
        window.removeEventListener("message", logMessage);
    }
}

/* Global Enable */

class FeaturesGroup extends Feature {
    constructor(config, features) {
        super(config, "enabled")
        this.features = features
    }

    start() {
        super.start()
        this.features.forEach(f => f.maybeStart())
    }

    stop() {
        super.stop()
        this.features.forEach(f => f.stop())
    }
}


class BackgroundFeatures extends FeaturesGroup {
    constructor(config) {
        const features = [
            new UseBurpProxyContainers(config),
            new UseBurpProxyAll(config),
            new AddContainerHeader(config),
            new InjectToolBox(config),
            new RemoveSecurityHeaders(config),
        ]
        super(config, features)
    }

    start() {
        super.start()
        createIcon("#00ff00").then(([canvas, imageData]) => {
            browser.browserAction.setIcon({ imageData })
        })
    }

    stop() {
        super.stop()
        createIcon("#ff0000").then(([canvas, imageData]) => {
            browser.browserAction.setIcon({ imageData })
        })
    }
}


class ContentScriptFeatures extends FeaturesGroup {
    constructor(config) {
        const features = [
            new LogPostMessage(config),
        ]
        super(config, features)
    }
}