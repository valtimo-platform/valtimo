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

const sdk = new ValtimoPluginSDK();

const panelStyle: React.CSSProperties = {
  border: "1px solid #e0e0e0",
  padding: "16px",
  marginBottom: "16px",
  background: "#ffffff",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#161616",
  marginBottom: "4px",
};

const mutedStyle: React.CSSProperties = {color: "#6f6f6f", fontSize: "14px"};
const errorStyle: React.CSSProperties = {color: "#da1e28", fontSize: "14px", marginTop: "8px"};
const labelStyle: React.CSSProperties = {display: "block", marginBottom: "4px", fontSize: "12px", color: "#525252"};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 16px",
  fontSize: "14px",
  border: "1px solid #8d8d8d",
  backgroundColor: "#f4f4f4",
  outline: "none",
  boxSizing: "border-box",
  minHeight: "80px",
  resize: "vertical",
  fontFamily: "IBM Plex Sans, sans-serif",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 24px",
  fontSize: "14px",
  border: "none",
  background: "#0f62fe",
  color: "#ffffff",
  cursor: "pointer",
};

const buttonDisabledStyle: React.CSSProperties = {...buttonStyle, background: "#8d8d8d", cursor: "not-allowed"};

type Decision = "approve" | "reject";

type SubmitState =
  | {state: "editing"}
  | {state: "submitting"}
  | {state: "completed"}
  | {state: "error"; message: string};

/**
 * A plugin-provided user-task form. The plugin owns the form UI *and* the submission: on submit it
 * hands the collected variables to its own backend (`/submit-task` via `sdk.postPluginData`), which
 * completes the task in GZAC under the downscoped user token (`gzacApi.asUser`). Once the backend
 * confirms completion, the bundle emits `taskCompleted` so the Angular parent closes the task and
 * refreshes the list — the whole task completion flows *through the plugin*.
 */
function TaskForm() {
  const [decision, setDecision] = useState<Decision>("approve");
  const [comment, setComment] = useState("");
  const [submit, setSubmit] = useState<SubmitState>({state: "editing"});

  useEffect(() => {
    // The Angular parent auto-resizes the iframe from this message.
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
        // Signal the parent that the plugin has completed the task; it closes + refreshes the list.
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
      <div style={{fontFamily: "IBM Plex Sans, sans-serif"}}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>{sdk.t("taskForm.completed.title")}</div>
          <div style={mutedStyle}>{sdk.t("taskForm.completed")}</div>
        </div>
      </div>
    );
  }

  const submitting = submit.state === "submitting";

  return (
    <form style={{fontFamily: "IBM Plex Sans, sans-serif"}} onSubmit={onSubmit}>
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{sdk.t("taskForm.title")}</div>
        <div style={{...mutedStyle, marginBottom: "16px"}}>{sdk.t("taskForm.intro")}</div>

        <div style={{marginBottom: "16px"}}>
          <span style={labelStyle}>{sdk.t("taskForm.decision.label")}</span>
          <label style={{display: "block", fontSize: "14px", color: "#393939", marginBottom: "4px"}}>
            <input
              type="radio"
              name="decision"
              checked={decision === "approve"}
              onChange={() => setDecision("approve")}
              disabled={submitting}
            />{" "}
            {sdk.t("taskForm.decision.approve")}
          </label>
          <label style={{display: "block", fontSize: "14px", color: "#393939"}}>
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
          {submitting ? sdk.t("taskForm.submitting") : sdk.t("taskForm.submit")}
        </button>

        {submit.state === "error" && <div style={errorStyle}>{submit.message}</div>}
      </div>
    </form>
  );
}

// Wait for the SDK to fetch the manifest + receive init (context) before mounting, so `sdk.t(key)`
// and `sdk.getContext()` are populated.
sdk.ready().then(() => {
  sdk.emit("ready", {});
  const root = createRoot(document.getElementById("root")!);
  root.render(<TaskForm />);
});
