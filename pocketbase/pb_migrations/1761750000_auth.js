/// <reference path="../pb_data/types.d.ts" />

// Users sign in to the UI; the gateway signs in as a "services" record to check tokens
// and store kept samples. Accounts are created by an admin, there is no public sign-up.

const SVC = '@request.auth.collectionName = "services"'

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")

  users.fields.add(new SelectField({
    name: "role",
    values: ["user", "admin"],
    maxSelect: 1,
  }))
  // overrides the gateway's default limit for this user
  users.fields.add(new NumberField({
    name: "max_samples_per_job",
    onlyInt: true,
    min: 1,
  }))

  users.listRule = `id = @request.auth.id || ${SVC}`
  users.viewRule = `id = @request.auth.id || ${SVC}`
  users.createRule = null
  users.updateRule = "id = @request.auth.id"
    + " && @request.body.role:isset = false"
    + " && @request.body.max_samples_per_job:isset = false"
  users.deleteRule = null
  app.save(users)

  // only superusers can see or change service accounts
  const services = new Collection({
    type: "auth",
    name: "services",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    passwordAuth: { enabled: true, identityFields: ["email"] },
    fields: [
      { type: "text", name: "name", max: 100 },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  })
  app.save(services)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("services"))

  const users = app.findCollectionByNameOrId("users")
  users.fields.removeByName("role")
  users.fields.removeByName("max_samples_per_job")
  users.listRule = "id = @request.auth.id"
  users.viewRule = "id = @request.auth.id"
  users.createRule = ""
  users.updateRule = "id = @request.auth.id"
  users.deleteRule = "id = @request.auth.id"
  app.save(users)
})
