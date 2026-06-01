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

function ConfigForm() {
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState("EUR");

  // On prefill (edit mode), populate form fields
  useEffect(() => {
    sdk.onPrefillConfiguration(({title: prefillTitle, configuration}) => {
      if (prefillTitle) setTitle(prefillTitle);
      if (configuration.currency) setCurrency(configuration.currency as string);
    });

    // On save trigger from parent, the parent reads the last emitted configurationChanged
    sdk.onSave(() => {
      // No-op: the parent already has the latest data via configurationChanged
    });

    // Signal to parent that the iframe is ready
    sdk.emit("ready", {});
  }, []);

  // Emit configuration changes whenever form values change
  const emitConfig = useCallback(
    (newTitle: string, newCurrency: string) => {
      const valid = newTitle.trim().length > 0;
      sdk.setConfiguration(valid, newTitle.trim(), {
        currency: newCurrency.trim() || "EUR",
      });
    },
    []
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    emitConfig(val, currency);
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCurrency(val);
    emitConfig(title, val);
  };

  return (
    <div style={{ fontFamily: "IBM Plex Sans, sans-serif", padding: "0" }}>
      <div style={{ marginBottom: "16px" }}>
        <label
          style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "#525252" }}
        >
          Configuration name
        </label>
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Enter a name for this configuration"
          style={{
            width: "100%",
            padding: "8px 16px",
            fontSize: "14px",
            border: "1px solid #8d8d8d",
            borderRadius: "0",
            backgroundColor: "#f4f4f4",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label
          style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "#525252" }}
        >
          Currency code
        </label>
        <input
          type="text"
          value={currency}
          onChange={handleCurrencyChange}
          placeholder="EUR"
          style={{
            width: "100%",
            padding: "8px 16px",
            fontSize: "14px",
            border: "1px solid #8d8d8d",
            borderRadius: "0",
            backgroundColor: "#f4f4f4",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <p style={{ fontSize: "12px", color: "#6f6f6f", marginTop: "4px" }}>
          Currency code used when formatting amounts (e.g. EUR, USD, GBP)
        </p>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<ConfigForm />);
