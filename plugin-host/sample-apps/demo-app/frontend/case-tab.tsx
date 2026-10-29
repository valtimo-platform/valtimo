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

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ValtimoPluginSDK } from "@valtimo/plugin-sdk/frontend";

const sdk = new ValtimoPluginSDK();

const panelStyle: React.CSSProperties = { border: "1px solid #e0e0e0", padding: "16px", marginBottom: "16px", background: "#fff" };
const panelTitleStyle: React.CSSProperties = { fontSize: "14px", fontWeight: 600, color: "#161616", marginBottom: "8px" };
const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "14px", color: "#393939", borderBottom: "1px solid #f4f4f4" };
const mutedStyle: React.CSSProperties = { color: "#6f6f6f", fontSize: "14px" };
const errorStyle: React.CSSProperties = { color: "#da1e28", fontSize: "14px" };

interface InfoData {
  message: string;
  greetingPrefix: string;
  now: string;
}
interface ScopeResult {
  tokenType: "user" | "plugin";
  upstreamStatus: number;
  totalElements: number | null;
}
type LoadState<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };

function ScopePanel(props: { titleKey: string; descKey: string; state: LoadState<ScopeResult> }) {
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

function CaseTab() {
  const ctx = sdk.getContext() ?? {};
  const documentId = (ctx.documentId as string | undefined) ?? null;
  const caseDefinitionKey = (ctx.caseDefinitionKey as string | undefined) ?? null;

  const [info, setInfo] = useState<LoadState<InfoData>>({ state: "loading" });
  const [valtimo, setValtimo] = useState<LoadState<Record<string, unknown>>>({ state: "loading" });
  const [asUser, setAsUser] = useState<LoadState<ScopeResult>>({ state: "loading" });
  const [asPlugin, setAsPlugin] = useState<LoadState<ScopeResult>>({ state: "loading" });

  // (2) App-served data — the app's own handle_request handler, no GZAC.
  useEffect(() => {
    sdk
      .getPluginData("/info")
      .then((res) =>
        res.status >= 200 && res.status < 300
          ? setInfo({ state: "ready", data: res.body as InfoData })
          : setInfo({ state: "error", message: sdk.t("caseTab.plugin.error") }),
      )
      .catch((err) => setInfo({ state: "error", message: String(err?.message ?? err) }));
  }, []);

  // (3) Valtimo data, scoped to the logged-in user (user token via the parent-proxy).
  useEffect(() => {
    if (!documentId) {
      setValtimo({ state: "error", message: sdk.t("caseTab.valtimo.noDocument") });
      return;
    }
    sdk
      .callValtimo("GET", `/api/v1/document/${documentId}`)
      .then((res) => {
        if (res.status >= 200 && res.status < 300) setValtimo({ state: "ready", data: res.body as Record<string, unknown> });
        else if (res.status === 403) setValtimo({ state: "error", message: sdk.t("caseTab.valtimo.forbidden") });
        else setValtimo({ state: "error", message: sdk.t("caseTab.valtimo.error") });
      })
      .catch((err) => setValtimo({ state: "error", message: String(err?.message ?? err) }));
  }, [documentId]);

  // (4 & 5) App backend → GZAC as the user vs as the app (compare token scopes).
  useEffect(() => {
    if (!caseDefinitionKey) {
      const noCtx: LoadState<ScopeResult> = { state: "error", message: sdk.t("caseTab.backend.noContext") };
      setAsUser(noCtx);
      setAsPlugin(noCtx);
      return;
    }
    loadScope("/case-count-as-user", setAsUser);
    loadScope("/case-count-as-plugin", setAsPlugin);
  }, [caseDefinitionKey]);

  useEffect(() => {
    sdk.emit("resize", { height: document.documentElement.scrollHeight });
  }, [info, valtimo, asUser, asPlugin]);

  return (
    <div style={{ fontFamily: "IBM Plex Sans, sans-serif" }}>
      {/* (1) Hello world — static translated text. */}
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{sdk.t("caseTab.hello.title")}</div>
        <div style={mutedStyle}>{sdk.t("caseTab.hello")}</div>
      </div>

      {/* (2) App-served data. */}
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{sdk.t("caseTab.plugin.title")}</div>
        {info.state === "loading" && <div style={mutedStyle}>{sdk.t("caseTab.loading")}</div>}
        {info.state === "error" && <div style={errorStyle}>{info.message}</div>}
        {info.state === "ready" && (
          <div>
            <div style={{ ...mutedStyle, marginBottom: "8px" }}>{info.data.message}</div>
            <div style={rowStyle}>
              <span>greetingPrefix</span>
              <span>{info.data.greetingPrefix}</span>
            </div>
          </div>
        )}
      </div>

      {/* (3) Valtimo data, user-scoped. */}
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{sdk.t("caseTab.valtimo.title")}</div>
        {valtimo.state === "loading" && <div style={mutedStyle}>{sdk.t("caseTab.loading")}</div>}
        {valtimo.state === "error" && <div style={errorStyle}>{valtimo.message}</div>}
        {valtimo.state === "ready" && (
          <div style={rowStyle}>
            <span>{sdk.t("caseTab.valtimo.definition")}</span>
            <span>{describeDefinition(valtimo.data)}</span>
          </div>
        )}
      </div>

      {/* (4) app backend → GZAC (user token). */}
      <ScopePanel titleKey="caseTab.backend.userTitle" descKey="caseTab.backend.userDesc" state={asUser} />
      {/* (5) app backend → GZAC (app/service token, broader scope). */}
      <ScopePanel titleKey="caseTab.backend.pluginTitle" descKey="caseTab.backend.pluginDesc" state={asPlugin} />
    </div>
  );
}

function loadScope(path: string, setState: (s: LoadState<ScopeResult>) => void): void {
  sdk
    .getPluginData(path)
    .then((res) =>
      res.status >= 200 && res.status < 300
        ? setState({ state: "ready", data: res.body as ScopeResult })
        : setState({ state: "error", message: sdk.t("caseTab.backend.error") }),
    )
    .catch((err) => setState({ state: "error", message: String(err?.message ?? err) }));
}

function describeDefinition(document: Record<string, unknown>): string {
  const definitionId = document.definitionId as { name?: string } | undefined;
  return definitionId?.name ?? "(unknown)";
}

sdk.ready().then(() => {
  sdk.emit("ready", {});
  const root = createRoot(document.getElementById("root")!);
  root.render(<CaseTab />);
});
