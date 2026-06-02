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

import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { ValtimoPluginSDK } from "@valtimo/plugin-sdk/frontend";

const sdk = new ValtimoPluginSDK();

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 16px",
  fontSize: "14px",
  border: "1px solid #8d8d8d",
  borderRadius: "0",
  backgroundColor: "#f4f4f4",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "4px",
  fontSize: "12px",
  color: "#525252",
};

const helpTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6f6f6f",
  marginTop: "4px",
};

interface ActionConfig {
  titleField: string;
  amountField: string;
  summaryVariable: string;
  definitionKeyVariable: string;
}

function ActionConfigForm() {
  const [titleField, setTitleField] = useState("/applicantName");
  const [amountField, setAmountField] = useState("");
  const [summaryVariable, setSummaryVariable] = useState("caseSummary");
  const [definitionKeyVariable, setDefinitionKeyVariable] = useState("caseDefinitionKey");

  useEffect(() => {
    sdk.onPrefillConfiguration(({ configuration }) => {
      const config = configuration as unknown as ActionConfig;
      if (config.titleField) setTitleField(config.titleField);
      if (config.amountField) setAmountField(config.amountField);
      if (config.summaryVariable) setSummaryVariable(config.summaryVariable);
      if (config.definitionKeyVariable) setDefinitionKeyVariable(config.definitionKeyVariable);
    });

    sdk.onSave(() => {
      // No-op: the parent already has the latest data via configurationChanged
    });

    sdk.emit("ready", {});
  }, []);

  const emitConfig = useCallback(
    (newTitleField: string, newAmountField: string, newSummaryVar: string, newDefKeyVar: string) => {
      const valid = newTitleField.trim().length > 0;
      sdk.setConfiguration(valid, "", {
        titleField: newTitleField.trim(),
        amountField: newAmountField.trim() || undefined,
        summaryVariable: newSummaryVar.trim() || "caseSummary",
        definitionKeyVariable: newDefKeyVar.trim() || "caseDefinitionKey",
      } as unknown as Record<string, unknown>);
    },
    []
  );

  const handleChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    field: "titleField" | "amountField" | "summaryVariable" | "definitionKeyVariable"
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setter(val);
    const updated = { titleField, amountField, summaryVariable, definitionKeyVariable, [field]: val };
    emitConfig(updated.titleField, updated.amountField, updated.summaryVariable, updated.definitionKeyVariable);
  };

  return (
    <div style={{ fontFamily: "IBM Plex Sans, sans-serif", padding: "0" }}>
      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>Title field (JSON Pointer) *</label>
        <input
          type="text"
          value={titleField}
          onChange={handleChange(setTitleField, "titleField")}
          placeholder="/applicantName"
          style={inputStyle}
        />
        <p style={helpTextStyle}>
          JSON Pointer path to the title field in the case document (e.g. /applicantName)
        </p>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>Amount field (JSON Pointer)</label>
        <input
          type="text"
          value={amountField}
          onChange={handleChange(setAmountField, "amountField")}
          placeholder="/requestedAmount"
          style={inputStyle}
        />
        <p style={helpTextStyle}>
          Optional JSON Pointer path to the amount field in the case document
        </p>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>Summary variable name</label>
        <input
          type="text"
          value={summaryVariable}
          onChange={handleChange(setSummaryVariable, "summaryVariable")}
          placeholder="caseSummary"
          style={inputStyle}
        />
        <p style={helpTextStyle}>
          Process variable name for the generated summary (default: caseSummary)
        </p>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>Definition key variable name</label>
        <input
          type="text"
          value={definitionKeyVariable}
          onChange={handleChange(setDefinitionKeyVariable, "definitionKeyVariable")}
          placeholder="caseDefinitionKey"
          style={inputStyle}
        />
        <p style={helpTextStyle}>
          Process variable name for the case definition key (default: caseDefinitionKey)
        </p>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<ActionConfigForm />);
