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

import {AuditEntry, PlanTarget} from './plan-editor.page';

/** One deployed fixture plan, with the target that locates it in the editor. */
export interface Fixture extends PlanTarget {
  label: string;
  plan: Record<string, any>;
}

/** What replaying one fixture through the editor produced. */
export interface PlanResult {
  plan: string;
  saved: boolean;
  reason?: string;
  differences: string[];
  audit: AuditEntry[];
  /** Set when the fixture could not be put back — a plan the save path refuses needs a redeploy. */
  restoreFailed?: string;
}
