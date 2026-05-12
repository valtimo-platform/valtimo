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

interface FrontendBundle {
  type: "config" | "process-link-action" | "case-tab" | "case-widget" | "page";
  key?: string;
  title?: string;
  path: string;
  activityTypes?: string[];
  menuIcon?: string;
  menuPosition?: string;
  renderMode?: "bundle" | "htmx";
}

export interface PluginManifest {
  pluginId: string;
  version: string;
  name: string;
  description?: string;
  provider?: string;
  compatibility?: {
    minGzacVersion?: string;
    maxGzacVersion?: string;
  };
  configurationSchema?: Record<string, unknown>;
  frontendBundles?: Array<FrontendBundle>;
  actions: Array<{
    key: string;
    title: string;
    description?: string;
    activityTypes: string[];
    properties?: Array<{
      key: string;
      type: string;
      required?: boolean;
    }>;
  }>;
}

export type { FrontendBundle };
