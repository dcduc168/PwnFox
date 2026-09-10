(() => {
    let globallyEnabled = true
    let loggingEnabled = true
    let listening = false

    function forwardMessage({ data, origin }) {
        browser.runtime.sendMessage({
            data,
            origin,
            destination: window.origin
        })
    }

    function syncListener() {
        const shouldListen = globallyEnabled && loggingEnabled
        if (shouldListen === listening) return

        const method = shouldListen ? "addEventListener" : "removeEventListener"
        window[method]("message", forwardMessage)
        listening = shouldListen
    }

    browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local") return
        if (changes.enabled) globallyEnabled = changes.enabled.newValue
        if (changes.logPostMessage) loggingEnabled = changes.logPostMessage.newValue
        syncListener()
    })

    syncListener()
})()
