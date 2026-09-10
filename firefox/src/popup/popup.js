

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



function createContainerTabButtons() {
    const container = document.querySelector("#identities")
    const fragment = document.createDocumentFragment()
    FIREFOX_CONTAINER_COLOR_ORDER.forEach(color => {
        const item = document.createElement("div")
        item.classList.add("identity-item")

        const swatch = document.createElement("button")
        swatch.type = "button"
        swatch.classList.add("identity", color)
        swatch.dataset.color = color
        swatch.title = `New ${color} container tab`

        const label = document.createElement("span")
        label.classList.add("identity-label")
        label.textContent = color

        item.append(swatch, label)
        fragment.appendChild(item)
    })
    container.replaceChildren(fragment)
    container.addEventListener("click", ({ target }) => {
        const button = target.closest("button[data-color]")
        if (button) createContainerTab(button.dataset.color)
    })
}

function togglePwnfox(enabled) {
    document.getElementById("icon").classList.toggle("enabled", enabled)
    document.querySelector("main").classList.toggle("disabled", !enabled)
}

async function main() {
    createContainerTabButtons()

    await Promise.all([
        bindCheckboxToConfig("#option-enabled", config, "enabled"),
        bindCheckboxToConfig("#option-useBurpProxy", config, "useBurpProxy"),
        bindCheckboxToConfig("#option-addContainerHeader", config, "addContainerHeader"),
        bindCheckboxToConfig("#option-removeSecurityHeaders", config, "removeSecurityHeaders"),
        bindCheckboxToConfig("#option-injectToolbox", config, "injectToolbox")
    ])

    /* Hook settings link */
    document.querySelector("#settings").addEventListener("click", () => {
        browser.runtime.openOptionsPage()
    })

    const select = document.getElementById("select-toolbox")
    const filenames = Object.keys(await config.get("savedToolbox"))
    const activeToolbox = await config.get("activeToolbox")
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
