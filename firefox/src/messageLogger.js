(() => {
    const STATE_KEY = "__pwnfoxMessageLogger"
    const STOP_MESSAGE = "pwnfox:stop-message-logger"

    if (globalThis[STATE_KEY]) return

    function forwardMessage({ data, origin }) {
        browser.runtime.sendMessage({
            type: "pwnfox:post-message",
            payload: { data, origin, destination: window.origin }
        }).catch(() => {})
    }

    function stop(message) {
        if (message !== STOP_MESSAGE) return
        window.removeEventListener("message", forwardMessage)
        browser.runtime.onMessage.removeListener(stop)
        delete globalThis[STATE_KEY]
    }

    globalThis[STATE_KEY] = true
    browser.runtime.onMessage.addListener(stop)
    window.addEventListener("message", forwardMessage)
})()
