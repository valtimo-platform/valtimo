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
  padding: "4px 0",
  fontSize: "14px",
  color: "#393939",
  borderBottom: "1px solid #f4f4f4",
};

const mutedStyle: React.CSSProperties = { color: "#6f6f6f", fontSize: "14px" };
const errorStyle: React.CSSProperties = { color: "#da1e28", fontSize: "14px" };

interface SummaryData {
  message: string;
  currency: string;
  documentId: string | null;
  viewCount: number;
  items: Array<{ label: string; value: string }>;
}

interface ExternalData {
  todo: { id: number; title: string; completed: boolean } | null;
  viewCount: number;
  fetchStatus: number;
  /** Result of calling the admin-configured URL (`x-egress-target`); null when none is set. */
  configured: { url: string; status: number; reached: boolean } | null;
}

interface BackendScopeResult {
  tokenType: "user" | "plugin";
  upstreamStatus: number;
  caseDefinitionKey: string;
  totalElements: number | null;
}

type LoadState<T> =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; data: T };

/** Renders the result of a "tab → plugin backend → GZAC" case-count call (levels 3 & 4). */
function BackendScopePanel(props: {
  titleKey: string;
  descKey: string;
  state: LoadState<BackendScopeResult>;
}) {
  const { titleKey, descKey, state } = props;
  return (
    <div style={panelStyle}>
      <div style={panelTitleStyle}>{sdk.t(titleKey)}</div>
      <div style={{ ...mutedStyle, marginBottom: "8px" }}>{sdk.t(descKey)}</div>
      {state.state === "loading" && <div style={mutedStyle}>{sdk.t("caseTab.loading")}</div>}
      {state.state === "error" && <div style={errorStyle}>{state.message}</div>}
      {state.state === "ready" && (
        <div>
          <div style={rowStyle}>
            <span>{sdk.t("caseTab.backend.upstreamStatus")}</span>
            <span>{state.data.upstreamStatus}</span>
          </div>
          {state.data.totalElements !== null ? (
            <div style={rowStyle}>
              <span>{sdk.t("caseTab.backend.casesVisible")}</span>
              <span>{state.data.totalElements}</span>
            </div>
          ) : (
            <div style={errorStyle}>{sdk.t("caseTab.backend.denied")}</div>
          )}
        </div>
      )}
    </div>
  );
}

function useResizeEmitter(deps: unknown[]): void {
  useEffect(() => {
    // The Angular parent auto-resizes the iframe from this message.
    const height = document.documentElement.scrollHeight;
    sdk.emit("resize", { height });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function CaseTab() {
  const ctx = sdk.getContext() ?? {};
  const documentId = (ctx.documentId as string | undefined) ?? null;

  const [pluginData, setPluginData] = useState<LoadState<SummaryData>>({ state: "loading" });
  const [valtimoData, setValtimoData] = useState<LoadState<Record<string, unknown>>>({
    state: "loading",
  });
  const [scopeAsUser, setScopeAsUser] = useState<LoadState<BackendScopeResult>>({ state: "loading" });
  const [scopeAsPlugin, setScopeAsPlugin] = useState<LoadState<BackendScopeResult>>({
    state: "loading",
  });
  const [externalData, setExternalData] = useState<LoadState<ExternalData>>({ state: "loading" });

  // External API data — fetched via http_request + kv capabilities.
  useEffect(() => {
    sdk
      .getPluginData("/external-data")
      .then((res) => {
        if (res.status >= 200 && res.status < 300) {
          setExternalData({ state: "ready", data: res.body as ExternalData });
        } else {
          setExternalData({ state: "error", message: sdk.t("caseTab.external.error") });
        }
      })
      .catch((err) => setExternalData({ state: "error", message: String(err?.message ?? err) }));
  }, []);

  // (4) tab -> plugin backend -> GZAC, with the downscoped user token (PBAC ∩ allowlist).
  useEffect(() => {
    loadScope("/case-count-as-user", setScopeAsUser);
  }, []);

  // (5) tab -> plugin backend -> GZAC, with the service/plugin token (allowlist only; broader scope).
  useEffect(() => {
    loadScope("/case-count-as-plugin", setScopeAsPlugin);
  }, []);

  // (2) Plugin-served data — fetched from the plugin's own handle_request handler.
  useEffect(() => {
    sdk
      .getPluginData("/summary")
      .then((res) => {
        if (res.status >= 200 && res.status < 300) {
          setPluginData({ state: "ready", data: res.body as SummaryData });
        } else {
          setPluginData({ state: "error", message: sdk.t("caseTab.plugin.error") });
        }
      })
      .catch((err) => setPluginData({ state: "error", message: String(err?.message ?? err) }));
  }, []);

  // (3) Valtimo data, user-scoped — fetched from GZAC through the downscoped user token.
  useEffect(() => {
    if (!documentId) {
      setValtimoData({ state: "error", message: sdk.t("caseTab.valtimo.noDocument") });
      return;
    }
    sdk
      .callValtimo("GET", `/api/v1/document/${documentId}`)
      .then((res) => {
        if (res.status >= 200 && res.status < 300) {
          setValtimoData({ state: "ready", data: res.body as Record<string, unknown> });
        } else if (res.status === 403) {
          setValtimoData({ state: "error", message: sdk.t("caseTab.valtimo.forbidden") });
        } else {
          setValtimoData({ state: "error", message: sdk.t("caseTab.valtimo.error") });
        }
      })
      .catch((err) => setValtimoData({ state: "error", message: String(err?.message ?? err) }));
  }, [documentId]);

  useResizeEmitter([pluginData, valtimoData, scopeAsUser, scopeAsPlugin, externalData]);

  return (
    <div style={{ fontFamily: "IBM Plex Sans, sans-serif", padding: "0" }}>
      {/* (1) Hello world — static text via the translation table. */}
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{sdk.t("caseTab.hello.title")}</div>
        <div style={mutedStyle}>{sdk.t("caseTab.hello")}</div>
      </div>

      {/* (2) Plugin-served data + KV view counter. */}
      <div style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={panelTitleStyle}>{sdk.t("caseTab.plugin.title")}</div>
          {pluginData.state === "ready" && (
            <span style={{ fontSize: "12px", color: "#6f6f6f", background: "#e0e0e0", borderRadius: "12px", padding: "2px 10px" }}>
              {sdk.t("caseTab.viewCount")}: {pluginData.data.viewCount}
            </span>
          )}
        </div>
        {pluginData.state === "loading" && <div style={mutedStyle}>{sdk.t("caseTab.loading")}</div>}
        {pluginData.state === "error" && <div style={errorStyle}>{pluginData.message}</div>}
        {pluginData.state === "ready" && (
          <div>
            <div style={{ ...mutedStyle, marginBottom: "8px" }}>{pluginData.data.message}</div>
            {pluginData.data.items.map((item) => (
              <div style={rowStyle} key={item.label}>
                <span>{item.label}</span>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* External API data — http_request + kv capabilities. */}
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{sdk.t("caseTab.external.title")}</div>
        {externalData.state === "loading" && <div style={mutedStyle}>{sdk.t("caseTab.loading")}</div>}
        {externalData.state === "error" && <div style={errorStyle}>{externalData.message}</div>}
        {externalData.state === "ready" && externalData.data.todo && (
          <div>
            <div style={rowStyle}>
              <span>{sdk.t("caseTab.external.todoTitle")}</span>
              <span>{externalData.data.todo.title}</span>
            </div>
            <div style={rowStyle}>
              <span>{sdk.t("caseTab.external.todoCompleted")}</span>
              <span>{externalData.data.todo.completed ? "✓" : "✗"}</span>
            </div>
            <div style={rowStyle}>
              <span>{sdk.t("caseTab.viewCount")}</span>
              <span>{externalData.data.viewCount}</span>
            </div>
          </div>
        )}
        {externalData.state === "ready" && !externalData.data.todo && (
          <div style={errorStyle}>{sdk.t("caseTab.external.error")}</div>
        )}
        {/* The admin-configured destination, shown next to the manifest-declared one so the two
            provenances are visible side by side. A URL outside the allowlist is refused by the
            host, which shows up here as a non-2xx status rather than as data. */}
        {externalData.state === "ready" && externalData.data.configured && (
          <div>
            <div style={rowStyle}>
              <span>{sdk.t("caseTab.external.configuredUrl")}</span>
              <span>{externalData.data.configured.url}</span>
            </div>
            <div style={rowStyle}>
              <span>{sdk.t("caseTab.external.configuredStatus")}</span>
              <span style={externalData.data.configured.reached ? undefined : errorStyle}>
                {externalData.data.configured.reached
                  ? externalData.data.configured.status
                  : sdk.t("caseTab.external.configuredBlocked")}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* (3) Valtimo data, scoped to the logged-in user (PBAC ∩ allowlist). */}
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{sdk.t("caseTab.valtimo.title")}</div>
        {valtimoData.state === "loading" && <div style={mutedStyle}>{sdk.t("caseTab.loading")}</div>}
        {valtimoData.state === "error" && <div style={errorStyle}>{valtimoData.message}</div>}
        {valtimoData.state === "ready" && (
          <div style={rowStyle}>
            <span>{sdk.t("caseTab.valtimo.definition")}</span>
            <span>{describeDefinition(valtimoData.data)}</span>
          </div>
        )}
      </div>

      {/* (4) tab -> plugin backend -> GZAC with the user token (PBAC ∩ allowlist). */}
      <BackendScopePanel
        titleKey="caseTab.backend.userTitle"
        descKey="caseTab.backend.userDesc"
        state={scopeAsUser}
      />

      {/* (5) tab -> plugin backend -> GZAC with the service/plugin token (broader than the user). */}
      <BackendScopePanel
        titleKey="caseTab.backend.pluginTitle"
        descKey="caseTab.backend.pluginDesc"
        state={scopeAsPlugin}
      />
    </div>
  );
}

function loadScope(
  path: string,
  setState: (state: LoadState<BackendScopeResult>) => void
): void {
  sdk
    .getPluginData(path)
    .then((res) => {
      if (res.status >= 200 && res.status < 300) {
        setState({ state: "ready", data: res.body as BackendScopeResult });
      } else {
        setState({ state: "error", message: sdk.t("caseTab.backend.error") });
      }
    })
    .catch((err) => setState({ state: "error", message: String(err?.message ?? err) }));
}

function describeDefinition(document: Record<string, unknown>): string {
  const definitionId = document.definitionId as
    | { name?: string; blueprintId?: { blueprintVersionTag?: string } }
    | undefined;
  if (!definitionId) return "(unknown)";
  const name = definitionId.name ?? "unknown";
  const version = definitionId.blueprintId?.blueprintVersionTag;
  return version ? `${name} v${version}` : name;
}

// Wait for the SDK to fetch the manifest + receive init (context) before mounting, so `sdk.t(key)`
// and `sdk.getContext()` are populated.
sdk.ready().then(() => {
  sdk.emit("ready", {});
  const root = createRoot(document.getElementById("root")!);
  root.render(<CaseTab />);
});
