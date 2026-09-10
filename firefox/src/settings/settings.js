/* Mirrors the color -> token mapping in popup.css's .identity.<color> rules,
 * just for the small status dot next to each container row here. */
const CONTAINER_DOT_COLOR = {
    blue: "var(--blue-50)",
    turquoise: "var(--teal-50)",
    cyan: "var(--teal-50)",
    green: "var(--green-50)",
    yellow: "var(--yellow-50)",
    orange: "var(--orange-50)",
    red: "var(--red-50)",
    pink: "var(--magenta-50)",
    purple: "var(--purple-50)",
    gray: "var(--grey-50)",
}

const COLOR_RANK = new Map(FIREFOX_CONTAINER_COLOR_ORDER.map((color, index) => [color, index]))

const SPECIAL_CONTEXTS = [
    { cookieStoreId: "firefox-default", label: "Default" },
    { cookieStoreId: "firefox-private", label: "Private Browsing" },
]

function containerLabel(identity) {
    return identity.name.replace(/^PwnFox-/, "")
}

function generateProxyId() {
    return `proxy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/* Proxies */

function renderProxyList(proxies) {
    const list = document.getElementById("proxyList")
    const fragment = document.createDocumentFragment()
    Object.entries(proxies).forEach(([id, proxy]) => {
        const row = document.createElement("div")
        row.classList.add("proxy-row")

        const title = document.createElement("span")
        title.classList.add("proxy-title")
        title.textContent = proxy.title

        const target = document.createElement("span")
        target.classList.add("proxy-target")
        target.textContent = `${proxy.host}:${proxy.port}`

        const del = document.createElement("button")
        del.type = "button"
        del.textContent = "Delete"
        del.addEventListener("click", () => deleteProxy(id))

        row.append(title, target, del)
        fragment.appendChild(row)
    })
    list.replaceChildren(fragment)
}

async function addProxy(title, host, port) {
    const proxies = await config.get("proxies")
    proxies[generateProxyId()] = { title, host, port }
    await config.set("proxies", proxies)
}

async function deleteProxy(id) {
    const proxies = await config.get("proxies")
    delete proxies[id]
    await config.set("proxies", proxies)

    const contextProxies = await config.get("contextProxies")
    let changed = false
    for (const [cookieStoreId, proxyId] of Object.entries(contextProxies)) {
        if (proxyId !== id) continue
        delete contextProxies[cookieStoreId]
        changed = true
    }
    if (changed) await config.set("contextProxies", contextProxies)

    await refreshSettings()
}

/* Container proxy assignment */

async function renderContextAssignments(proxies) {
    const list = document.getElementById("contextAssignments")
    const fragment = document.createDocumentFragment()

    const identities = await browser.contextualIdentities.query({})
    const containerContexts = identities
        .filter(i => i.name.startsWith("PwnFox-") && BURP_HIGHLIGHT_BY_FIREFOX_COLOR.has(i.color))
        .sort((a, b) => {
            const aColor = a.color === "turquoise" ? "cyan" : a.color
            const bColor = b.color === "turquoise" ? "cyan" : b.color
            return (COLOR_RANK.get(aColor) ?? Infinity) - (COLOR_RANK.get(bColor) ?? Infinity)
        })
        .map(i => ({ cookieStoreId: i.cookieStoreId, label: containerLabel(i), color: i.color }))

    const contexts = [...SPECIAL_CONTEXTS, ...containerContexts]
    const assignments = await config.get("contextProxies")

    contexts.forEach(ctx => {
        const row = document.createElement("div")
        row.classList.add("context-row")

        if (ctx.color) {
            const dot = document.createElement("span")
            dot.classList.add("container-dot")
            dot.style.background = CONTAINER_DOT_COLOR[ctx.color] || "var(--grey-40)"
            row.appendChild(dot)
        } else {
            row.appendChild(document.createElement("span"))
        }

        const label = document.createElement("span")
        label.textContent = ctx.label
        row.appendChild(label)

        const select = document.createElement("select")
        const direct = document.createElement("option")
        direct.value = ""
        direct.textContent = "Direct"
        select.appendChild(direct)

        Object.entries(proxies).forEach(([id, proxy]) => {
            const opt = document.createElement("option")
            opt.value = id
            opt.textContent = proxy.title
            select.appendChild(opt)
        })

        select.value = assignments[ctx.cookieStoreId] || ""
        select.addEventListener("change", async () => {
            const current = await config.get("contextProxies")
            if (select.value) {
                current[ctx.cookieStoreId] = select.value
            } else {
                delete current[ctx.cookieStoreId]
            }
            await config.set("contextProxies", current)
        })

        row.appendChild(select)
        fragment.appendChild(row)
    })
    list.replaceChildren(fragment)
}

async function refreshSettings() {
    const proxies = await config.get("proxies")
    renderProxyList(proxies)
    await renderContextAssignments(proxies)
}

async function main() {
    document.getElementById("addProxy").addEventListener("click", async () => {
        const title = document.getElementById("newProxyTitle")
        const host = document.getElementById("newProxyHost")
        const port = document.getElementById("newProxyPort")
        if (!title.value.trim() || !host.value.trim() || !port.value.trim()) return

        await addProxy(title.value.trim(), host.value.trim(), port.value.trim())
        title.value = ""
        host.value = ""
        port.value = ""
        await refreshSettings()
    })

    await refreshSettings()
    newFileSelection(config, "savedToolbox", "#savedToolbox", 'toolbox')
}

document.addEventListener("DOMContentLoaded", main)
