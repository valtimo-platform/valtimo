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

import type { ActionInput } from "@valtimo/external-plugin-sdk-be";
import {
  action,
  config,
  handle_action,
  log,
} from "@valtimo/external-plugin-sdk-be";

action("say-hello", (input: ActionInput) => {
  const greeting = (config.get("greeting") as string) || "Hello";
  const recipient = (input.properties.recipient as string) || "World";

  const message = `${greeting}, ${recipient}! (from plugin config ${input.configurationId})`;

  log.info(`[say-hello] ${message}`);

  return {
    status: "completed" as const,
    variables: {
      greetingMessage: message,
      pluginId: "say-hello",
      processInstanceId: input.processInstanceId,
    },
  };
});

// @ts-ignore — module.exports is used by the extism-js compiler
module.exports = { handle_action };
