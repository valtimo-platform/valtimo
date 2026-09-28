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
 * A page of its own in the Valtimo menu, mounted under the `icon` and the
 * `page.__BUNDLE_KEY__.title` label the manifest declares. That title is a **translation key**, not
 * a literal — GZAC resolves it per locale to build the menu entry.
 *
 * The one structural difference from the case surfaces: a page is not opened from a case, so there
 * is no `documentId` in the context. What it does carry is the plugin configuration it was mounted
 * for, which is what makes the app-level scope visible.
 */
function Page() {
  const configurationId = (sdk.getContext()?.pluginConfigurationId as string | undefined) ?? null;
  const [summary, setSummary] = useState<LoadState>({state: "loading"});

  useEffect(() => {
    sdk
      .getPluginData("/summary")
      .then((res) => {
        if (res.status >= 200 && res.status < 300) {
          setSummary({state: "ready", data: res.body as Summary});
        } else {
          setSummary({state: "error", message: sdk.t("page.error")});
        }
      })
      .catch((err) => setSummary({state: "error", message: String(err?.message ?? err)}));
  }, []);

  return (
    <div style={{fontFamily: "IBM Plex Sans, sans-serif"}}>
      <h2>{sdk.t("page.__BUNDLE_KEY__.title")}</h2>
      <p>
        {sdk.t("page.configuration")}: {configurationId ?? "—"}
      </p>
      {summary.state === "loading" && <p>{sdk.t("page.loading")}</p>}
      {summary.state === "error" && <p>{summary.message}</p>}
      {summary.state === "ready" && <p>{summary.data.message}</p>}
    </div>
  );
}

// Mount only once translations and the parent's context have arrived — until then sdk.t() returns
// the raw key and sdk.getContext() is empty.
sdk.ready().then(() => {
  sdk.emit("ready", {});
  createRoot(document.getElementById("root")!).render(<Page />);
});
