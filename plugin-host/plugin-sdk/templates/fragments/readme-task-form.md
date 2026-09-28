
## The task form (`frontend/task-form.tsx`)

A form on a user task, wired onto it in the GZAC admin UI (form type "external plugin", key
`__BUNDLE_KEY__`). It is the only surface in this project where the plugin can **refuse** what a
user did.

The bundle declares `submitHandler: true`, so `sdk.submitTask(data)` does not complete the task
directly. GZAC calls the `submit("__BUNDLE_KEY__", …)` handler in `src/plugin.ts` first, passing the
raw form data. That handler decides:

- `{status: "completed", variables}` — GZAC completes the task with those process variables.
- `{status: "error", errorMessage, fieldErrors}` — GZAC does **not** complete the task; the messages
  come back to the form and render next to the offending fields, with the input still filled in.

The generated handler rejects an empty comment, so submitting a blank form is the quickest way to
see the whole round trip. The iframe holds no token and completes nothing itself.

A task form can also skip the hook entirely (a plain form, no `submitHandler`), or take over
submission completely. See the `case-summary` sample, which ships all three.
