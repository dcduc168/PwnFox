const DEVTOOLS_PORT_PREFIX = "devtools-"
const LOGGER_STOP_MESSAGE = "pwnfox:stop-message-logger"
const POST_MESSAGE_TYPE = "pwnfox:post-message"

class DevToolsConnections {
    constructor() {
        this.ports = new Map()
    }

    connect(port) {
        if (!port.name.startsWith(DEVTOOLS_PORT_PREFIX)) return

        const tabId = Number(port.name.slice(DEVTOOLS_PORT_PREFIX.length))
        if (!Number.isInteger(tabId)) return

        const previousPort = this.ports.get(tabId)
        this.ports.set(tabId, port)
        previousPort?.disconnect()
        port.onMessage.addListener(message => {
            if (message === "inject") this.injectLogger(tabId)
        })
        port.onDisconnect.addListener(() => {
            if (this.ports.get(tabId) !== port) return
            this.ports.delete(tabId)
            this.stopLogger(tabId)
        })
        this.injectLogger(tabId)
    }

    async injectLogger(tabId) {
        try {
            await browser.tabs.executeScript(tabId, {
                allFrames: true,
                file: "/src/messageLogger.js",
                runAt: "document_start"
            })
        } catch {
            // Firefox internal pages do not allow content-script injection.
        }
    }

    async stopLogger(tabId) {
        try {
            await browser.tabs.sendMessage(tabId, LOGGER_STOP_MESSAGE)
        } catch {
            // The tab may have closed or navigated before cleanup.
        }
    }

    forward(message, sender) {
        if (message?.type !== POST_MESSAGE_TYPE || !sender.tab) return
        this.ports.get(sender.tab.id)?.postMessage(message.payload)
    }
}

const devToolsConnections = new DevToolsConnections()

browser.runtime.onConnect.addListener(port => devToolsConnections.connect(port))
browser.runtime.onMessage.addListener((message, sender) => {
    devToolsConnections.forward(message, sender)
})

async function main() {
    const features = new BackgroundFeatures(config)
    await features.maybeStart()
}

window.addEventListener("load", main)
