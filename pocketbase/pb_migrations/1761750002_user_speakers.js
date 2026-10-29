/// <reference path="../pb_data/types.d.ts" />

// Users save their own speaker references (the UI does it when a job is submitted), and the
// consent flag is no longer needed.

const SVC = '@request.auth.collectionName = "services"'
const OLD_CREATE_RULE = SVC

migrate((app) => {
  const speakers = app.findCollectionByNameOrId("speakers")
  speakers.fields.removeByName("consent")
  // users may only create speakers for themselves
  speakers.createRule = `(@request.auth.collectionName = "users" && owner = @request.auth.id) || ${SVC}`
  app.save(speakers)
}, (app) => {
  const speakers = app.findCollectionByNameOrId("speakers")
  speakers.fields.add(new BoolField({ name: "consent" }))
  speakers.createRule = OLD_CREATE_RULE
  app.save(speakers)
})
