import React, {useCallback, useEffect, useState} from "react";
import {createRoot} from "react-dom/client";
import {ValtimoPluginSDK} from "@valtimo/plugin-sdk/frontend";

const sdk = new ValtimoPluginSDK();

function ConfigForm() {
  const [title, setTitle] = useState("");
  const [greeting, setGreeting] = useState("Hello");

  useEffect(() => {
    sdk.onPrefillConfiguration(({title: prefillTitle, configuration}) => {
      if (prefillTitle) setTitle(prefillTitle);
      if (configuration.greeting) setGreeting(configuration.greeting as string);
    });
    // The parent already holds the latest values via configurationChanged.
    sdk.onSave(() => {});
    sdk.emit("ready", {});
  }, []);

  const emit = useCallback((nextTitle: string, nextGreeting: string) => {
    sdk.setConfiguration(nextTitle.trim().length > 0, nextTitle.trim(), {
      greeting: nextGreeting.trim() || "Hello",
    });
  }, []);

  return (
    <div style={{fontFamily: "IBM Plex Sans, sans-serif"}}>
      <label>{sdk.t("config.title.label")}</label>
      <input
        type="text"
        value={title}
        onChange={(e) => { setTitle(e.target.value); emit(e.target.value, greeting); }}
        placeholder={sdk.t("config.title.placeholder")}
      />
      <label>{sdk.t("config.greeting.label")}</label>
      <input
        type="text"
        value={greeting}
        onChange={(e) => { setGreeting(e.target.value); emit(title, e.target.value); }}
      />
    </div>
  );
}

// Mount only once translations are loaded — until then sdk.t() returns the raw key.
sdk.ready().then(() => createRoot(document.getElementById("root")!).render(<ConfigForm />));
