import React, {useCallback, useEffect, useState} from "react";
import {createRoot} from "react-dom/client";
import {ValtimoPluginSDK} from "@valtimo/plugin-sdk/frontend";

const sdk = new ValtimoPluginSDK();

/**
 * The form an administrator fills in when wiring this plugin's action onto a BPMN task through a
 * process link. It configures **one use** of the action, where `config.tsx` configures the plugin
 * as a whole; what it collects lands in `input.properties` of the `action("__PLUGIN_ID__", …)`
 * handler.
 *
 * `setConfiguration` takes an empty title: a process link has no name of its own, so only the
 * validity flag and the data matter here.
 */
function ActionConfigForm() {
  const [greeting, setGreeting] = useState("Hello");

  useEffect(() => {
    sdk.onPrefillConfiguration(({configuration}) => {
      if (configuration.greeting) setGreeting(configuration.greeting as string);
    });
    // The parent already holds the latest values via configurationChanged.
    sdk.onSave(() => {});
    sdk.emit("ready", {});
  }, []);

  const emit = useCallback((next: string) => {
    sdk.setConfiguration(next.trim().length > 0, "", {greeting: next.trim()});
  }, []);

  return (
    <div style={{fontFamily: "IBM Plex Sans, sans-serif"}}>
      <label htmlFor="greeting">{sdk.t("actionConfig.greeting.label")}</label>
      <input
        id="greeting"
        type="text"
        value={greeting}
        onChange={(e) => {
          setGreeting(e.target.value);
          emit(e.target.value);
        }}
        placeholder={sdk.t("actionConfig.greeting.placeholder")}
      />
      <p>{sdk.t("actionConfig.greeting.help")}</p>
    </div>
  );
}

// Mount only once translations are loaded — until then sdk.t() returns the raw key.
sdk.ready().then(() => createRoot(document.getElementById("root")!).render(<ActionConfigForm />));
