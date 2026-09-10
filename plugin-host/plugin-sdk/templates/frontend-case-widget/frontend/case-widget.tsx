import React, {useEffect, useState} from "react";
import {createRoot} from "react-dom/client";
import {ValtimoPluginSDK} from "@valtimo/plugin-sdk/frontend";

const sdk = new ValtimoPluginSDK();

/** Shape of the JSON the plugin's own `request("/summary")` handler returns. */
interface Summary {
  message: string;
  documentId: string | null;
}

type LoadState =
  | {state: "loading"}
  | {state: "error"; message: string}
  | {state: "ready"; data: Summary};

/**
 * A widget on a case. Same machinery as the case tab — `sdk.getPluginData()` → the plugin's
 * `request()` handler → the `frontend_data` capability — but it shares the case page with other
 * widgets, so it shows one fact rather than a full view and keeps itself short.
 */
function CaseWidget() {
  const [summary, setSummary] = useState<LoadState>({state: "loading"});

  // Data served by this plugin's own backend. The parent forwards the call to the host's data route
  // with the logged-in user's downscoped token attached — the iframe never holds a token itself.
  useEffect(() => {
    sdk
      .getPluginData("/summary")
      .then((res) => {
        if (res.status >= 200 && res.status < 300) {
          setSummary({state: "ready", data: res.body as Summary});
        } else {
          setSummary({state: "error", message: sdk.t("caseWidget.error")});
        }
      })
      .catch((err) => setSummary({state: "error", message: String(err?.message ?? err)}));
  }, []);

  // The Valtimo parent sizes the iframe from this message, so re-emit whenever the content changes.
  useEffect(() => {
    sdk.emit("resize", {height: document.documentElement.scrollHeight});
  }, [summary]);

  return (
    <div style={{fontFamily: "IBM Plex Sans, sans-serif"}}>
      <h3>{sdk.t("caseWidget.title")}</h3>
      {summary.state === "loading" && <p>{sdk.t("caseWidget.loading")}</p>}
      {summary.state === "error" && <p>{summary.message}</p>}
      {summary.state === "ready" && <p>{summary.data.message}</p>}
    </div>
  );
}

// Mount only once translations and the parent's context have arrived — until then sdk.t() returns
// the raw key and sdk.getContext() is empty.
sdk.ready().then(() => {
  sdk.emit("ready", {});
  createRoot(document.getElementById("root")!).render(<CaseWidget />);
});
