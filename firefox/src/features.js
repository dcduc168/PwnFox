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
        super(config, 'useBurpProxy')
        this.routes = new Map()
        this.proxy = ({ cookieStoreId }) => this.routes.get(cookieStoreId) || DIRECT_PROXY
        config.onChange("proxies", () => this.started && this.refreshRoutes())
        config.onChange("contextProxies", () => this.started && this.refreshRoutes())
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


/* Cache the normalized highlight per container. RequestDetails already
 * includes cookieStoreId, so the hot path avoids a tabs.get() call entirely. */
const identityCache = new Map()

async function getHighlightColor(cookieStoreId) {
    if (identityCache.has(cookieStoreId)) return identityCache.get(cookieStoreId)
    let color
    try {
        const identity = await browser.contextualIdentities.get(cookieStoreId)
        color = identity.name.startsWith("PwnFox-")
            ? BURP_HIGHLIGHT_BY_FIREFOX_COLOR.get(identity.color)
            : undefined
    } catch {
        color = undefined
    }
    identityCache.set(cookieStoreId, color)
    return color
}

function forgetIdentity({ contextualIdentity }) {
    identityCache.delete(contextualIdentity.cookieStoreId)
}

async function colorHeaderHandler(e) {
    const { cookieStoreId } = e
    if (!cookieStoreId || cookieStoreId === "firefox-default") return

    const value = await getHighlightColor(cookieStoreId)
    if (value === undefined) return

    e.requestHeaders.push({ name: "X-PwnFox-Color", value })
    return { requestHeaders: e.requestHeaders }
}

class AddContainerHeader extends Feature {
    constructor(config) {
        super(config, 'addContainerHeader')
    }

    async start() {
        if (this.started || !await this.config.get("enabled")) return false

        browser.webRequest.onBeforeSendHeaders.addListener(colorHeaderHandler,
            { urls: ["<all_urls>"] },
            ["blocking", "requestHeaders"]
        );
        browser.contextualIdentities.onUpdated.addListener(forgetIdentity)
        browser.contextualIdentities.onRemoved.addListener(forgetIdentity)
        super.start()
        return true
    }

    stop() {
        if (!super.stop()) return false
        browser.webRequest.onBeforeSendHeaders.removeListener(colorHeaderHandler)
        browser.contextualIdentities.onUpdated.removeListener(forgetIdentity)
        browser.contextualIdentities.onRemoved.removeListener(forgetIdentity)
        identityCache.clear()
        return true
    }
}


/* Remove security Headers */
const REMOVED_RESPONSE_HEADERS = new Set([
    "content-security-policy",
    "x-content-type-options",
    "x-frame-options",
    "x-xss-protection"
])

function removeHeaders({ responseHeaders }) {
    let changed = false
    const filteredHeaders = responseHeaders.filter(({ name }) => {
        const remove = REMOVED_RESPONSE_HEADERS.has(name.toLowerCase())
        changed ||= remove
        return !remove
    })
    return changed ? { responseHeaders: filteredHeaders } : undefined
}


class RemoveSecurityHeaders extends Feature {
    constructor(config) {
        super(config, 'removeSecurityHeaders')
    }

    async start() {
        if (this.started || !await this.config.get("enabled")) return false

        browser.webRequest.onHeadersReceived.addListener(removeHeaders,
            { urls: ["<all_urls>"] },
            ["blocking", "responseHeaders"]
        );
        super.start()
        return true
    }

    stop() {
        if (!super.stop()) return false
        browser.webRequest.onHeadersReceived.removeListener(removeHeaders)
        return true
    }
}

/* Toolbox */

class InjectToolBox extends Feature {
    constructor(config) {
        super(config, "injectToolbox")
        this.script = null
        this.refreshPromise = Promise.resolve()
        config.onChange("activeToolbox", () => this.started && this.queueRefresh())
        config.onChange("savedToolbox", () => this.started && this.queueRefresh())
    }

    queueRefresh() {
        this.refreshPromise = this.refreshPromise.then(
            () => this.refresh(),
            () => this.refresh()
        )
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


class LogPostMessage extends Feature {
    constructor(config) {
        super(config, "logPostMessage")
        this.script = null
    }

    async start() {
        if (this.started || !await this.config.get("enabled")) return false
        super.start()
        try {
            const script = await browser.contentScripts.register({
                allFrames: true,
                matches: ["<all_urls>"],
                runAt: "document_start",
                js: [{ file: "src/messageLogger.js" }]
            })
            if (!this.started) {
                await script.unregister()
                return false
            }
            this.script = script
            return true
        } catch (error) {
            super.stop()
            throw error
        }
    }

    async stop() {
        if (!super.stop()) return false
        if (this.script) {
            await this.script.unregister()
            this.script = null
        }
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
        if (!super.stop()) return false
        await Promise.all(this.features.map(feature => feature.stop()))
        return true
    }
}


class BackgroundFeatures extends FeaturesGroup {
    constructor(config) {
        const features = [
            new UseBurpProxy(config),
            new AddContainerHeader(config),
            new InjectToolBox(config),
            new LogPostMessage(config),
            new RemoveSecurityHeaders(config),
        ]
        super(config, features)
    }

    async start() {
        if (!await super.start()) return false
        const imageData = await createIcon("#00ff00")
        await browser.browserAction.setIcon({ imageData })
        return true
    }

    async stop() {
        if (!await super.stop()) return false
        const imageData = await createIcon("#ff0000")
        await browser.browserAction.setIcon({ imageData })
        return true
    }
}
