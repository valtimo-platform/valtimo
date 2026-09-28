/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, {useEffect, useState} from "react";
import {createRoot} from "react-dom/client";
import {ValtimoPluginSDK} from "@valtimo/plugin-sdk/frontend";
import {
  buttonDisabledStyle,
  buttonStyle,
  Decision,
  errorStyle,
  fieldErrorStyle,
  labelStyle,
  mutedStyle,
  panelStyle,
  panelTitleStyle,
  radioLabelStyle,
  rootStyle,
  textareaStyle,
} from "./task-form-shared";

const sdk = new ValtimoPluginSDK();

type SubmitState =
  | {state: "editing"}
  | {state: "submitting"}
  | {state: "completed"}
  | {state: "error"; message?: string; fieldErrors: Record<string, string>};

/**
 * Level 1 — the plugin adds server-side validation/transformation via a `submit("review", …)` hook
 * (declared with `submitHandler: true` on the bundle). The form sends the **raw** input; GZAC calls
 * the hook, which validates (e.g. a rejection needs a reason), derives variables and returns them —
 * then GZAC completes the task. Rejections come back as `fieldErrors` and are rendered inline without
 * tearing down the form. The iframe still holds no token and completes nothing itself.
 */
function TaskForm() {
  const [decision, setDecision] = useState<Decision>("approve");
  const [comment, setComment] = useState("");
  const [submit, setSubmit] = useState<SubmitState>({state: "editing"});

  useEffect(() => {
    sdk.emit("resize", {height: document.documentElement.scrollHeight});
  }, [submit, comment, decision]);

  const fieldErrors = submit.state === "error" ? submit.fieldErrors : {};

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmit({state: "submitting"});
    try {
      // Raw, unprefixed data — the `submit` hook decides which variables/document fields to write.
      const result = await sdk.submitTask({decision, comment: comment.trim()});
      if (result.ok) {
        setSubmit({state: "completed"});
      } else {
        setSubmit({
          state: "error",
          message: result.errors?.[0],
          fieldErrors: result.fieldErrors ?? {},
        });
      }
    } catch (err) {
      setSubmit({state: "error", message: String((err as Error)?.message ?? err), fieldErrors: {}});
    }
  };

  if (submit.state === "completed") {
    return (
      <div style={rootStyle}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>{sdk.t("taskForm.completed.title")}</div>
          <div style={mutedStyle}>{sdk.t("taskForm.completed")}</div>
        </div>
      </div>
    );
  }

  const submitting = submit.state === "submitting";

  return (
    <form style={rootStyle} onSubmit={onSubmit}>
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{sdk.t("taskForm.review.title")}</div>
        <div style={{...mutedStyle, marginBottom: "16px"}}>{sdk.t("taskForm.review.intro")}</div>

        <div style={{marginBottom: "16px"}}>
          <span style={labelStyle}>{sdk.t("taskForm.decision.label")}</span>
          <label style={radioLabelStyle}>
            <input
              type="radio"
              name="decision"
              checked={decision === "approve"}
              onChange={() => setDecision("approve")}
              disabled={submitting}
            />{" "}
            {sdk.t("taskForm.decision.approve")}
          </label>
          <label style={radioLabelStyle}>
            <input
              type="radio"
              name="decision"
              checked={decision === "reject"}
              onChange={() => setDecision("reject")}
              disabled={submitting}
            />{" "}
            {sdk.t("taskForm.decision.reject")}
          </label>
          {fieldErrors["decision"] && <div style={fieldErrorStyle}>{fieldErrors["decision"]}</div>}
        </div>

        <div style={{marginBottom: "16px"}}>
          <label style={labelStyle} htmlFor="comment">
            {sdk.t("taskForm.comment.label")}
          </label>
          <textarea
            id="comment"
            style={textareaStyle}
            value={comment}
            placeholder={sdk.t("taskForm.comment.placeholder")}
            onChange={(e) => setComment(e.target.value)}
            disabled={submitting}
          />
          {fieldErrors["comment"] && <div style={fieldErrorStyle}>{fieldErrors["comment"]}</div>}
        </div>

        <button type="submit" style={submitting ? buttonDisabledStyle : buttonStyle} disabled={submitting}>
          {submitting ? sdk.t("taskForm.submitting") : sdk.t("taskForm.review.submit")}
        </button>

        {submit.state === "error" && submit.message && <div style={errorStyle}>{submit.message}</div>}
      </div>
    </form>
  );
}

sdk.ready().then(() => {
  sdk.emit("ready", {});
  const root = createRoot(document.getElementById("root")!);
  root.render(<TaskForm />);
});
