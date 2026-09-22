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

function ConfigForm() {
  const [title, setTitle] = useState("");
  const [greetingPrefix, setGreetingPrefix] = useState("Hello");

  useEffect(() => {
    sdk.onPrefillConfiguration(({ title: prefillTitle, configuration }) => {
      if (prefillTitle) setTitle(prefillTitle);
      if (configuration.greetingPrefix) setGreetingPrefix(configuration.greetingPrefix as string);
    });
    sdk.onSave(() => {
      /* parent already has the latest via configurationChanged */
    });
    sdk.emit("ready", {});
  }, []);

  const emit = useCallback((newTitle: string, newPrefix: string) => {
    sdk.setConfiguration(newTitle.trim().length > 0, newTitle.trim(), {
      greetingPrefix: newPrefix.trim() || "Hello",
    });
  }, []);

  return (
    <div style={{ fontFamily: "IBM Plex Sans, sans-serif" }}>
      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>{sdk.t("config.title.label")}</label>
        <input
          type="text"
          value={title}
          placeholder={sdk.t("config.title.placeholder")}
          style={inputStyle}
          onChange={(e) => {
            setTitle(e.target.value);
            emit(e.target.value, greetingPrefix);
          }}
        />
      </div>
      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>{sdk.t("config.greetingPrefix.label")}</label>
        <input
          type="text"
          value={greetingPrefix}
          placeholder={sdk.t("config.greetingPrefix.placeholder")}
          style={inputStyle}
          onChange={(e) => {
            setGreetingPrefix(e.target.value);
            emit(title, e.target.value);
          }}
        />
        <p style={helpTextStyle}>{sdk.t("config.greetingPrefix.help")}</p>
      </div>
    </div>
  );
}

sdk.ready().then(() => {
  const root = createRoot(document.getElementById("root")!);
  root.render(<ConfigForm />);
});
