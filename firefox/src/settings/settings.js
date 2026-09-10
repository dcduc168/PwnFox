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
    violet: "var(--violet-50)",
}

function containerLabel(identity) {
    return identity.name.replace(/^PwnFox-/, "")
}

function createContainerProxyRow(identity, defaults, saved) {
    const row = document.createElement("div")
    row.classList.add("container-proxy-row")
    row.dataset.cookieStoreId = identity.cookieStoreId

    const dot = document.createElement("span")
    dot.classList.add("container-dot")
    dot.style.background = CONTAINER_DOT_COLOR[identity.color] || "var(--grey-40)"

    const label = document.createElement("span")
    label.classList.add("container-proxy-label")
    label.textContent = containerLabel(identity)

    const host = document.createElement("input")
    host.type = "text"
    host.placeholder = defaults.host
    host.value = saved?.host || ""
    host.classList.add("container-proxy-host")

    const port = document.createElement("input")
    port.type = "number"
    port.placeholder = defaults.port
    port.value = saved?.port || ""
    port.classList.add("container-proxy-port")

    row.append(dot, label, host, port)
    return row
}

async function renderContainerProxies(defaults) {
    const container = document.getElementById("containerProxies")
    const identities = await browser.contextualIdentities.query({})
    const saved = await config.get("containerProxies")
    const pwnfoxIdentities = identities.filter(i => i.name.startsWith("PwnFox-"))

    if (!pwnfoxIdentities.length) {
        container.textContent = "No PwnFox containers yet -- create one from the popup first."
        return
    }
    pwnfoxIdentities.forEach(identity => {
        container.appendChild(createContainerProxyRow(identity, defaults, saved[identity.cookieStoreId]))
    })
}

function collectContainerProxies() {
    const rows = document.querySelectorAll("#containerProxies .container-proxy-row")
    const result = {}
    rows.forEach(row => {
        const host = row.querySelector(".container-proxy-host").value.trim()
        const port = row.querySelector(".container-proxy-port").value.trim()
        if (!host) return
        result[row.dataset.cookieStoreId] = { host, port }
    })
    return result
}

async function main() {
    const $ = i => document.getElementById(i)

    const configEl = [
        [$("burphost"), "burpProxyHost"],
        [$("burpport"), "burpProxyPort"],
    ]

    /* Config to form */
    configEl.forEach(([el, configName]) => {
        config.get(configName).then(v => el.value = v)
    })

    await renderContainerProxies({
        host: await config.get("burpProxyHost"),
        port: await config.get("burpProxyPort"),
    })

    /* Form to config */
    document.querySelector("form").addEventListener("submit", ev => {
        ev.preventDefault()
        configEl.forEach(([el, configName]) => {
            config.set(configName, el.value)
        })
        config.set("containerProxies", collectContainerProxies())
    });
    newFileSelection(config, "savedToolbox", "#savedToolbox", 'toolbox')
}

document.addEventListener("DOMContentLoaded", main)
