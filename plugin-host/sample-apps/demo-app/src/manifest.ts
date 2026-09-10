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

/**
 * The single plugin this app serves. GZAC discovers it by polling `GET /api/host/plugins`, which
 * returns `[{ pluginId, version, manifest }]` — this manifest is that one entry. It is exactly the
 * shape a plugin host serves for an uploaded `.wasm` plugin; the only difference is that this app
 * implements the behaviour natively (see plugin.ts) instead of running a sandboxed module.
 *
 * The type is declared locally so the app's server has zero runtime coupling to the plugin SDK
 * (only the browser bundles import `@valtimo/plugin-sdk/frontend`).
 */
export interface PluginManifest {
  pluginId: string;
  version: string;
  provider?: string;
  compatibility?: { minGzacVersion?: string; maxGzacVersion?: string };
  configurationSchema?: Record<string, unknown>;
  permissions?: { endpoints?: Array<{ method: string; pattern: string }> };
  frontendBundles?: Array<{
    type: "config" | "process-link-action" | "case-tab" | "case-widget" | "page" | "task-form";
    key?: string;
    title?: string;
    path: string;
    activityTypes?: string[];
  }>;
  logo?: string;
  translations: Record<string, Record<string, string>>;
  actions: Array<{
    key: string;
    title: string;
    description?: string;
    activityTypes: string[];
    properties?: Array<{ key: string; type: string; required?: boolean }>;
  }>;
  eventSubscriptions?: string[];
}

export const PLUGIN_ID = "demo-app";
export const PLUGIN_VERSION = "1.0.0";

export const manifest: PluginManifest = {
  pluginId: PLUGIN_ID,
  version: PLUGIN_VERSION,
  provider: "Ritense",
  logo: "logo.svg",
  translations: {
    en: {
      name: "Demo App",
      description: "Reference URL app: a remote service that serves its own single plugin — action, config, case tab, data and events — over the Valtimo contract.",
      "config.title.label": "Configuration name",
      "config.title.placeholder": "Enter a name for this configuration",
      "config.greetingPrefix.label": "Greeting prefix",
      "config.greetingPrefix.placeholder": "Hello",
      "config.greetingPrefix.help": "Word the app puts in front of the name, e.g. \"Hello\" or \"Welcome\".",
      "action.name.label": "Name to greet",
      "action.name.placeholder": "world",
      "action.name.help": "Static name to greet. Leave blank to greet the case (by document) or \"world\".",
      "action.greetingVariable.label": "Greeting variable name",
      "action.greetingVariable.placeholder": "greeting",
      "action.greetingVariable.help": "Process variable the generated greeting is written to (default: greeting).",
      "caseTab.hello.title": "Hello world",
      "caseTab.hello": "This panel is rendered by the demo app's case-tab bundle, running in a sandboxed iframe.",
      "caseTab.loading": "Loading…",
      "caseTab.plugin.title": "App-served data",
      "caseTab.plugin.error": "Could not load app data.",
      "caseTab.valtimo.title": "Case data (your access)",
      "caseTab.valtimo.definition": "Case definition",
      "caseTab.valtimo.error": "Could not load case data.",
      "caseTab.valtimo.forbidden": "You don't have permission to view this case's data.",
      "caseTab.valtimo.noDocument": "No document is associated with this tab.",
      "caseTab.backend.userTitle": "App backend → Valtimo (user token)",
      "caseTab.backend.userDesc": "The app counts cases of this type as you — row-level PBAC ∩ the app's allowlist, so you only see yours.",
      "caseTab.backend.pluginTitle": "App backend → Valtimo (app token)",
      "caseTab.backend.pluginDesc": "The app counts cases as the system — PBAC is bypassed, so it sees every case (scope broader than yours).",
      "caseTab.backend.upstreamStatus": "Upstream status",
      "caseTab.backend.casesVisible": "Cases visible",
      "caseTab.backend.denied": "The upstream call was denied for this token.",
      "caseTab.backend.error": "The app backend could not complete the call.",
      "caseTab.backend.noContext": "Open this tab on a case to compare token scopes.",
    },
    nl: {
      name: "Demo-app",
      description: "Referentie-URL-app: een externe service die zijn eigen plugin aanbiedt — actie, configuratie, zaaktabblad, data en events — via het Valtimo-contract.",
      "config.title.label": "Configuratienaam",
      "config.title.placeholder": "Voer een naam in voor deze configuratie",
      "config.greetingPrefix.label": "Begroetingsprefix",
      "config.greetingPrefix.placeholder": "Hallo",
      "config.greetingPrefix.help": "Woord dat de app vóór de naam plaatst, bv. \"Hallo\" of \"Welkom\".",
      "action.name.label": "Naam om te begroeten",
      "action.name.placeholder": "wereld",
      "action.name.help": "Vaste naam om te begroeten. Leeg laten om de zaak (via document) of \"wereld\" te begroeten.",
      "action.greetingVariable.label": "Naam begroetingsvariabele",
      "action.greetingVariable.placeholder": "greeting",
      "action.greetingVariable.help": "Procesvariabele waarin de gegenereerde begroeting wordt geschreven (standaard: greeting).",
      "caseTab.hello.title": "Hallo wereld",
      "caseTab.hello": "Dit paneel wordt weergegeven door de case-tab-bundle van de demo-app, in een sandboxed iframe.",
      "caseTab.loading": "Laden…",
      "caseTab.plugin.title": "Door de app geleverde gegevens",
      "caseTab.plugin.error": "Kon app-gegevens niet laden.",
      "caseTab.valtimo.title": "Zaakgegevens (uw toegang)",
      "caseTab.valtimo.definition": "Zaaktype",
      "caseTab.valtimo.error": "Kon zaakgegevens niet laden.",
      "caseTab.valtimo.forbidden": "U heeft geen rechten om de gegevens van deze zaak te bekijken.",
      "caseTab.valtimo.noDocument": "Er is geen document gekoppeld aan dit tabblad.",
      "caseTab.backend.userTitle": "App-backend → Valtimo (gebruikerstoken)",
      "caseTab.backend.userDesc": "De app telt zaken van dit type als u — PBAC op rijniveau ∩ de allowlist van de app, dus u ziet alleen die van uzelf.",
      "caseTab.backend.pluginTitle": "App-backend → Valtimo (app-token)",
      "caseTab.backend.pluginDesc": "De app telt zaken als het systeem — PBAC wordt omzeild, dus alle zaken zijn zichtbaar (bredere scope dan die van u).",
      "caseTab.backend.upstreamStatus": "Upstream-status",
      "caseTab.backend.casesVisible": "Zichtbare zaken",
      "caseTab.backend.denied": "De upstream-aanroep is geweigerd voor dit token.",
      "caseTab.backend.error": "De app-backend kon de aanroep niet voltooien.",
      "caseTab.backend.noContext": "Open dit tabblad op een zaak om tokenscopes te vergelijken.",
    },
  },
  configurationSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: {
      greetingPrefix: {
        type: "string",
        title: "Greeting prefix",
        default: "Hello",
      },
    },
    additionalProperties: false,
  },
  permissions: {
    endpoints: [
      { method: "GET", pattern: "/api/v1/document/*" },
      { method: "POST", pattern: "/api/v1/document/*/note" },
      { method: "POST", pattern: "/api/v1/case/*/search" },
    ],
  },
  frontendBundles: [
    { type: "config", path: "/bundles/config.html" },
    {
      type: "process-link-action",
      key: "greet",
      title: "Build greeting",
      path: "/bundles/action-config.html",
    },
    { type: "case-tab", key: "demo", title: "Demo App", path: "/bundles/case-tab.html" },
  ],
  actions: [
    {
      key: "greet",
      title: "Build greeting",
      description: "Builds a greeting from the configured prefix and writes it to a process variable.",
      activityTypes: ["SERVICE_TASK_START"],
      properties: [
        { key: "name", type: "string", required: false },
        { key: "greetingVariable", type: "string", required: false },
      ],
    },
  ],
  eventSubscriptions: ["com.ritense.valtimo.document.created"],
};
