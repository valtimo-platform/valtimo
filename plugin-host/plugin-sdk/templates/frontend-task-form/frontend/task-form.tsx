import React, {useEffect, useState} from "react";
import {createRoot} from "react-dom/client";
import {ValtimoPluginSDK} from "@valtimo/plugin-sdk/frontend";

const sdk = new ValtimoPluginSDK();

type SubmitState =
  | {state: "editing"}
  | {state: "submitting"}
  | {state: "completed"}
  | {state: "error"; message?: string; fieldErrors: Record<string, string>};

/**
 * A form on a user task, and the one surface where this plugin can **refuse** what a user did.
 *
 * The bundle declares `submitHandler: true`, so `sdk.submitTask()` does not complete the task
 * directly: GZAC calls the plugin's `submit("__BUNDLE_KEY__", …)` handler in `src/plugin.ts` first.
 * That handler returning `{status: "error", fieldErrors}` comes back here as `result.fieldErrors`
 * and is rendered next to the offending field, with the form still filled in. The iframe holds no
 * token and completes nothing itself.
 */
function TaskForm() {
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [comment, setComment] = useState("");
  const [submit, setSubmit] = useState<SubmitState>({state: "editing"});

  // The Valtimo parent sizes the iframe from this message, so re-emit whenever the content changes.
  useEffect(() => {
    sdk.emit("resize", {height: document.documentElement.scrollHeight});
  }, [submit, comment, decision]);

  const fieldErrors = submit.state === "error" ? submit.fieldErrors : {};
  const submitting = submit.state === "submitting";

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmit({state: "submitting"});
    try {
      // Raw, unprefixed data — the submit() hook decides which process variables to write.
      const result = await sdk.submitTask({decision, comment: comment.trim()});
      setSubmit(
        result.ok
          ? {state: "completed"}
          : {state: "error", message: result.errors?.[0], fieldErrors: result.fieldErrors ?? {}}
      );
    } catch (err) {
      setSubmit({state: "error", message: String((err as Error)?.message ?? err), fieldErrors: {}});
    }
  };

  if (submit.state === "completed") {
    return <p style={{fontFamily: "IBM Plex Sans, sans-serif"}}>{sdk.t("taskForm.completed")}</p>;
  }

  return (
    <form style={{fontFamily: "IBM Plex Sans, sans-serif"}} onSubmit={onSubmit}>
      <h3>{sdk.t("taskForm.title")}</h3>

      <label htmlFor="decision">{sdk.t("taskForm.decision.label")}</label>
      <select
        id="decision"
        value={decision}
        onChange={(e) => setDecision(e.target.value as "approve" | "reject")}
        disabled={submitting}
      >
        <option value="approve">{sdk.t("taskForm.decision.approve")}</option>
        <option value="reject">{sdk.t("taskForm.decision.reject")}</option>
      </select>

      <label htmlFor="comment">{sdk.t("taskForm.comment.label")}</label>
      <textarea
        id="comment"
        value={comment}
        placeholder={sdk.t("taskForm.comment.placeholder")}
        onChange={(e) => setComment(e.target.value)}
        disabled={submitting}
      />
      {/* Written by the submit() hook when it rejects the submission. */}
      {fieldErrors.comment && <p>{fieldErrors.comment}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? sdk.t("taskForm.submitting") : sdk.t("taskForm.submit")}
      </button>

      {submit.state === "error" && submit.message && <p>{submit.message}</p>}
    </form>
  );
}

// Mount only once translations and the parent's context have arrived — until then sdk.t() returns
// the raw key and sdk.getContext() is empty.
sdk.ready().then(() => {
  sdk.emit("ready", {});
  createRoot(document.getElementById("root")!).render(<TaskForm />);
});
