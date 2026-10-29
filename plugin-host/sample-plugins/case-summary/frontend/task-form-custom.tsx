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
  | {state: "error"; message: string};

/**
 * Level 2 — the escape hatch. The plugin drives the whole submission itself: on submit it POSTs to
 * its own backend (`/submit-task` via `sdk.postPluginData`), which completes the task in GZAC under
 * the downscoped user token (`gzacApi.asUser`). Only after the backend confirms does the bundle emit
 * `taskCompleted` so the Angular parent closes the task. This needs the task-complete endpoint
 * granted under `permissions.endpoints`. Prefer Level 0/1 — this remains for genuinely custom needs.
 */
function TaskForm() {
  const [decision, setDecision] = useState<Decision>("approve");
  const [comment, setComment] = useState("");
  const [submit, setSubmit] = useState<SubmitState>({state: "editing"});

  useEffect(() => {
    sdk.emit("resize", {height: document.documentElement.scrollHeight});
  }, [submit, comment, decision]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmit({state: "submitting"});
    try {
      const res = await sdk.postPluginData("/submit-task", {
        variables: {caseSummaryDecision: decision, caseSummaryComment: comment.trim()},
      });
      if (res.status >= 200 && res.status < 300) {
        setSubmit({state: "completed"});
        // The plugin completed the task itself — tell the parent to close + refresh.
        sdk.emit("taskCompleted", {});
      } else if (res.status === 403) {
        setSubmit({state: "error", message: sdk.t("taskForm.forbidden")});
      } else {
        setSubmit({state: "error", message: sdk.t("taskForm.error")});
      }
    } catch (err) {
      setSubmit({state: "error", message: String((err as Error)?.message ?? err)});
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
        <div style={panelTitleStyle}>{sdk.t("taskForm.custom.title")}</div>
        <div style={{...mutedStyle, marginBottom: "16px"}}>{sdk.t("taskForm.custom.intro")}</div>

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
        </div>

        <button type="submit" style={submitting ? buttonDisabledStyle : buttonStyle} disabled={submitting}>
          {submitting ? sdk.t("taskForm.submitting") : sdk.t("taskForm.custom.submit")}
        </button>

        {submit.state === "error" && <div style={errorStyle}>{submit.message}</div>}
      </div>
    </form>
  );
}

sdk.ready().then(() => {
  sdk.emit("ready", {});
  const root = createRoot(document.getElementById("root")!);
  root.render(<TaskForm />);
});
