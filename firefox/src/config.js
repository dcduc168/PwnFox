

const defaultConfig = {
    enabled: false,
    useBurpProxy: false,
    addContainerHeader: true,
    injectToolbox: false,
    logPostMessage: false,
    removeSecurityHeaders: false,
    // Reusable proxy catalog (id -> {title, host, port}).
    proxies: {
        default: { title: 'Burp', host: '127.0.0.1', port: '8080' },
    },
    // Per-context assignment (cookieStoreId -> proxy id). A context with no
    // entry (including firefox-private and any not-yet-assigned container)
    // is Direct.
    contextProxies: {
        'firefox-default': 'default',
    },
    activeToolbox: null,
    savedToolbox: {},
    devToolDual: false,
    activeMessageFunc: "noop",
    savedMessageFunc: {
        "noop": `/* 
* Available parameters: 
*   data: the message data
*   origin: the origin frame
*   destination: the destination frame
*
* return: 
*   new modified message to display
*/
    
return data
`}
}


/* Keep background and UI reads in memory instead of repeatedly crossing the
 * browser.storage API boundary. */
let cache = {}
let hydrated = false
let hydratePromise = null
const changeHandlers = new Map()

function hydrate() {
    if (hydrated) return Promise.resolve()
    if (!hydratePromise) {
        hydratePromise = browser.storage.local.get(null).then(all => {
            /* keep any optimistic set() writes made while hydration was in flight */
            cache = { ...all, ...cache }
            hydrated = true
        })
    }
    return hydratePromise
}

browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return
    for (const [name, { newValue }] of Object.entries(changes)) {
        cache[name] = newValue
        changeHandlers.get(name)?.forEach(handler => handler(newValue))
    }
})

const config = {
    async get(key) {
        await hydrate()
        return cache[key] ?? defaultConfig[key]
    },
    async set(key, value) {
        cache[key] = value
        return browser.storage.local.set({ [key]: value })
    },
    onChange(key, handler) {
        let handlers = changeHandlers.get(key)
        if (!handlers) {
            handlers = new Set()
            changeHandlers.set(key, handlers)
        }
        handlers.add(handler)
        return () => handlers.delete(handler)
    }
}
