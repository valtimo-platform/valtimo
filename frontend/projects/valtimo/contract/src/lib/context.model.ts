/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

export interface Context {
  id: number;
  menuItems: Array<ContextMenuItem>;
  name: string;
  processes: Array<ContextProcess>;
  roles: Array<string>;
}

export interface ContextMenuItem {
  id: number;
  name: string;
  url: string;
}

export interface ContextProcess {
  name: string;
  key: string;
  processDefinitionKey: string;
  visibleInMenu: boolean;
}

export interface UserContextActiveProcess {
  category: string;
  deploymentId: string;
  description: string;
  diagram: string;
  historyTimeToLive: number;
  id: string;
  key: string;
  name: string;
  resource: string;
  startableInTasklist: boolean;
  suspended: false;
  tenantId: string;
  version: number;
  versionTag: string;
}
