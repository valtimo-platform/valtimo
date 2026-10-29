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

const cardStyle: React.CSSProperties = {
  fontFamily: "IBM Plex Sans, sans-serif",
  padding: "16px",
  fontSize: "14px",
  color: "#393939",
};

const titleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#161616",
  marginBottom: "8px",
};
const mutedStyle: React.CSSProperties = {color: "#6f6f6f", marginBottom: "12px"};
const errorStyle: React.CSSProperties = {color: "#da1e28"};

const tilesStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px",
};
const tileStyle: React.CSSProperties = {
  background: "#f4f4f4",
  padding: "12px",
  borderRadius: "0",
};
const tileLabelStyle: React.CSSProperties = {fontSize: "12px", color: "#6f6f6f"};
const tileValueStyle: React.CSSProperties = {fontSize: "20px", fontWeight: 600, color: "#161616"};

interface SummaryData {
  currency: string;
  viewCount: number;
}

type LoadState<T> =
  | {state: "loading"}
  | {state: "error"; message: string}
  | {state: "ready"; data: T};

/** The Angular parent has no host-side resize handling for widgets; still emit so future surfaces can use it. */
function useResizeEmitter(deps: unknown[]): void {
  useEffect(() => {
    sdk.emit("resize", {height: document.documentElement.scrollHeight});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function shortId(documentId: string | null): string {
  if (!documentId) return "—";
  return documentId.length > 8 ? `${documentId.slice(0, 8)}…` : documentId;
}

function CaseMetricsWidget() {
  const ctx = sdk.getContext() ?? {};
  const documentId = (ctx.documentId as string | undefined) ?? null;

  const [pluginData, setPluginData] = useState<LoadState<SummaryData>>({state: "loading"});

  useEffect(() => {
    sdk
      .getPluginData("/summary")
      .then((res) => {
        if (res.status >= 200 && res.status < 300) {
          setPluginData({state: "ready", data: res.body as SummaryData});
        } else {
          setPluginData({state: "error", message: sdk.t("caseMetricsWidget.error")});
        }
      })
      .catch((err) => setPluginData({state: "error", message: String(err?.message ?? err)}));
  }, []);

  useResizeEmitter([pluginData]);

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>{sdk.t("caseMetricsWidget.title")}</div>
      <div style={mutedStyle}>{sdk.t("caseMetricsWidget.hello")}</div>

      {pluginData.state === "loading" && <div style={mutedStyle}>{sdk.t("caseMetricsWidget.loading")}</div>}
      {pluginData.state === "error" && <div style={errorStyle}>{pluginData.message}</div>}
      {pluginData.state === "ready" && (
        <div style={tilesStyle}>
          <div style={tileStyle}>
            <div style={tileLabelStyle}>{sdk.t("caseMetricsWidget.viewCount")}</div>
            <div style={tileValueStyle}>{pluginData.data.viewCount}</div>
          </div>
          <div style={tileStyle}>
            <div style={tileLabelStyle}>{sdk.t("caseMetricsWidget.currency")}</div>
            <div style={tileValueStyle}>{pluginData.data.currency}</div>
          </div>
          <div style={tileStyle}>
            <div style={tileLabelStyle}>{sdk.t("caseMetricsWidget.documentId")}</div>
            <div style={tileValueStyle}>{shortId(documentId)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wait for the SDK to receive the manifest + init (context) before mounting, so sdk.t and
// sdk.getContext() are populated.
sdk.ready().then(() => {
  sdk.emit("ready", {});
  const root = createRoot(document.getElementById("root")!);
  root.render(<CaseMetricsWidget />);
});
