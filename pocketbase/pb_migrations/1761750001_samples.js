/// <reference path="../pb_data/types.d.ts" />

// Kept samples, their speaker references and personal API keys.
// Audio and generation metadata are only written by the gateway (service account),
// so stored seeds, models and checkpoints can be trusted; users may only edit their own notes.

const SVC = '@request.auth.collectionName = "services"'
const OWNER = "owner = @request.auth.id"
const WAV = ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"]

// update rule that rejects any of the given fields in the request body
function onlyOwnerExcept(fields) {
  return [OWNER, ...fields.map((f) => `@request.body.${f}:isset = false`)].join(" && ")
}

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")

  const speakers = new Collection({
    type: "base",
    name: "speakers",
    listRule: `${OWNER} || ${SVC}`,
    viewRule: `${OWNER} || ${SVC}`,
    createRule: SVC,
    updateRule: onlyOwnerExcept(["owner", "audio", "sha256"]),
    deleteRule: OWNER,
    fields: [
      { type: "relation", name: "owner", collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true },
      { type: "text", name: "name", max: 200 },
      { type: "file", name: "audio", required: true, protected: true, maxSelect: 1, maxSize: 15 * 1024 * 1024, mimeTypes: WAV },
      { type: "text", name: "sha256", required: true, min: 64, max: 64, pattern: "^[0-9a-f]+$" },
      // the speaker agreed to the recording being used for voice cloning
      { type: "bool", name: "consent" },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_speakers_owner_sha256 ON speakers (owner, sha256)",
    ],
  })
  app.save(speakers)

  const samples = new Collection({
    type: "base",
    name: "samples",
    listRule: `${OWNER} || ${SVC}`,
    viewRule: `${OWNER} || ${SVC}`,
    createRule: SVC,
    updateRule: onlyOwnerExcept([
      "owner", "speaker", "audio", "text", "ref_text", "language", "model", "checkpoint",
      "seed", "duration_s", "job_id", "sample_index",
    ]),
    deleteRule: OWNER,
    fields: [
      { type: "relation", name: "owner", collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true },
      // deleting a speaker deletes the samples generated from it
      { type: "relation", name: "speaker", collectionId: speakers.id, required: true, maxSelect: 1, cascadeDelete: true },
      { type: "file", name: "audio", required: true, protected: true, maxSelect: 1, maxSize: 15 * 1024 * 1024, mimeTypes: WAV },
      { type: "text", name: "text", required: true, max: 5000 },
      { type: "text", name: "ref_text", max: 5000 },
      { type: "text", name: "language", required: true, max: 50 },
      { type: "text", name: "model", required: true, max: 100 },
      { type: "text", name: "checkpoint", max: 500 },
      { type: "number", name: "seed", onlyInt: true },
      { type: "number", name: "duration_s", min: 0 },
      { type: "text", name: "job_id", required: true, max: 64 },
      { type: "number", name: "sample_index", onlyInt: true, min: 0 },
      { type: "number", name: "rating", onlyInt: true, min: 1, max: 5 },
      { type: "json", name: "tags", maxSize: 10000 },
      { type: "text", name: "note", max: 5000 },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_samples_job_sample ON samples (job_id, sample_index)",
      "CREATE INDEX idx_samples_owner ON samples (owner)",
    ],
  })
  app.save(samples)

  const apiKeys = new Collection({
    type: "base",
    name: "api_keys",
    listRule: `${OWNER} || ${SVC}`,
    viewRule: `${OWNER} || ${SVC}`,
    createRule: `${OWNER} && @request.body.owner = @request.auth.id && @request.body.last_used_at:isset = false`,
    updateRule: `(${onlyOwnerExcept(["owner", "key_hash", "prefix", "last_used_at"])}) || ${SVC}`,
    deleteRule: OWNER,
    fields: [
      { type: "relation", name: "owner", collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true },
      { type: "text", name: "name", required: true, max: 200 },
      // first characters of the key, to tell keys apart in the UI
      { type: "text", name: "prefix", required: true, max: 20 },
      // SHA-256 of the full key; the key itself is never stored
      { type: "text", name: "key_hash", required: true, min: 64, max: 64, pattern: "^[0-9a-f]+$" },
      { type: "date", name: "expires_at" },
      { type: "bool", name: "revoked" },
      { type: "date", name: "last_used_at" },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_api_keys_key_hash ON api_keys (key_hash)",
    ],
  })
  app.save(apiKeys)
}, (app) => {
  for (const name of ["api_keys", "samples", "speakers"]) {
    app.delete(app.findCollectionByNameOrId(name))
  }
})
