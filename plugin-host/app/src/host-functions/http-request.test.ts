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

import {describe, expect, it} from "vitest";
import {redactUrl} from "./http-request";

describe("redactUrl", () => {
  it("strips the query string (tokens routinely travel there)", () => {
    expect(redactUrl("https://api.example.com/v1/items?apiKey=SECRET&x=1")).toBe(
      "https://api.example.com/v1/items"
    );
  });

  it("strips userinfo credentials", () => {
    expect(redactUrl("https://user:hunter2@api.example.com/v1/items")).toBe(
      "https://api.example.com/v1/items"
    );
  });

  it("strips fragments and keeps the port", () => {
    expect(redactUrl("https://api.example.com:8443/v1/items#section?x=1")).toBe(
      "https://api.example.com:8443/v1/items"
    );
  });

  it("degrades gracefully for an unparseable URL", () => {
    expect(redactUrl("not a url?secret=1")).toBe("not a url");
  });
});
