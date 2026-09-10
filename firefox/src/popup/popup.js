

/* Containers Identity */
async function getOrCreateIdentity(color) {
    const name = `PwnFox-${color}`
    const icon = "fingerprint"
    const [identity] = await browser.contextualIdentities.query({ name })
    if (identity !== undefined) {
        return identity
    }
    return await browser.contextualIdentities.create({ name, color, icon })
}

async function createContainerTab(color) {
    const identity = await getOrCreateIdentity(color)
    const { cookieStoreId } = identity
    return browser.tabs.create({ cookieStoreId })
}

async function bindCheckboxToConfig(selector, config, configName) {
    const checkbox = document.querySelector(selector)
    checkbox.checked = await config.get(configName)
    checkbox.addEventListener("change", () => config.set(configName, checkbox.checked))
}



async function getContainerColors() {
    // Firefox >= 153 exposes the live color list instead of us hard-coding
    // it (bug 2044354 renamed turquoise -> cyan, toolbar -> gray, and added
    // violet), so extensions stay correct across future palette changes.
    // Fall back to the static list on any failure (API missing, rejected,
    // or an unexpected response shape) so the popup never ends up empty.
    try {
        const colors = await browser.contextualIdentities.getSupportedColors()
        const supportedColors = new Set(colors.map(({ color }) => color))
        const colorNames = FIREFOX_CONTAINER_COLOR_ORDER
            .filter(color => supportedColors.has(color))
        if (colorNames.length) return colorNames
    } catch (err) {
        console.warn("PwnFox: getSupportedColors() failed, using fallback color list", err)
    }
    return FIREFOX_CONTAINER_COLOR_ORDER
}

async function createContainerTabButtons() {
    const colors = await getContainerColors()
    const container = document.querySelector("#identities")
    const fragment = document.createDocumentFragment()
    colors.forEach(color => {
        const item = document.createElement("div")
        item.classList.add("identity-item")

        const swatch = document.createElement("button")
        swatch.type = "button"
        swatch.classList.add("identity", color)
        swatch.title = `New ${color} container tab`
        swatch.addEventListener("click", () => createContainerTab(color))

        const label = document.createElement("span")
        label.classList.add("identity-label")
        label.textContent = color

        item.append(swatch, label)
        fragment.appendChild(item)
    })
    container.replaceChildren(fragment)
}

function togglePwnfox(enabled) {
    document.getElementById("icon").classList.toggle("enabled", enabled)
    document.querySelector("main").classList.toggle("disabled", !enabled)
}

async function main() {

    await createContainerTabButtons()

    bindCheckboxToConfig("#option-enabled", config, "enabled")
    bindCheckboxToConfig("#option-useBurpProxy", config, "useBurpProxy")
    bindCheckboxToConfig("#option-addContainerHeader", config, "addContainerHeader")
    bindCheckboxToConfig("#option-removeSecurityHeaders", config, "removeSecurityHeaders")
    bindCheckboxToConfig("#option-logPostMessage", config, "logPostMessage")
    bindCheckboxToConfig("#option-injectToolbox", config, "injectToolbox")

    /* Hook settings link */
    document.querySelector("#settings").addEventListener("click", ev => {
        browser.runtime.openOptionsPage()
    })

    const select = document.getElementById("select-toolbox")
    const filenames = Object.keys(await config.get("savedToolbox"))
    const activeToolbox = await config.get("activeToolbox");
    const options = document.createDocumentFragment()
    for (const filename of filenames) {
        const option = document.createElement("option")
        option.value = filename
        option.selected = filename === activeToolbox
        option.textContent = filename
        options.appendChild(option)
    }
    select.replaceChildren(options)
    select.addEventListener("change", () => {
        config.set("activeToolbox", select.value)
    })
    config.onChange("enabled", togglePwnfox)
    togglePwnfox(await config.get("enabled"))
}

window.addEventListener("load", main)
