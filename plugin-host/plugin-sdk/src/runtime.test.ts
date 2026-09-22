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
import {action} from "./actions";
import {handleAction} from "./runtime";

const actionInput = (actionKey: string) =>
  JSON.stringify({
    actionKey,
    configurationId: "cfg-1",
    configuration: {},
    processInstanceId: "pi-1",
    documentId: "doc-1",
    activityId: "act-1",
    properties: {},
  });

describe("handleAction result serialization", () => {
  it("serializes undefined result values as explicit null so declared output keys stay on the wire", () => {
    // `JSON.stringify` drops keys whose value is `undefined`; the manifest outputs contract
    // requires every declared key to be present (null allowed), so the runtime must normalise.
    action("undefined-result-values", () => ({
      status: "completed",
      result: { summary: "a summary", title: undefined, amount: null },
    }));

    const output = JSON.parse(handleAction(actionInput("undefined-result-values")));

    expect(output).toEqual({
      status: "completed",
      result: { summary: "a summary", title: null, amount: null },
    });
  });

  it("leaves variables untouched — only the result channel is normalised", () => {
    action("undefined-variable-values", () => ({
      status: "completed",
      variables: { kept: 1, dropped: undefined },
      result: { key: undefined },
    }));

    const output = JSON.parse(handleAction(actionInput("undefined-variable-values")));

    expect(output.variables).toEqual({ kept: 1 });
    expect(output.result).toEqual({ key: null });
  });

  it("passes non-object results through unchanged", () => {
    action("scalar-result", () => ({ status: "completed", result: "just a string" }));

    const output = JSON.parse(handleAction(actionInput("scalar-result")));

    expect(output).toEqual({ status: "completed", result: "just a string" });
  });
});
