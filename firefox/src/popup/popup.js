

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



const LEGACY_COLORS = [
    "blue",
    "turquoise",
    "green",
    "yellow",
    "orange",
    "red",
    "pink",
    "purple"
]

async function getContainerColors() {
    // Firefox >= 153 exposes the live color list instead of us hard-coding
    // it (bug 2044354 renamed turquoise -> cyan, toolbar -> gray, and added
    // violet), so extensions stay correct across future palette changes.
    // Fall back to the static list on any failure (API missing, rejected,
    // or an unexpected response shape) so the popup never ends up empty.
    try {
        const colors = await browser.contextualIdentities.getSupportedColors()
        const colorNames = colors.map(({ color }) => color).filter(Boolean)
        if (colorNames.length) return colorNames
    } catch (err) {
        console.warn("PwnFox: getSupportedColors() failed, using legacy color list", err)
    }
    return LEGACY_COLORS
}

async function createContainerTabButtons() {
    const colors = await getContainerColors()
    const container = document.querySelector("#identities")
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
        container.appendChild(item)
    })
}

async function togglePwnfox(enabled) {
    const color = enabled ? "#00ff00" : "#ff0000"
    const [canvas] = await createIcon(color)
    const iconContainer = document.getElementById("icon")
    iconContainer.replaceChild(canvas, iconContainer.firstChild)

    const main = document.querySelector("main")
    if (!enabled) {
        main.classList.add('disabled')
    } else {
        main.classList.remove('disabled')
    }
}

async function main() {

    await createContainerTabButtons()

    bindCheckboxToConfig("#option-enabled", config, "enabled")
    bindCheckboxToConfig("#option-useBurpProxy", config, "useBurpProxy")
    bindCheckboxToConfig("#option-addContainerHeader", config, "addContainerHeader")
    bindCheckboxToConfig("#option-removeSecurityHeaders", config, "removeSecurityHeaders")
    bindCheckboxToConfig("#option-injectToolbox", config, "injectToolbox")

    /* Hook settings link */
    document.querySelector("#settings").addEventListener("click", ev => {
        browser.runtime.openOptionsPage()
    })

    const select = document.getElementById("select-toolbox")
    const filenames = Object.keys(await config.get("savedToolbox"))
    const activeToolbox = await config.get("activeToolbox");
    for (const filename of filenames) {
        const option = document.createElement("option")
        option.value = filename
        option.selected = filename === activeToolbox
        option.innerText = filename
        select.appendChild(option)
    }
    select.addEventListener("change", () => {
        config.set("activeToolbox", select.value)
    })
    config.onChange('enabled', togglePwnfox, true)
    togglePwnfox(await config.get("enabled"))
}

window.addEventListener("load", main)





