const MAX_MESSAGE_ROWS = 250
const MAX_MESSAGE_LENGTH = 32_768
const MAX_PREVIEW_LENGTH = 500
const pendingMessages = []

let flushScheduled = false
let matchesFilter = () => true

function truncate(value) {
    if (value.length <= MAX_MESSAGE_LENGTH) return value
    const suffix = "… [truncated]"
    return `${value.slice(0, MAX_MESSAGE_LENGTH - suffix.length)}${suffix}`
}

function createCell(text) {
    const cell = document.createElement("span")
    cell.textContent = text
    return cell
}

function stripProtocol(value) {
    return value.replace(/^https?:\/\//, "")
}

function createDetailsContent(origin, destination, message) {
    const content = document.createElement("div")
    content.className = "message-details-content"
    content.append(
        createCell("Origin"),
        createCell(origin),
        createCell("Destination"),
        createCell(destination),
        createCell("Message"),
        createCell(message)
    )
    return content
}

function createRow({ origin, destination, data, time }) {
    const message = truncate(typeof data === "string" ? data : String(data))
    const preview = message.length > MAX_PREVIEW_LENGTH
        ? `${message.slice(0, MAX_PREVIEW_LENGTH)}…`
        : message
    const details = document.createElement("details")
    const summary = document.createElement("summary")

    details.messageValues = [origin, destination, message]
    details.hidden = !matchesFilter(details.messageValues)
    summary.className = "row"
    summary.append(
        createCell(""),
        createCell(stripProtocol(origin)),
        createCell(stripProtocol(destination)),
        createCell(preview),
        createCell(time)
    )
    details.appendChild(summary)
    return details
}

function flushMessages() {
    flushScheduled = false
    const container = document.getElementById("message-list")
    const fragment = document.createDocumentFragment()

    for (const message of pendingMessages.splice(0)) {
        fragment.appendChild(createRow(message))
    }
    container.appendChild(fragment)

    const excess = container.childElementCount - MAX_MESSAGE_ROWS
    for (let index = 0; index < excess; index += 1) {
        container.firstElementChild.remove()
    }
}

function handleMessages(messages) {
    const batch = Array.isArray(messages) ? messages : [messages]
    if (batch.length === 0) return

    const now = new Date()
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map(value => String(value).padStart(2, "0"))
        .join(":")
    const firstMessage = Math.max(0, batch.length - MAX_MESSAGE_ROWS)
    for (let index = firstMessage; index < batch.length; index += 1) {
        pendingMessages.push({ ...batch[index], time })
    }
    const excess = pendingMessages.length - MAX_MESSAGE_ROWS
    if (excess > 0) pendingMessages.splice(0, excess)
    if (flushScheduled) return

    flushScheduled = true
    requestAnimationFrame(flushMessages)
}

function updateFilter() {
    const input = document.getElementById("filter")
    const useRegex = document.getElementById("filter-regex").checked
    const query = input.value

    input.setCustomValidity("")
    if (!query) {
        matchesFilter = () => true
    } else if (useRegex) {
        try {
            const pattern = new RegExp(query, "i")
            matchesFilter = values => values.some(value => pattern.test(value))
        } catch {
            input.setCustomValidity("Invalid regular expression")
            matchesFilter = () => true
        }
    } else {
        const normalizedQuery = query.toLocaleLowerCase()
        matchesFilter = values => values.some(value => {
            return value.toLocaleLowerCase().includes(normalizedQuery)
        })
    }

    document.querySelectorAll("#message-list > details").forEach(row => {
        row.hidden = !matchesFilter(row.messageValues)
    })
}

function main() {
    const messageList = document.getElementById("message-list")
    const clearMessages = () => {
        pendingMessages.length = 0
        messageList.replaceChildren()
    }

    window.handleMessages = handleMessages
    window.clearMessages = clearMessages

    messageList.addEventListener("toggle", ({ target }) => {
        if (!target.open || target.childElementCount !== 1) return
        target.appendChild(createDetailsContent(...target.messageValues))
    }, true)

    document.getElementById("btn-clear").addEventListener("click", clearMessages)
    document.getElementById("btn-shrink").addEventListener("click", () => {
        document.querySelectorAll("details").forEach(element => element.open = false)
    })
    document.getElementById("btn-expand").addEventListener("click", () => {
        document.querySelectorAll("details").forEach(element => element.open = true)
    })
    document.getElementById("filter").addEventListener("input", updateFilter)
    document.getElementById("filter-regex").addEventListener("change", updateFilter)
}

window.addEventListener("DOMContentLoaded", main)
