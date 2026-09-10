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
 * Level 0 — a pure task form with **no plugin backend code at all**. It collects the input and calls
 * `sdk.submitTask(data)` with value-resolver-prefixed keys (`pv:…` → process variable, `doc:/…` →
 * case document field). The Angular parent submits to GZAC, which resolves the values and completes
 * the task the standard way. No `request()` handler, no `permissions.endpoints`, no user token.
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
      const result = await sdk.submitTask({
        // Value-resolver prefixes GZAC already understands — no backend code needed to route these.
        "pv:caseApproved": decision === "approve",
        "doc:/reviewComment": comment.trim(),
      });
      if (result.ok) {
        setSubmit({state: "completed"});
      } else {
        setSubmit({state: "error", message: result.errors?.[0] ?? sdk.t("taskForm.error")});
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
        <div style={panelTitleStyle}>{sdk.t("taskForm.approve.title")}</div>
        <div style={{...mutedStyle, marginBottom: "16px"}}>{sdk.t("taskForm.approve.intro")}</div>

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
          {submitting ? sdk.t("taskForm.submitting") : sdk.t("taskForm.approve.submit")}
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
