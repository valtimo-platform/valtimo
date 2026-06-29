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

const pageStyle: React.CSSProperties = {
  fontFamily: "IBM Plex Sans, sans-serif",
  padding: "24px",
  maxWidth: "880px",
};

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
  marginBottom: "8px",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "4px 0",
  fontSize: "14px",
  color: "#393939",
  borderBottom: "1px solid #f4f4f4",
};

const mutedStyle: React.CSSProperties = {color: "#6f6f6f", fontSize: "14px"};
const errorStyle: React.CSSProperties = {color: "#da1e28", fontSize: "14px"};

interface OverviewData {
  message: string;
  configurationId: string | null;
  stats: Array<{label: string; value: string}>;
}

type LoadState<T> =
  | {state: "loading"}
  | {state: "error"; message: string}
  | {state: "ready"; data: T};

function useResizeEmitter(deps: unknown[]): void {
  useEffect(() => {
    const height = document.documentElement.scrollHeight;
    sdk.emit("resize", {height});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function OverviewPage() {
  const ctx = sdk.getContext() ?? {};
  const configurationId = (ctx.configurationId as string | undefined) ?? null;

  const [overview, setOverview] = useState<LoadState<OverviewData>>({state: "loading"});

  // Plugin-served data — fetched from the plugin's own `/overview` handle_request handler.
  useEffect(() => {
    sdk
      .getPluginData("/overview")
      .then((res) => {
        if (res.status >= 200 && res.status < 300) {
          setOverview({state: "ready", data: res.body as OverviewData});
        } else {
          setOverview({state: "error", message: sdk.t("page.error")});
        }
      })
      .catch((err) => setOverview({state: "error", message: String(err?.message ?? err)}));
  }, []);

  useResizeEmitter([overview]);

  return (
    <div style={pageStyle}>
      {/* Hello world — static text via the translation table. */}
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{sdk.t("page.overview.hello.title")}</div>
        <div style={mutedStyle}>{sdk.t("page.overview.hello")}</div>
      </div>

      {/* Page context — a page carries the plugin configuration id (no document). */}
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{sdk.t("page.overview.context.title")}</div>
        <div style={rowStyle}>
          <span>{sdk.t("page.overview.context.configuration")}</span>
          <span>{configurationId ?? "—"}</span>
        </div>
      </div>

      {/* Plugin-served overview stats. */}
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{sdk.t("page.overview.stats.title")}</div>
        {overview.state === "loading" && <div style={mutedStyle}>{sdk.t("page.loading")}</div>}
        {overview.state === "error" && <div style={errorStyle}>{overview.message}</div>}
        {overview.state === "ready" && (
          <div>
            <div style={{...mutedStyle, marginBottom: "8px"}}>{overview.data.message}</div>
            {overview.data.stats.map((item) => (
              <div style={rowStyle} key={item.label}>
                <span>{item.label}</span>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Wait for the SDK to fetch the manifest + receive init (context) before mounting.
sdk.ready().then(() => {
  sdk.emit("ready", {});
  const root = createRoot(document.getElementById("root")!);
  root.render(<OverviewPage />);
});
