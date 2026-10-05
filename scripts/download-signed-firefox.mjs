import { createHash, createHmac, randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

const AMO_API = "https://addons.mozilla.org/api/v5"
const POLL_INTERVAL_MS = 5_000
const TIMEOUT_MS = 15 * 60 * 1_000

const outputPath = process.argv[2]
const allowMissing = process.argv.includes("--allow-missing")
if (!outputPath) throw new Error("Usage: download-signed-firefox.mjs <output-path>")

const issuer = process.env.WEB_EXT_API_KEY
const secret = process.env.WEB_EXT_API_SECRET
if (!issuer || !secret) throw new Error("AMO API credentials are required")

const manifest = JSON.parse(await readFile("firefox/manifest.json", "utf8"))
const addonId = manifest.browser_specific_settings?.gecko?.id
const version = manifest.version
if (!addonId || !version) throw new Error("Firefox add-on ID and version are required")

function encode(value) {
    return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function createToken() {
    const issuedAt = Math.floor(Date.now() / 1_000)
    const unsignedToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
        exp: issuedAt + 60,
        iat: issuedAt,
        iss: issuer,
        jti: randomUUID()
    })}`
    const signature = createHmac("sha256", secret)
        .update(unsignedToken)
        .digest("base64url")
    return `${unsignedToken}.${signature}`
}

async function request(url) {
    return fetch(url, {
        headers: { Authorization: `JWT ${createToken()}` },
        redirect: "follow"
    })
}

const versionUrl = `${AMO_API}/addons/addon/${encodeURIComponent(addonId)}/versions/v${encodeURIComponent(version)}/`
const deadline = Date.now() + TIMEOUT_MS
let lastStatus

while (Date.now() < deadline) {
    const response = await request(versionUrl)
    if (response.status === 404 && allowMissing) {
        console.log(`Firefox extension ${version} does not exist on AMO yet`)
        process.exit(2)
    }
    if (!response.ok) {
        const detail = await response.text()
        throw new Error(`AMO version lookup failed (${response.status}): ${detail}`)
    }

    const release = await response.json()
    const file = release.file
    if (file?.status !== lastStatus) {
        lastStatus = file?.status
        console.log(`AMO Firefox extension ${version} status: ${lastStatus ?? "pending"}`)
    }

    if (file?.status === "public" && file.url) {
        const download = await request(file.url)
        if (!download.ok) {
            throw new Error(`AMO file download failed (${download.status})`)
        }

        const content = Buffer.from(await download.arrayBuffer())
        const actualHash = createHash("sha256").update(content).digest("hex")
        const expectedHash = file.hash?.match(/^sha256:([a-f\d]{64})$/i)?.[1]
        if (!expectedHash || actualHash !== expectedHash.toLowerCase()) {
            throw new Error("Downloaded XPI does not match the SHA-256 hash from AMO")
        }

        await mkdir(dirname(outputPath), { recursive: true })
        await writeFile(outputPath, content)
        console.log(`Downloaded Mozilla-signed Firefox extension ${version}`)
        process.exit(0)
    }

    if (file?.status === "disabled") {
        throw new Error(`AMO rejected or disabled Firefox extension ${version}`)
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
}

throw new Error(`Timed out waiting for Mozilla to sign Firefox extension ${version}`)
