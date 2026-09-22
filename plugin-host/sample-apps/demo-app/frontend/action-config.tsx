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

import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ValtimoPluginSDK } from "@valtimo/plugin-sdk/frontend";

const sdk = new ValtimoPluginSDK();

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 16px",
  fontSize: "14px",
  border: "1px solid #8d8d8d",
  backgroundColor: "#f4f4f4",
  outline: "none",
  boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = { display: "block", marginBottom: "4px", fontSize: "12px", color: "#525252" };
const helpTextStyle: React.CSSProperties = { fontSize: "12px", color: "#6f6f6f", marginTop: "4px" };

function ActionConfigForm() {
  const [name, setName] = useState("");
  const [greetingVariable, setGreetingVariable] = useState("greeting");

  useEffect(() => {
    sdk.onPrefillConfiguration(({ configuration }) => {
      if (typeof configuration.name === "string") setName(configuration.name);
      if (typeof configuration.greetingVariable === "string") setGreetingVariable(configuration.greetingVariable);
    });
    sdk.onSave(() => {
      /* no-op */
    });
    sdk.emit("ready", {});
  }, []);

  // Action config carries no title (the empty string) — only the per-activity properties.
  const emit = useCallback((newName: string, newVar: string) => {
    sdk.setConfiguration(true, "", {
      name: newName.trim() || undefined,
      greetingVariable: newVar.trim() || "greeting",
    });
  }, []);

  return (
    <div style={{ fontFamily: "IBM Plex Sans, sans-serif" }}>
      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>{sdk.t("action.name.label")}</label>
        <input
          type="text"
          value={name}
          placeholder={sdk.t("action.name.placeholder")}
          style={inputStyle}
          onChange={(e) => {
            setName(e.target.value);
            emit(e.target.value, greetingVariable);
          }}
        />
        <p style={helpTextStyle}>{sdk.t("action.name.help")}</p>
      </div>
      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>{sdk.t("action.greetingVariable.label")}</label>
        <input
          type="text"
          value={greetingVariable}
          placeholder={sdk.t("action.greetingVariable.placeholder")}
          style={inputStyle}
          onChange={(e) => {
            setGreetingVariable(e.target.value);
            emit(name, e.target.value);
          }}
        />
        <p style={helpTextStyle}>{sdk.t("action.greetingVariable.help")}</p>
      </div>
    </div>
  );
}

sdk.ready().then(() => {
  const root = createRoot(document.getElementById("root")!);
  root.render(<ActionConfigForm />);
});
