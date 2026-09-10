(() => {
    const MAX_BATCH_MESSAGES = 64
    const MAX_MESSAGE_ENTRIES = 256
    const MAX_MESSAGE_DEPTH = 6
    const MAX_MESSAGE_LENGTH = 32_768
    const STATE_KEY = "__pwnfoxMessageLogger"
    const STOP_MESSAGE = "pwnfox:stop-message-logger"

    if (globalThis[STATE_KEY]) return

    const pendingMessages = []
    let flushTimer = null

    function truncate(value) {
        if (value.length <= MAX_MESSAGE_LENGTH) return value
        const suffix = "… [truncated]"
        return `${value.slice(0, MAX_MESSAGE_LENGTH - suffix.length)}${suffix}`
    }

    function takeCharacters(value, state) {
        const length = Math.min(value.length, state.characters)
        state.characters -= length
        return length === value.length
            ? value
            : `${value.slice(0, Math.max(0, length - 1))}…`
    }

    function normalize(value, depth, state) {
        if (typeof value === "string") return takeCharacters(value, state)
        if (value === null || typeof value === "boolean" || typeof value === "number") {
            return value
        }
        if (typeof value === "bigint") return `${value}n`
        if (typeof value === "undefined") return "[undefined]"
        if (typeof value !== "object") return String(value)
        if (depth >= MAX_MESSAGE_DEPTH) return "[max depth]"
        if (state.seen.has(value)) return "[circular]"

        state.seen.add(value)
        if (Array.isArray(value)) {
            const normalized = []
            let index = 0
            for (; index < value.length && state.entries > 0; index += 1) {
                state.entries -= 1
                normalized.push(normalize(value[index], depth + 1, state))
            }
            if (index < value.length) {
                normalized.push(`[${value.length - index} more items]`)
            }
            return normalized
        }

        const normalized = Object.create(null)
        let truncated = false
        for (const key in value) {
            if (!Object.hasOwn(value, key)) continue
            if (state.entries === 0 || state.characters === 0) {
                truncated = true
                break
            }
            state.entries -= 1
            normalized[takeCharacters(key, state)] = normalize(value[key], depth + 1, state)
        }
        if (truncated) normalized["…"] = "[truncated]"
        return normalized
    }

    function serialize(value) {
        if (typeof value === "string") return truncate(value)
        try {
            const normalized = normalize(value, 0, {
                characters: MAX_MESSAGE_LENGTH,
                entries: MAX_MESSAGE_ENTRIES,
                seen: new WeakSet()
            })
            return truncate(JSON.stringify(normalized) ?? String(normalized))
        } catch {
            return "[unserializable]"
        }
    }

    function flushMessages() {
        flushTimer = null
        const payload = pendingMessages.splice(0)
        browser.runtime.sendMessage({
            type: "pwnfox:post-message",
            payload
        }).catch(() => {})
    }

    function forwardMessage({ data, origin }) {
        if (pendingMessages.length >= MAX_BATCH_MESSAGES) return
        pendingMessages.push({
            data: serialize(data),
            origin,
            destination: window.origin
        })
        if (flushTimer === null) flushTimer = setTimeout(flushMessages)
    }

    function stop(message) {
        if (message !== STOP_MESSAGE) return
        window.removeEventListener("message", forwardMessage)
        browser.runtime.onMessage.removeListener(stop)
        if (flushTimer !== null) clearTimeout(flushTimer)
        pendingMessages.length = 0
        delete globalThis[STATE_KEY]
    }

    globalThis[STATE_KEY] = true
    browser.runtime.onMessage.addListener(stop)
    window.addEventListener("message", forwardMessage)
})()
