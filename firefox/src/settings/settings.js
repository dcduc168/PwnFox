const CONTAINER_DOT_COLOR = Object.freeze({
    blue: "#0a84ff",
    cyan: "#00feff",
    gray: "#737373",
    green: "#30e60b",
    orange: "#ff9400",
    pink: "#ff1ad9",
    purple: "#9400ff",
    red: "#ff0039",
    toolbar: "#737373",
    turquoise: "#00feff",
    yellow: "#ffe900"
})

const COLOR_RANK = new Map(FIREFOX_CONTAINER_COLOR_ORDER.map((color, index) => [color, index]))
const SPECIAL_CONTEXTS = Object.freeze([
    { cookieStoreId: "firefox-default", label: "Default" },
    { cookieStoreId: "firefox-private", label: "Private Browsing" }
])

function containerLabel(identity) {
    return identity.name.replace(/^PwnFox-/, "")
}

function generateProxyId() {
    return `proxy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function renderProxyList(proxies) {
    const fragment = document.createDocumentFragment()
    for (const [id, proxy] of Object.entries(proxies)) {
        const row = document.createElement("div")
        row.className = "proxy-row"

        const title = document.createElement("span")
        title.className = "proxy-title"
        title.textContent = proxy.title

        const target = document.createElement("span")
        target.className = "proxy-target"
        target.textContent = `${proxy.host}:${proxy.port}`

        const remove = document.createElement("button")
        remove.className = "danger"
        remove.type = "button"
        remove.dataset.proxyId = id
        remove.textContent = "Delete"

        row.append(title, target, remove)
        fragment.appendChild(row)
    }
    document.getElementById("proxyList").replaceChildren(fragment)
}

async function addProxy(title, host, port) {
    const proxies = { ...await config.get("proxies") }
    proxies[generateProxyId()] = { title, host, port }
    await config.set("proxies", proxies)
}

async function deleteProxy(id) {
    const proxies = { ...await config.get("proxies") }
    delete proxies[id]

    const contextProxies = { ...await config.get("contextProxies") }
    let changed = false
    for (const [cookieStoreId, proxyId] of Object.entries(contextProxies)) {
        if (proxyId !== id) continue
        delete contextProxies[cookieStoreId]
        changed = true
    }
    await config.setMany(changed ? { proxies, contextProxies } : { proxies })
}

async function renderContextAssignments(proxies) {
    const [identities, assignments] = await Promise.all([
        browser.contextualIdentities.query({}),
        config.get("contextProxies")
    ])
    const containerContexts = identities
        .filter(identity => {
            return identity.name.startsWith("PwnFox-")
                && BURP_HIGHLIGHT_BY_FIREFOX_COLOR.has(identity.color)
        })
        .sort((a, b) => {
            const aColor = a.color === "turquoise" ? "cyan" : a.color
            const bColor = b.color === "turquoise" ? "cyan" : b.color
            return (COLOR_RANK.get(aColor) ?? Infinity) - (COLOR_RANK.get(bColor) ?? Infinity)
        })
        .map(identity => ({
            cookieStoreId: identity.cookieStoreId,
            label: containerLabel(identity),
            color: identity.color
        }))

    const fragment = document.createDocumentFragment()
    for (const context of [...SPECIAL_CONTEXTS, ...containerContexts]) {
        const row = document.createElement("div")
        row.className = "context-row"

        const dot = document.createElement("span")
        if (context.color) {
            dot.className = "container-dot"
            dot.style.backgroundColor = CONTAINER_DOT_COLOR[context.color]
        }

        const label = document.createElement("span")
        label.textContent = context.label

        const select = document.createElement("select")
        select.dataset.cookieStoreId = context.cookieStoreId
        select.appendChild(new Option("Direct", ""))
        for (const [id, proxy] of Object.entries(proxies)) {
            select.appendChild(new Option(proxy.title, id))
        }
        select.value = assignments[context.cookieStoreId] || ""

        row.append(dot, label, select)
        fragment.appendChild(row)
    }
    document.getElementById("contextAssignments").replaceChildren(fragment)
}

async function refreshSettings() {
    const proxies = await config.get("proxies")
    renderProxyList(proxies)
    await renderContextAssignments(proxies)
}

async function initFileSelection() {
    const root = document.getElementById("savedToolbox")
    const select = root.querySelector("select")
    const textarea = root.querySelector("textarea")
    const newButton = root.querySelector(".file-list-new")
    const renameButton = root.querySelector(".file-list-edit")
    const saveButton = root.querySelector(".file-list-save")
    const deleteButton = root.querySelector(".file-list-delete")
    const files = { ...await config.get("savedToolbox") }

    function uniqueName(name) {
        let candidate = name
        let suffix = 2
        while (candidate in files) {
            candidate = `${name} (${suffix})`
            suffix += 1
        }
        return candidate
    }

    function updateChangedState() {
        textarea.classList.toggle("changed", textarea.value !== (files[select.value] || ""))
    }

    function showSelected() {
        const hasSelection = Boolean(select.value)
        textarea.disabled = !hasSelection
        renameButton.disabled = !hasSelection
        saveButton.disabled = !hasSelection
        deleteButton.disabled = !hasSelection
        textarea.value = hasSelection ? files[select.value] : ""
        updateChangedState()
    }

    function renderOptions(selectedName) {
        const options = document.createDocumentFragment()
        for (const filename of Object.keys(files)) {
            options.appendChild(new Option(filename, filename))
        }
        select.replaceChildren(options)
        if (selectedName in files) select.value = selectedName
        showSelected()
    }

    async function persist(extraValues = {}) {
        await config.setMany({ savedToolbox: { ...files }, ...extraValues })
    }

    select.addEventListener("change", showSelected)
    textarea.addEventListener("input", updateChangedState)
    textarea.addEventListener("keydown", event => {
        if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return
        event.preventDefault()
        saveButton.click()
    })

    newButton.addEventListener("click", async () => {
        const requestedName = window.prompt("Script name", "toolbox")?.trim()
        if (!requestedName) return
        const filename = uniqueName(requestedName)
        files[filename] = ""
        await persist()
        renderOptions(filename)
    })

    renameButton.addEventListener("click", async () => {
        const oldName = select.value
        const requestedName = window.prompt("Rename script", oldName)?.trim()
        if (!requestedName || requestedName === oldName) return
        const newName = uniqueName(requestedName)
        files[newName] = files[oldName]
        delete files[oldName]
        const activeToolbox = await config.get("activeToolbox")
        await persist(activeToolbox === oldName ? { activeToolbox: newName } : {})
        renderOptions(newName)
    })

    saveButton.addEventListener("click", async () => {
        files[select.value] = textarea.value
        await persist()
        updateChangedState()
    })

    deleteButton.addEventListener("click", async () => {
        const deletedName = select.value
        delete files[deletedName]
        const activeToolbox = await config.get("activeToolbox")
        const nextName = Object.keys(files)[0] || null
        await persist(activeToolbox === deletedName ? { activeToolbox: nextName } : {})
        renderOptions("")
    })

    renderOptions("")
}

async function main() {
    document.getElementById("proxyForm").addEventListener("submit", async event => {
        event.preventDefault()
        const form = event.currentTarget
        const title = document.getElementById("newProxyTitle")
        const host = document.getElementById("newProxyHost")
        const port = document.getElementById("newProxyPort")
        if (!title.value.trim() || !host.value.trim() || !port.checkValidity() || !port.value) return

        await addProxy(title.value.trim(), host.value.trim(), Number(port.value))
        form.reset()
        await refreshSettings()
    })

    document.getElementById("proxyList").addEventListener("click", async ({ target }) => {
        const button = target.closest("button[data-proxy-id]")
        if (!button) return
        await deleteProxy(button.dataset.proxyId)
        await refreshSettings()
    })

    document.getElementById("contextAssignments").addEventListener("change", async ({ target }) => {
        if (!target.matches("select[data-cookie-store-id]")) return
        const assignments = { ...await config.get("contextProxies") }
        if (target.value) {
            assignments[target.dataset.cookieStoreId] = target.value
        } else {
            delete assignments[target.dataset.cookieStoreId]
        }
        await config.set("contextProxies", assignments)
    })

    await Promise.all([refreshSettings(), initFileSelection()])
}

document.addEventListener("DOMContentLoaded", main)
