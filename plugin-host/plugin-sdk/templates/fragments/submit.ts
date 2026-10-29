
// Task-form submission hook, reached from `frontend/task-form.tsx` via `sdk.submitTask()`. GZAC
// calls this synchronously before completing the task, so returning `{status: "error", fieldErrors}`
// rejects the submission and shows the errors on the form. The key matches the bundle's `key` and
// its `submitHandler: true` in manifest.json.
submit("__BUNDLE_KEY__", (input: SubmitInput) => {
  const comment = ((input.submission.comment as string | undefined) ?? "").trim();
  if (comment === "") {
    return {
      status: "error" as const,
      errorMessage: "A comment is required",
      fieldErrors: {comment: "Required"},
    };
  }

  log.info("Task form submitted", {submitKey: input.submitKey, taskId: input.taskId});

  return {
    status: "completed" as const,
    variables: {decision: input.submission.decision, comment},
  };
});
