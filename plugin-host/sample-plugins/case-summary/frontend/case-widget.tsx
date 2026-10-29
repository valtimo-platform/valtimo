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

const titleRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "8px",
};

const titleStyle: React.CSSProperties = {fontSize: "14px", fontWeight: 600, color: "#161616"};
const mutedStyle: React.CSSProperties = {color: "#6f6f6f"};
const errorStyle: React.CSSProperties = {color: "#da1e28"};
const badgeStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6f6f6f",
  background: "#e0e0e0",
  borderRadius: "12px",
  padding: "2px 10px",
};
const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "4px 0",
  borderBottom: "1px solid #f4f4f4",
};

interface SummaryData {
  message: string;
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

function CaseWidget() {
  const ctx = sdk.getContext() ?? {};
  const documentId = (ctx.documentId as string | undefined) ?? null;

  const [pluginData, setPluginData] = useState<LoadState<SummaryData>>({state: "loading"});
  const [definition, setDefinition] = useState<LoadState<string>>({state: "loading"});

  // Plugin-served data (via the plugin's own handle_request handler over the /data route).
  useEffect(() => {
    sdk
      .getPluginData("/summary")
      .then((res) => {
        if (res.status >= 200 && res.status < 300) {
          setPluginData({state: "ready", data: res.body as SummaryData});
        } else {
          setPluginData({state: "error", message: sdk.t("caseWidget.error")});
        }
      })
      .catch((err) => setPluginData({state: "error", message: String(err?.message ?? err)}));
  }, []);

  // Valtimo case data, scoped to the logged-in user (GZAC via the downscoped user token).
  useEffect(() => {
    if (!documentId) {
      setDefinition({state: "error", message: sdk.t("caseWidget.error")});
      return;
    }
    sdk
      .callValtimo("GET", `/api/v1/document/${documentId}`)
      .then((res) => {
        if (res.status >= 200 && res.status < 300) {
          setDefinition({state: "ready", data: describeDefinition(res.body as Record<string, unknown>)});
        } else {
          setDefinition({state: "error", message: sdk.t("caseWidget.error")});
        }
      })
      .catch((err) => setDefinition({state: "error", message: String(err?.message ?? err)}));
  }, [documentId]);

  useResizeEmitter([pluginData, definition]);

  return (
    <div style={cardStyle}>
      <div style={titleRowStyle}>
        <span style={titleStyle}>{sdk.t("caseWidget.title")}</span>
        {pluginData.state === "ready" && (
          <span style={badgeStyle}>
            {sdk.t("caseWidget.viewCount")}: {pluginData.data.viewCount}
          </span>
        )}
      </div>

      <div style={{...mutedStyle, marginBottom: "8px"}}>{sdk.t("caseWidget.hello")}</div>

      {pluginData.state === "loading" && <div style={mutedStyle}>{sdk.t("caseWidget.loading")}</div>}
      {pluginData.state === "error" && <div style={errorStyle}>{pluginData.message}</div>}
      {pluginData.state === "ready" && <div style={rowStyle}>{pluginData.data.message}</div>}

      <div style={rowStyle}>
        <span>{sdk.t("caseWidget.definition")}</span>
        <span>
          {definition.state === "loading" && sdk.t("caseWidget.loading")}
          {definition.state === "error" && <span style={errorStyle}>{definition.message}</span>}
          {definition.state === "ready" && definition.data}
        </span>
      </div>
    </div>
  );
}

function describeDefinition(document: Record<string, unknown>): string {
  const definitionId = document.definitionId as
    | {name?: string; blueprintId?: {blueprintVersionTag?: string}}
    | undefined;
  if (!definitionId) return "(unknown)";
  const name = definitionId.name ?? "unknown";
  const version = definitionId.blueprintId?.blueprintVersionTag;
  return version ? `${name} v${version}` : name;
}

// Wait for the SDK to receive the manifest + init (context) before mounting, so sdk.t and
// sdk.getContext() are populated.
sdk.ready().then(() => {
  sdk.emit("ready", {});
  const root = createRoot(document.getElementById("root")!);
  root.render(<CaseWidget />);
});
