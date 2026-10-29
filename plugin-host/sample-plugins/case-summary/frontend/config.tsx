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

// Prefilled so a fresh configuration already has a working destination — and so the permissions
// step has a derived egress entry to show without the admin having to think one up. The property is
// marked `x-egress-target` in the manifest, so whatever ends up here is what the plugin may reach.
const DEFAULT_EXTERNAL_API_URL = "https://dummyjson.com/todos/1";

function ConfigForm() {
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [externalApiUrl, setExternalApiUrl] = useState(DEFAULT_EXTERNAL_API_URL);

  useEffect(() => {
    sdk.onPrefillConfiguration(({ title: prefillTitle, configuration }) => {
      if (prefillTitle) setTitle(prefillTitle);
      if (configuration.currency) setCurrency(configuration.currency as string);
      if (configuration.externalApiUrl) setExternalApiUrl(configuration.externalApiUrl as string);
    });

    sdk.onSave(() => {
      // No-op: parent already has the latest data via configurationChanged
    });

    sdk.emit("ready", {});
  }, []);

  const emitConfig = useCallback((newTitle: string, newCurrency: string, newUrl: string) => {
    const valid = newTitle.trim().length > 0;
    sdk.setConfiguration(valid, newTitle.trim(), {
      currency: newCurrency.trim() || "EUR",
      externalApiUrl: newUrl.trim() || DEFAULT_EXTERNAL_API_URL,
    });
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    emitConfig(val, currency, externalApiUrl);
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCurrency(val);
    emitConfig(title, val, externalApiUrl);
  };

  const handleExternalApiUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setExternalApiUrl(val);
    emitConfig(title, currency, val);
  };

  return (
    <div style={{ fontFamily: "IBM Plex Sans, sans-serif", padding: "0" }}>
      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>{sdk.t("config.title.label")}</label>
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder={sdk.t("config.title.placeholder")}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>{sdk.t("config.currency.label")}</label>
        <input
          type="text"
          value={currency}
          onChange={handleCurrencyChange}
          placeholder={sdk.t("config.currency.placeholder")}
          style={inputStyle}
        />
        <p style={helpTextStyle}>{sdk.t("config.currency.help")}</p>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>{sdk.t("config.externalApiUrl.label")}</label>
        <input
          type="url"
          value={externalApiUrl}
          onChange={handleExternalApiUrlChange}
          placeholder={sdk.t("config.externalApiUrl.placeholder")}
          style={inputStyle}
        />
        <p style={helpTextStyle}>{sdk.t("config.externalApiUrl.help")}</p>
      </div>
    </div>
  );
}

// Wait for the SDK to fetch the manifest before mounting; until then `sdk.t(key)` returns the
// raw key, which flashes on screen. Bootstrap once translations are available.
sdk.ready().then(() => {
  const root = createRoot(document.getElementById("root")!);
  root.render(<ConfigForm />);
});
