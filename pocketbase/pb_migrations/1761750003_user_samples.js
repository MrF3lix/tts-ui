/// <reference path="../pb_data/types.d.ts" />

// Users keep generated samples themselves (the app copies them from the gateway), so they may
// create samples for themselves, linked to one of their own speakers or to none (when the job's
// reference wasn't saved as a speaker).

const SVC = '@request.auth.collectionName = "services"'

migrate((app) => {
  const samples = app.findCollectionByNameOrId("samples")
  samples.createRule = '(@request.auth.collectionName = "users" && owner = @request.auth.id'
    + ' && (speaker = "" || speaker.owner = @request.auth.id)) || ' + SVC
  samples.fields.getByName("speaker").required = false
  app.save(samples)
}, (app) => {
  const samples = app.findCollectionByNameOrId("samples")
  samples.createRule = SVC
  samples.fields.getByName("speaker").required = true
  app.save(samples)
})
