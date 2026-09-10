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

import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";
import {SDK_VERSION} from "./version";

describe("SDK_VERSION", () => {
  // The whole point of deriving it at runtime: the stamped `manifest.sdkVersion` is only
  // trustworthy while this holds, and there is no second copy to forget to bump.
  it("equals the version in the SDK's own package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
    expect(SDK_VERSION).toBe(pkg.version);
  });
});
