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

import {existsSync} from "node:fs";
import {join} from "node:path";
import {describe, expect, it} from "vitest";
import {HOST_CAPABILITIES, type PluginManifest} from "../models/index.js";
import {TEMPLATES_DIR, optionsFor} from "../test-support/scaffold-fixtures.js";
import {
  BUNDLE_IDS,
  HANDLER_FRAGMENTS,
  PARTS,
  PART_IDS,
  frontendTemplatePath,
  isBundleId,
  selectedHandlers,
  type PartId,
} from "./parts.js";

const ENTRIES = PART_IDS.map((id) => [id, PARTS[id]] as const);

function exists(templatePath: string): boolean {
  return existsSync(join(TEMPLATES_DIR, ...templatePath.split("/")));
}

describe("the part table", () => {
  it("keys every descriptor on its own id", () => {
    for (const [id, descriptor] of ENTRIES) {
      expect(descriptor.id, id).toBe(id);
    }
  });

  it("offers every frontend bundle type the platform knows, and only those", () => {
    // The whole point of this plan: no bundle type is privileged by being scaffoldable.
    expect([...BUNDLE_IDS].sort()).toEqual(
      ["case-tab", "case-widget", "config", "page", "process-link-action", "task-form"].sort()
    );
    expect(PART_IDS.filter((id) => !isBundleId(id))).toEqual(["event"]);
  });

  it("declares only capabilities the host actually grants", () => {
    for (const [id, descriptor] of ENTRIES) {
      for (const capability of descriptor.capabilities) {
        expect(HOST_CAPABILITIES, `${id}: ${capability}`).toContain(capability);
      }
    }
  });

  it("names templates that ship", () => {
    for (const [id, descriptor] of ENTRIES) {
      if (descriptor.frontend !== null) {
        for (const extension of ["html", "tsx"] as const) {
          const path = frontendTemplatePath(descriptor.frontend, extension);
          expect(exists(path), `${id}: ${path}`).toBe(true);
        }
      }
      if (descriptor.readmeFragment !== null) {
        expect(exists(descriptor.readmeFragment), `${id}: ${descriptor.readmeFragment}`).toBe(true);
      }
      if (descriptor.handler !== null) {
        const fragment = HANDLER_FRAGMENTS[descriptor.handler];
        expect(exists(fragment), `${id}: ${fragment}`).toBe(true);
      }
    }
  });

  it("gives every bundle type a frontend and a README section", () => {
    for (const id of BUNDLE_IDS) {
      expect(PARTS[id].frontend, id).not.toBeNull();
      expect(PARTS[id].readmeFragment, id).not.toBeNull();
    }
  });

  it("writes each bundle to a file stem of its own", () => {
    const stems = BUNDLE_IDS.map((id) => PARTS[id].frontend?.stem);

    expect(new Set(stems).size).toBe(stems.length);
  });

  it("translates every fixed string into Dutch", () => {
    // A key missing from `nl` is a silent English string in production, not a test failure —
    // unless it is asserted here.
    for (const [id, descriptor] of ENTRIES) {
      const {en, nl} = descriptor.strings;
      if (en === undefined) continue;
      expect(Object.keys(nl ?? {}).sort(), id).toEqual(Object.keys(en).sort());
      for (const key of Object.keys(en)) {
        expect(key.length, `${id}: ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("applies to a manifest idempotently", () => {
    for (const id of PART_IDS) {
      const options = optionsFor([id]);
      const [selection] = options.selection;
      const ctx = {options, id, key: selection.key};

      const once = base();
      PARTS[id].applyToManifest(once, ctx);
      const twice = base();
      PARTS[id].applyToManifest(twice, ctx);
      PARTS[id].applyToManifest(twice, ctx);

      expect(twice, id).toEqual(once);
    }
  });

  it("summarises each part in one line, for the wizard legend", () => {
    for (const [id, descriptor] of ENTRIES) {
      expect(descriptor.summary, id).not.toContain("\n");
      expect(descriptor.summary.length, id).toBeGreaterThan(0);
    }
  });
});

describe("selectedHandlers", () => {
  it("emits a shared handler once", () => {
    const handlers = selectedHandlers(optionsFor(["case-tab", "case-widget", "page"]));

    expect(handlers.map(({handler}) => handler)).toEqual(["request"]);
  });

  it("emits each distinct handler in declaration order, not selection order", () => {
    // `task-form` is declared before `page`, so `submit` precedes `request` however they were asked
    // for — the generated source must not depend on the order the author typed.
    const declared = ["onEvent", "submit", "request"];

    expect(selectedHandlers(optionsFor(["event", "page", "task-form"])).map((h) => h.handler)).toEqual(
      declared
    );
    expect(selectedHandlers(optionsFor(["task-form", "event", "page"])).map((h) => h.handler)).toEqual(
      declared
    );
  });

  it("pairs a handler with the first part that asked for it, so its key is a real one", () => {
    const [{ctx}] = selectedHandlers(optionsFor(["task-form"]));

    expect(ctx.key).toBe("review");
  });

  it("emits nothing for a selection with no backend counterpart", () => {
    expect(selectedHandlers(optionsFor(["config", "process-link-action"]))).toEqual([]);
  });
});

describe("default keys", () => {
  it.each([
    ["config", null],
    ["event", null],
    ["process-link-action", "my-plugin"],
    ["case-tab", "summary"],
    ["case-widget", "summary"],
    ["task-form", "review"],
    ["page", "overview"],
  ] as Array<[PartId, string | null]>)("%s -> %s", (id, expected) => {
    expect(PARTS[id].defaultKey(optionsFor([]))).toBe(expected);
  });
});

/** A manifest with the slots `applyToManifest` is allowed to fill, and nothing else. */
function base(): PluginManifest {
  return {
    pluginId: "my-plugin",
    version: "0.1.0",
    translations: {},
    permissions: {capabilities: ["log"]},
    frontendBundles: [],
    actions: [],
  };
}
