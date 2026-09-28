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

const mutedStyle: React.CSSProperties = {color: "#6f6f6f", fontSize: "14px"};
const errorStyle: React.CSSProperties = {color: "#da1e28", fontSize: "14px"};

const cellStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: "14px",
  color: "#393939",
  borderBottom: "1px solid #f4f4f4",
  textAlign: "left",
};

const headerCellStyle: React.CSSProperties = {
  ...cellStyle,
  fontWeight: 600,
  color: "#161616",
};

interface ReportRow {
  period: string;
  created: number;
  completed: number;
}

interface ReportsData {
  rows: ReportRow[];
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

function ReportsPage() {
  const [reports, setReports] = useState<LoadState<ReportsData>>({state: "loading"});

  // Plugin-served data — fetched from the plugin's own `/reports` handle_request handler.
  useEffect(() => {
    sdk
      .getPluginData("/reports")
      .then((res) => {
        if (res.status >= 200 && res.status < 300) {
          setReports({state: "ready", data: res.body as ReportsData});
        } else {
          setReports({state: "error", message: sdk.t("page.error")});
        }
      })
      .catch((err) => setReports({state: "error", message: String(err?.message ?? err)}));
  }, []);

  useResizeEmitter([reports]);

  return (
    <div style={pageStyle}>
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{sdk.t("page.reports.title")}</div>
        <div style={mutedStyle}>{sdk.t("page.reports.intro")}</div>
      </div>

      <div style={panelStyle}>
        {reports.state === "loading" && <div style={mutedStyle}>{sdk.t("page.loading")}</div>}
        {reports.state === "error" && <div style={errorStyle}>{reports.message}</div>}
        {reports.state === "ready" && (
          <table style={{width: "100%", borderCollapse: "collapse"}}>
            <thead>
              <tr>
                <th style={headerCellStyle}>{sdk.t("page.reports.table.period")}</th>
                <th style={headerCellStyle}>{sdk.t("page.reports.table.created")}</th>
                <th style={headerCellStyle}>{sdk.t("page.reports.table.completed")}</th>
              </tr>
            </thead>
            <tbody>
              {reports.data.rows.map((row) => (
                <tr key={row.period}>
                  <td style={cellStyle}>{row.period}</td>
                  <td style={cellStyle}>{row.created}</td>
                  <td style={cellStyle}>{row.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Wait for the SDK to fetch the manifest before mounting, so `sdk.t(key)` is populated.
sdk.ready().then(() => {
  sdk.emit("ready", {});
  const root = createRoot(document.getElementById("root")!);
  root.render(<ReportsPage />);
});
