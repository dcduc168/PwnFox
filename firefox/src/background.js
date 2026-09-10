/* Communication from contentScript to devtools */

const Coms = new class {
    constructor() {
        this.ports = new Map()
    }

    connect(port) {
        this.ports.set(port.name, port)
        port.onDisconnect.addListener(() => {
            if (this.ports.get(port.name) === port) this.ports.delete(port.name)
        })
    }

    postMessage(name, message) {
        this.ports.get(name)?.postMessage(message)
    }
}

function handleMessage(message, sender) {
    if (sender.tab) Coms.postMessage(`devtools-${sender.tab.id}`, message)
}




/* */

async function main() {
    const features = new BackgroundFeatures(config)

    await features.maybeStart()

    browser.runtime.onConnect.addListener(port => Coms.connect(port))
    browser.runtime.onMessage.addListener(handleMessage);
}

window.addEventListener("load", main)
