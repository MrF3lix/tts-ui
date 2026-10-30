/// <reference path="../pb_data/types.d.ts" />

// Annotations of saved samples: error counts per category (keys in src/lib/annotations.ts) and a
// transcript in Dieth spelling. Owners can edit both, like notes.

migrate((app) => {
  const samples = app.findCollectionByNameOrId("samples")
  samples.fields.add(new JSONField({ name: "errors", maxSize: 10000 }))
  samples.fields.add(new TextField({ name: "dieth", max: 5000 }))
  app.save(samples)
}, (app) => {
  const samples = app.findCollectionByNameOrId("samples")
  samples.fields.removeByName("errors")
  samples.fields.removeByName("dieth")
  app.save(samples)
})
