class Feature {
    constructor(config, configName) {
        this.config = config
        this.configName = configName
        this.started = false
        this.transition = Promise.resolve()
        config.onChange(configName, enabled => {
            this.schedule(enabled).catch(error => {
                console.error(`PwnFox: failed to update ${configName}`, error)
            })
        })
    }

    async maybeStart() {
        return this.schedule(await this.config.get(this.configName))
    }

    schedule(enabled) {
        const update = () => enabled ? this.start() : this.stop()
        this.transition = this.transition.then(update, update)
        return this.transition
    }

    start() {
        if (this.started) return false
        this.started = true
        return true
    }

    stop() {
        if (!this.started) return false
        this.started = false
        return true
    }
}


/* Burp Proxy */

const DIRECT_PROXY = Object.freeze({ type: "direct" })

class UseBurpProxy extends Feature {
    constructor(config) {
        super(config, "useBurpProxy")
        this.routes = new Map()
        this.routeRefresh = Promise.resolve()
        this.proxy = ({ cookieStoreId }) => this.routes.get(cookieStoreId) || DIRECT_PROXY
        this.handleRouteChange = () => {
            if (!this.started) return
            const refresh = () => this.started ? this.refreshRoutes() : undefined
            this.routeRefresh = this.routeRefresh.then(
                refresh,
                refresh
            )
            this.routeRefresh.catch(error => {
                console.error("PwnFox: failed to refresh proxy routes", error)
            })
        }
        config.onChange("proxies", this.handleRouteChange)
        config.onChange("contextProxies", this.handleRouteChange)
    }

    async refreshRoutes() {
        const [contextProxies, proxies] = await Promise.all([
            this.config.get("contextProxies"),
            this.config.get("proxies")
        ])
        const routes = new Map()
        for (const [cookieStoreId, proxyId] of Object.entries(contextProxies)) {
            const proxy = proxies[proxyId]
            if (!proxy) continue
            routes.set(cookieStoreId, {
                type: "http",
                host: proxy.host,
                port: Number(proxy.port)
            })
        }
        this.routes = routes
    }

    async start() {
        if (this.started || !await this.config.get("enabled")) return false

        await this.refreshRoutes()
        browser.proxy.onRequest.addListener(this.proxy, { urls: ["<all_urls>"] })
        super.start()
        return true
    }

    stop() {
        if (!super.stop()) return false
        browser.proxy.onRequest.removeListener(this.proxy)
        this.routes.clear()
        return true
    }
}


/* Add Color Headers */


/* Keep the request hot path synchronous. Container changes update this small
 * lookup table outside request handling. */
const identityCache = new Map()

function cacheIdentity({ contextualIdentity: identity }) {
    const highlight = identity.name.startsWith("PwnFox-")
        ? BURP_HIGHLIGHT_BY_FIREFOX_COLOR.get(identity.color)
        : undefined
    identityCache.set(identity.cookieStoreId, highlight)
}

function removeIdentity({ contextualIdentity }) {
    identityCache.delete(contextualIdentity.cookieStoreId)
}

function colorHeaderHandler({ cookieStoreId, requestHeaders }) {
    if (!cookieStoreId || cookieStoreId === "firefox-default") return

    const value = identityCache.get(cookieStoreId)
    if (value === undefined) return

    requestHeaders.push({ name: "X-PwnFox-Color", value })
    return { requestHeaders }
}

class AddContainerHeader extends Feature {
    constructor(config) {
        super(config, "addContainerHeader")
    }

    async start() {
        if (this.started || !await this.config.get("enabled")) return false

        identityCache.clear()
        const identities = await browser.contextualIdentities.query({})
        identities.forEach(identity => cacheIdentity({ contextualIdentity: identity }))
        browser.webRequest.onBeforeSendHeaders.addListener(colorHeaderHandler,
            { urls: ["<all_urls>"] },
            ["blocking", "requestHeaders"]
        )
        browser.contextualIdentities.onCreated.addListener(cacheIdentity)
        browser.contextualIdentities.onUpdated.addListener(cacheIdentity)
        browser.contextualIdentities.onRemoved.addListener(removeIdentity)
        super.start()
        return true
    }

    stop() {
        if (!super.stop()) return false
        browser.webRequest.onBeforeSendHeaders.removeListener(colorHeaderHandler)
        browser.contextualIdentities.onCreated.removeListener(cacheIdentity)
        browser.contextualIdentities.onUpdated.removeListener(cacheIdentity)
        browser.contextualIdentities.onRemoved.removeListener(removeIdentity)
        identityCache.clear()
        return true
    }
}


/* Remove security headers in Firefox's network engine rather than invoking
 * extension JavaScript for every response. */
const SECURITY_HEADERS_RULE_ID = 1
const SECURITY_HEADERS_RULE = Object.freeze({
    id: SECURITY_HEADERS_RULE_ID,
    priority: 1,
    action: {
        type: "modifyHeaders",
        responseHeaders: [
            { header: "content-security-policy", operation: "remove" },
            { header: "x-content-type-options", operation: "remove" },
            { header: "x-frame-options", operation: "remove" },
            { header: "x-xss-protection", operation: "remove" }
        ]
    },
    condition: { urlFilter: "*" }
})

class RemoveSecurityHeaders extends Feature {
    constructor(config) {
        super(config, "removeSecurityHeaders")
    }

    async start() {
        if (this.started || !await this.config.get("enabled")) return false

        await browser.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [SECURITY_HEADERS_RULE_ID],
            addRules: [SECURITY_HEADERS_RULE]
        })
        super.start()
        return true
    }

    async stop() {
        const stopped = super.stop()
        await browser.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [SECURITY_HEADERS_RULE_ID]
        })
        return stopped
    }
}

/* Toolbox */

class InjectToolBox extends Feature {
    constructor(config) {
        super(config, "injectToolbox")
        this.script = null
        this.refreshPromise = Promise.resolve()
        this.refreshRequested = 0
        this.refreshRunning = false
        this.handleToolboxChange = () => {
            if (!this.started) return
            this.queueRefresh().catch(error => {
                console.error("PwnFox: failed to refresh toolbox", error)
            })
        }
        config.onChange("activeToolbox", this.handleToolboxChange)
        config.onChange("savedToolbox", this.handleToolboxChange)
    }

    queueRefresh() {
        this.refreshRequested += 1
        if (this.refreshRunning) return this.refreshPromise

        this.refreshRunning = true
        this.refreshPromise = (async () => {
            try {
                let handled = 0
                while (handled !== this.refreshRequested) {
                    handled = this.refreshRequested
                    await this.refresh()
                }
            } finally {
                this.refreshRunning = false
            }
        })()
        return this.refreshPromise
    }

    async refresh() {
        if (this.script) {
            await this.script.unregister()
            this.script = null
        }
        if (!this.started) return

        const [toolboxName, savedToolbox] = await Promise.all([
            this.config.get("activeToolbox"),
            this.config.get("savedToolbox")
        ])
        const toolbox = savedToolbox[toolboxName] || ""
        if (!toolbox || !this.started) return

        const script = await browser.contentScripts.register({
            allFrames: true,
            matches: ["<all_urls>"],
            runAt: "document_start",
            js: [{ code: toolbox }]
        })
        if (!this.started) {
            await script.unregister()
            return
        }
        this.script = script
    }

    async start() {
        if (this.started || !await this.config.get("enabled")) return false
        super.start()
        await this.queueRefresh()
        return true
    }

    async stop() {
        if (!super.stop()) return false
        await this.queueRefresh()
        return true
    }
}


/* Global Enable */

class FeaturesGroup extends Feature {
    constructor(config, features) {
        super(config, "enabled")
        this.features = features
    }

    async start() {
        if (!super.start()) return false
        await Promise.all(this.features.map(feature => feature.maybeStart()))
        return true
    }

    async stop() {
        const stopped = super.stop()
        await Promise.all(this.features.map(feature => feature.stop()))
        return stopped
    }
}


class BackgroundFeatures extends FeaturesGroup {
    constructor(config) {
        const features = [
            new UseBurpProxy(config),
            new AddContainerHeader(config),
            new InjectToolBox(config),
            new RemoveSecurityHeaders(config),
        ]
        super(config, features)
    }

    async start() {
        if (!await super.start()) return false
        await Promise.all([
            browser.browserAction.setBadgeBackgroundColor({ color: "#008000" }),
            browser.browserAction.setBadgeText({ text: "ON" })
        ])
        return true
    }

    async stop() {
        const stopped = await super.stop()
        await browser.browserAction.setBadgeText({ text: "" })
        return stopped
    }
}
