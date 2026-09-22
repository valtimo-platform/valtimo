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
 * One descriptor per optional part, and everything the generator knows about that part: which SDK
 * symbols it imports, which backend fragment it needs, which templates it writes, which translation
 * strings it looks up, and what it adds to the manifest.
 *
 * Everything else in `src/scaffold/` consumes this table generically. That is deliberate: with six
 * bundle types and six decision sites, branching per part would be thirty-six places to keep in
 * step, and adding a seventh type would touch all six files. Here it is one entry.
 *
 * The tables under `strings` are the fixed UI strings per part, in the locales we can actually
 * write. A locale we have no strings for falls back to English, which is visibly wrong in the UI and
 * therefore gets translated — better than an empty string, which looks like a rendering bug.
 */

import type {FrontendBundle, HostCapability, PluginManifest} from "../models/index.js";
import type {ScaffoldOptions} from "./options.js";

export type PartId =
  | "event"
  | "config"
  | "process-link-action"
  | "case-tab"
  | "case-widget"
  | "task-form"
  | "page";

/**
 * Backend fragments appended to `src/plugin.ts`. Several parts share one — three bundle types fetch
 * their data through `request` — so a handler is emitted once however many of its parts are
 * selected.
 */
export type HandlerId = "onEvent" | "request" | "submit";

/** Fragment template for each handler, relative to `templates/`. */
export const HANDLER_FRAGMENTS: Record<HandlerId, string> = {
  onEvent: "fragments/on-event.ts",
  request: "fragments/request.ts",
  submit: "fragments/submit.ts",
};

/** Where a part's frontend bundle comes from and what it is called on disk. */
export interface PartFrontend {
  /** Directory under `templates/`, e.g. `frontend-case-tab`. */
  readonly templateDir: string;
  /** File stem shared by the bundle's `.html`, its `.tsx` and the `.bundle.js` the pack tool emits. */
  readonly stem: string;
}

/**
 * Per-instance context: the resolved options plus the key this instance of the part was given.
 * `key` is null for the parts that have none — `event` and the unkeyed `config` bundle.
 */
export interface PartContext {
  readonly options: ScaffoldOptions;
  readonly id: PartId;
  readonly key: string | null;
}

/** Everything the generator knows about one optional part. All fields are additive. */
export interface PartDescriptor {
  /** Selection name: the `--bundles` value, the wizard legend entry, the key in {@link PARTS}. */
  readonly id: PartId;
  /** One-line legend text, e.g. "admin — the plugin configuration form". */
  readonly summary: string;
  /**
   * Key this part's bundle gets when nobody chose one, or null for an unkeyed part (`config`) and
   * the non-bundle parts. A function of the options because `process-link-action` keys on the
   * plugin id — that is the action key `actions[0]` uses, and GZAC matches bundle to action by key.
   */
  defaultKey(options: ScaffoldOptions): string | null;
  /** Type-only and value SDK imports `src/plugin.ts` needs. */
  readonly typeImports: readonly string[];
  readonly valueImports: readonly string[];
  /** Backend fragment this part needs, or null for a part with no backend counterpart. */
  readonly handler: HandlerId | null;
  /** Frontend template dir and target file stem, or null for a backend-only part. */
  readonly frontend: PartFrontend | null;
  /** README section appended for this part, relative to `templates/`. */
  readonly readmeFragment: string | null;
  readonly capabilities: readonly HostCapability[];
  /** Fixed translation keys per locale; `en` is the fallback bucket for any other locale. */
  readonly strings: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /**
   * Translation key carrying this part's bundle title — the plugin's display name — or null for a
   * part whose title is not translated. A function of the context because a `page` bundle's title
   * key is `page.<key>.title`, and GZAC resolves it across every locale bucket.
   */
  titleKey(ctx: PartContext): string | null;
  /**
   * Tokens this part contributes to the **base** template. `config` is the only part that has any:
   * with a config bundle there is a configuration property for the action to fall back on.
   */
  readonly baseTokens?: Readonly<Record<string, string>>;
  /** Merges this part's keys into a manifest under construction. Must be idempotent. */
  applyToManifest(manifest: PluginManifest, ctx: PartContext): void;
}

/**
 * `SERVICE_TASK_START` is a GZAC `ActivityTypeWithEventName` constant: it makes the action
 * selectable on a BPMN service task, which is where a scaffolded plugin's first action belongs.
 */
const DEFAULT_ACTIVITY_TYPES = ["SERVICE_TASK_START"];

/** The first event most plugins want, and the one the sample subscribes to. */
const DEFAULT_EVENT_SUBSCRIPTIONS = ["com.ritense.valtimo.document.created"];

const CONFIG_STRINGS = {
  en: {
    "config.title.label": "Configuration name",
    "config.title.placeholder": "Enter a name for this configuration",
    "config.greeting.label": "Greeting",
  },
  nl: {
    "config.title.label": "Naam van de configuratie",
    "config.title.placeholder": "Voer een naam in voor deze configuratie",
    "config.greeting.label": "Begroeting",
  },
};

const ACTION_CONFIG_STRINGS = {
  en: {
    "actionConfig.greeting.label": "Greeting",
    "actionConfig.greeting.placeholder": "Hello",
    "actionConfig.greeting.help": "Written to the greeting process variable by this action.",
  },
  nl: {
    "actionConfig.greeting.label": "Begroeting",
    "actionConfig.greeting.placeholder": "Hallo",
    "actionConfig.greeting.help":
      "Wordt door deze actie naar de procesvariabele greeting geschreven.",
  },
};

const CASE_TAB_STRINGS = {
  en: {
    "caseTab.loading": "Loading…",
    "caseTab.error": "Could not load plugin data.",
  },
  nl: {
    "caseTab.loading": "Laden…",
    "caseTab.error": "Kon de plugingegevens niet laden.",
  },
};

const CASE_WIDGET_STRINGS = {
  en: {
    "caseWidget.loading": "Loading…",
    "caseWidget.error": "Could not load plugin data.",
  },
  nl: {
    "caseWidget.loading": "Laden…",
    "caseWidget.error": "Kon de plugingegevens niet laden.",
  },
};

const TASK_FORM_STRINGS = {
  en: {
    "taskForm.comment.label": "Comment",
    "taskForm.comment.placeholder": "Why are you completing this task?",
    "taskForm.decision.label": "Decision",
    "taskForm.decision.approve": "Approve",
    "taskForm.decision.reject": "Reject",
    "taskForm.submit": "Submit",
    "taskForm.submitting": "Submitting…",
    "taskForm.completed": "Task submitted.",
  },
  nl: {
    "taskForm.comment.label": "Toelichting",
    "taskForm.comment.placeholder": "Waarom rondt u deze taak af?",
    "taskForm.decision.label": "Besluit",
    "taskForm.decision.approve": "Goedkeuren",
    "taskForm.decision.reject": "Afwijzen",
    "taskForm.submit": "Versturen",
    "taskForm.submitting": "Bezig met versturen…",
    "taskForm.completed": "Taak verstuurd.",
  },
};

const PAGE_STRINGS = {
  en: {
    "page.configuration": "Configuration",
    "page.loading": "Loading…",
    "page.error": "Could not load plugin data.",
  },
  nl: {
    "page.configuration": "Configuratie",
    "page.loading": "Laden…",
    "page.error": "Kon de plugingegevens niet laden.",
  },
};

/**
 * Declaration order fixes fragment order in `src/plugin.ts` and bundle order in the manifest, so a
 * project never depends on the order the author typed their selection in. `event` comes first
 * because its handler is the one a reader meets first in the generated source.
 */
export const PARTS: Record<PartId, PartDescriptor> = {
  event: {
    id: "event",
    summary: "backend — a handler for platform events",
    defaultKey: () => null,
    typeImports: ["EventInput"],
    valueImports: ["onEvent"],
    handler: "onEvent",
    frontend: null,
    readmeFragment: null,
    capabilities: [],
    strings: {},
    titleKey: () => null,
    applyToManifest(manifest) {
      manifest.eventSubscriptions = [...DEFAULT_EVENT_SUBSCRIPTIONS];
    },
  },

  config: {
    id: "config",
    summary: "admin — the plugin configuration form",
    // The one bundle type that is genuinely unkeyed: there is at most one per plugin.
    defaultKey: () => null,
    typeImports: [],
    valueImports: ["config"],
    handler: null,
    frontend: {templateDir: "frontend-config", stem: "config"},
    readmeFragment: "fragments/readme-config.md",
    capabilities: [],
    strings: CONFIG_STRINGS,
    titleKey: () => null,
    baseTokens: {
      GREETING_SOURCE:
        '(input.properties.greeting as string) || (config.get("greeting") as string) || "Hello"',
    },
    applyToManifest(manifest) {
      manifest.configurationSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {
          greeting: {type: "string", title: "Greeting", default: "Hello"},
        },
        additionalProperties: false,
      };
      addBundle(manifest, {type: "config", path: "/bundles/config.html"});
    },
  },

  "process-link-action": {
    id: "process-link-action",
    summary: "admin — the action's form in the process-link stepper",
    defaultKey: (options) => options.pluginId,
    typeImports: [],
    valueImports: [],
    handler: null,
    frontend: {templateDir: "frontend-process-link-action", stem: "action-config"},
    readmeFragment: "fragments/readme-process-link-action.md",
    capabilities: [],
    strings: ACTION_CONFIG_STRINGS,
    titleKey: () => null,
    applyToManifest(manifest, ctx) {
      addBundle(manifest, {
        type: "process-link-action",
        key: ctx.key ?? ctx.options.pluginId,
        title: ctx.options.name,
        path: "/bundles/action-config.html",
      });
    },
  },

  "case-tab": {
    id: "case-tab",
    summary: "user  — a tab on a case",
    defaultKey: () => "summary",
    typeImports: ["RequestInput"],
    valueImports: ["request"],
    handler: "request",
    frontend: {templateDir: "frontend-case-tab", stem: "case-tab"},
    readmeFragment: "fragments/readme-case-tab.md",
    // The host refuses to run handle_request for a configuration without this, so a tab that
    // fetches its own data is dead without it.
    capabilities: ["frontend_data"],
    strings: CASE_TAB_STRINGS,
    titleKey: () => "caseTab.title",
    applyToManifest(manifest, ctx) {
      addBundle(manifest, {
        type: "case-tab",
        key: ctx.key ?? "summary",
        title: ctx.options.name,
        path: "/bundles/case-tab.html",
      });
    },
  },

  "case-widget": {
    id: "case-widget",
    summary: "user  — a widget on a case",
    defaultKey: () => "summary",
    typeImports: ["RequestInput"],
    valueImports: ["request"],
    handler: "request",
    frontend: {templateDir: "frontend-case-widget", stem: "case-widget"},
    readmeFragment: "fragments/readme-case-widget.md",
    capabilities: ["frontend_data"],
    strings: CASE_WIDGET_STRINGS,
    titleKey: () => "caseWidget.title",
    applyToManifest(manifest, ctx) {
      addBundle(manifest, {
        type: "case-widget",
        key: ctx.key ?? "summary",
        title: ctx.options.name,
        path: "/bundles/case-widget.html",
      });
    },
  },

  "task-form": {
    id: "task-form",
    summary: "user  — a form on a user task (can validate the submission)",
    defaultKey: () => "review",
    typeImports: ["SubmitInput"],
    valueImports: ["submit"],
    handler: "submit",
    frontend: {templateDir: "frontend-task-form", stem: "task-form"},
    readmeFragment: "fragments/readme-task-form.md",
    // The form posts through sdk.submitTask(), not the data route, so no frontend_data.
    capabilities: [],
    strings: TASK_FORM_STRINGS,
    titleKey: () => "taskForm.title",
    applyToManifest(manifest, ctx) {
      addBundle(manifest, {
        type: "task-form",
        key: ctx.key ?? "review",
        title: ctx.options.name,
        path: "/bundles/task-form.html",
        // What makes GZAC call the plugin's submit() hook before completing the task.
        submitHandler: true,
      });
    },
  },

  page: {
    id: "page",
    summary: "user  — a menu-mounted page",
    defaultKey: () => "overview",
    typeImports: ["RequestInput"],
    valueImports: ["request"],
    handler: "request",
    frontend: {templateDir: "frontend-page", stem: "page"},
    readmeFragment: "fragments/readme-page.md",
    capabilities: ["frontend_data"],
    strings: PAGE_STRINGS,
    // A page's title is the only one GZAC resolves as a translation key rather than rendering
    // literally, so this key must exist in every declared bucket or the menu shows the key itself.
    titleKey: (ctx) => `page.${ctx.key ?? "overview"}.title`,
    applyToManifest(manifest, ctx) {
      const key = ctx.key ?? "overview";
      addBundle(manifest, {
        type: "page",
        key,
        title: `page.${key}.title`,
        icon: "icon mdi mdi-view-dashboard",
        path: "/bundles/page.html",
      });
    },
  },
};

/** The bundle types, in legend order — {@link PARTS} minus the backend-only `event`. */
export const BUNDLE_IDS: readonly PartId[] = (Object.keys(PARTS) as PartId[]).filter(
  (id) => id !== "event"
);

/** Every part, in declaration order. The order generated output is emitted in. */
export const PART_IDS: readonly PartId[] = Object.keys(PARTS) as PartId[];

/** True for a part id the CLI and the wizard accept under `--bundles`. */
export function isBundleId(value: string): value is PartId {
  return (BUNDLE_IDS as readonly string[]).includes(value);
}

/**
 * The descriptor and per-instance context for each selected part, in declaration order. Every
 * generic consumer — manifest, translations, imports, fragments, files — walks this.
 */
export function selectedParts(
  options: ScaffoldOptions
): Array<{descriptor: PartDescriptor; ctx: PartContext}> {
  return options.selection.map(({id, key}) => ({
    descriptor: PARTS[id],
    ctx: {options, id, key},
  }));
}

/** True when the selection contains a part that writes a `frontend/` bundle. */
export function hasFrontend(options: ScaffoldOptions): boolean {
  return options.selection.some(({id}) => PARTS[id].frontend !== null);
}

/**
 * The distinct handlers the selection needs, in declaration order — `request` appears once however
 * many of the three data-fetching bundles were chosen, paired with the first part that asked for it
 * so the fragment can be rendered against a real context.
 */
export function selectedHandlers(
  options: ScaffoldOptions
): Array<{handler: HandlerId; ctx: PartContext}> {
  const seen = new Set<HandlerId>();
  const handlers: Array<{handler: HandlerId; ctx: PartContext}> = [];
  for (const {descriptor, ctx} of selectedParts(options)) {
    const {handler} = descriptor;
    if (handler === null || seen.has(handler)) continue;
    seen.add(handler);
    handlers.push({handler, ctx});
  }
  return handlers;
}

/** Template path of one of a part's two frontend files, relative to `templates/`. */
export function frontendTemplatePath(frontend: PartFrontend, extension: "html" | "tsx"): string {
  return `${frontend.templateDir}/frontend/${frontend.stem}.${extension}`;
}

/** Where that file lands in the generated project. */
export function frontendTargetPath(frontend: PartFrontend, extension: "html" | "tsx"): string {
  return `frontend/${frontend.stem}.${extension}`;
}

/**
 * Appends a bundle unless one of the same type and key is already there. Bundles are the one thing
 * two parts could collide on, and `applyToManifest` is required to be idempotent.
 */
function addBundle(manifest: PluginManifest, bundle: FrontendBundle): void {
  const bundles = manifest.frontendBundles;
  if (bundles === undefined) return;
  if (bundles.some((existing) => existing.type === bundle.type && existing.key === bundle.key)) {
    return;
  }
  bundles.push(bundle);
}
