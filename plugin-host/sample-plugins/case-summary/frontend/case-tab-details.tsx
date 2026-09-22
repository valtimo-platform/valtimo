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
  borderRadius: "0",
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
  gap: "16px",
  padding: "4px 0",
  fontSize: "14px",
  color: "#393939",
  borderBottom: "1px solid #f4f4f4",
};

const keyStyle: React.CSSProperties = { color: "#6f6f6f" };
const mutedStyle: React.CSSProperties = { color: "#6f6f6f", fontSize: "14px" };
const errorStyle: React.CSSProperties = { color: "#da1e28", fontSize: "14px" };

interface DocumentResponse {
  id?: string;
  createdBy?: string;
  createdOn?: string;
  content?: Record<string, unknown>;
  definitionId?: { name?: string; blueprintId?: { blueprintVersionTag?: string } };
}

type LoadState<T> =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; data: T };

function useResizeEmitter(deps: unknown[]): void {
  useEffect(() => {
    sdk.emit("resize", { height: document.documentElement.scrollHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function flatten(content: Record<string, unknown>, prefix = ""): Array<{ key: string; value: string }> {
  const rows: Array<{ key: string; value: string }> = [];
  for (const [key, value] of Object.entries(content)) {
    const label = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      rows.push(...flatten(value as Record<string, unknown>, label));
    } else {
      rows.push({ key: label, value: Array.isArray(value) ? JSON.stringify(value) : String(value) });
    }
  }
  return rows;
}

function CaseDetailsTab() {
  const ctx = sdk.getContext() ?? {};
  const documentId = (ctx.documentId as string | undefined) ?? null;

  const [document_, setDocument] = useState<LoadState<DocumentResponse>>({ state: "loading" });

  useEffect(() => {
    if (!documentId) {
      setDocument({ state: "error", message: sdk.t("caseTab.valtimo.noDocument") });
      return;
    }
    sdk
      .callValtimo("GET", `/api/v1/document/${documentId}`)
      .then((res) => {
        if (res.status >= 200 && res.status < 300) {
          setDocument({ state: "ready", data: res.body as DocumentResponse });
        } else if (res.status === 403) {
          setDocument({ state: "error", message: sdk.t("caseTab.valtimo.forbidden") });
        } else {
          setDocument({ state: "error", message: sdk.t("caseTab.valtimo.error") });
        }
      })
      .catch((err) => setDocument({ state: "error", message: String(err?.message ?? err) }));
  }, [documentId]);

  useResizeEmitter([document_]);

  const contentRows =
    document_.state === "ready" ? flatten(document_.data.content ?? {}) : [];

  return (
    <div style={{ fontFamily: "IBM Plex Sans, sans-serif", padding: "0" }}>
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{sdk.t("caseTabDetails.hello.title")}</div>
        <div style={mutedStyle}>{sdk.t("caseTabDetails.hello")}</div>
      </div>

      <div style={panelStyle}>
        <div style={panelTitleStyle}>{sdk.t("caseTabDetails.content.title")}</div>
        {document_.state === "loading" && <div style={mutedStyle}>{sdk.t("caseTab.loading")}</div>}
        {document_.state === "error" && <div style={errorStyle}>{document_.message}</div>}
        {document_.state === "ready" && contentRows.length === 0 && (
          <div style={mutedStyle}>{sdk.t("caseTabDetails.content.empty")}</div>
        )}
        {document_.state === "ready" &&
          contentRows.map((row) => (
            <div style={rowStyle} key={row.key}>
              <span style={keyStyle}>{row.key}</span>
              <span>{row.value}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

sdk.ready().then(() => {
  sdk.emit("ready", {});
  const root = createRoot(document.getElementById("root")!);
  root.render(<CaseDetailsTab />);
});
