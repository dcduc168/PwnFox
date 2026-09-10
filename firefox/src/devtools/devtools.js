const title = "Messages"
const icon = "/icons/icon.svg"
const panelPath = "/src/devtools/panel/panel.html"
const portName = `devtools-${browser.devtools.inspectedWindow.tabId}`

browser.devtools.panels.create(title, icon, panelPath).then(panel => {
    let panelWindow = null
    let port = null

    function show(window) {
        panelWindow = window
        if (port) return

        port = browser.runtime.connect({ name: portName })
        port.onMessage.addListener(messages => panelWindow?.handleMessages(messages))
        port.onDisconnect.addListener(() => {
            port = null
        })
    }

    function hide() {
        panelWindow?.clearMessages()
        panelWindow = null
        port?.disconnect()
        port = null
    }

    browser.devtools.network.onNavigated.addListener(() => {
        port?.postMessage("inject")
    })
    panel.onShown.addListener(show)
    panel.onHidden.addListener(hide)
})
