const assert = require("node:assert/strict")
const fs = require("node:fs")
const test = require("node:test")
const vm = require("node:vm")

const colorsSource = fs.readFileSync("firefox/src/colors.js", "utf8")
const featuresSource = fs.readFileSync("firefox/src/features.js", "utf8")
const popupSource = fs.readFileSync("firefox/src/popup/popup.js", "utf8")

function createContext(overrides = {}) {
    const context = vm.createContext({ console, ...overrides })
    vm.runInContext(colorsSource, context)
    return context
}

test("current Firefox colors map one-to-one onto Burp highlights", () => {
    const context = createContext()
    vm.runInContext(
        "globalThis.mapping = Array.from(BURP_HIGHLIGHT_BY_FIREFOX_COLOR)",
        context
    )

    const mapping = new Map(context.mapping)
    const firefoxColors = [
        "blue",
        "cyan",
        "gray",
        "green",
        "orange",
        "pink",
        "purple",
        "red",
        "violet",
        "yellow"
    ]
    const mappedColors = firefoxColors.flatMap(color => {
        const highlight = mapping.get(color)
        return highlight === undefined ? [] : [highlight]
    })

    assert.equal(mapping.has("violet"), false)
    assert.deepEqual(mappedColors.sort(), [
        "blue",
        "cyan",
        "gray",
        "green",
        "magenta",
        "orange",
        "pink",
        "red",
        "yellow"
    ])
})

test("popup omits Firefox colors without a Burp equivalent", async () => {
    const context = createContext({
        browser: {
            contextualIdentities: {
                async getSupportedColors() {
                    return [
                        { color: "blue" },
                        { color: "violet" },
                        { color: "purple" },
                        { color: "gray" }
                    ]
                }
            }
        },
        window: { addEventListener() {} }
    })
    vm.runInContext(`${popupSource}\nglobalThis.result = getContainerColors()`, context)

    assert.deepEqual(Array.from(await context.result), ["blue", "purple", "gray"])
})

test("request headers use Burp names and ignore unsupported colors", async () => {
    let identityColor = "purple"
    const context = createContext({
        browser: {
            contextualIdentities: {
                async get() {
                    return { color: identityColor, name: `PwnFox-${identityColor}` }
                }
            },
            tabs: {
                async get() {
                    return { cookieStoreId: "firefox-container-1" }
                }
            }
        },
        window: {}
    })
    vm.runInContext(`${featuresSource}\nglobalThis.handler = colorHeaderHandler`, context)

    const purpleRequest = { requestHeaders: [], tabId: 1 }
    assert.deepEqual(
        JSON.parse(JSON.stringify(await context.handler(purpleRequest))),
        { requestHeaders: [{ name: "X-PwnFox-Color", value: "magenta" }] }
    )

    identityColor = "violet"
    vm.runInContext("identityCache.clear(); tabCookieStoreCache.clear()", context)
    const violetRequest = { requestHeaders: [], tabId: 1 }
    assert.deepEqual(
        JSON.parse(JSON.stringify(await context.handler(violetRequest))),
        { requestHeaders: [] }
    )
})
