// Creates a user (or the gateway's service account) with a generated password.
//
//   npm run create-account -- user alice@example.org "Alice Example" [--admin]
//   npm run create-account -- service gateway@tts.local "TTS gateway"
//
// Needs PB_URL, PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD (e.g. in .env.local).
import { randomBytes } from "node:crypto"
import PocketBase from "pocketbase"

const [kind, email, name = "", ...flags] = process.argv.slice(2)
if (!["user", "service"].includes(kind) || !email) {
  console.error('usage: create-account.mjs user|service <email> ["name"] [--admin]')
  process.exit(1)
}

const pb = new PocketBase(process.env.PB_URL ?? "http://127.0.0.1:8090")
await pb.collection("_superusers").authWithPassword(process.env.PB_SUPERUSER_EMAIL, process.env.PB_SUPERUSER_PASSWORD)

const password = randomBytes(18).toString("base64url")
const data = { email, name, password, passwordConfirm: password }
if (kind === "user") {
  Object.assign(data, { role: flags.includes("--admin") ? "admin" : "user", verified: true })
}
const record = await pb.collection(kind === "user" ? "users" : "services").create(data)

console.log(`Created ${kind} ${record.email} (${record.id})`)
console.log(`Password: ${password}`)
