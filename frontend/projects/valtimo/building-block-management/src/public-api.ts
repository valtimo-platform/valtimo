/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

/*
 * Public API Surface of building-block-management
 */

export * from './lib/building-block-management.module';
export * from './lib/models';
export * from './lib/services';

/* The blueprint-agnostic half of the migration plan editor; `@valtimo/case-management` builds its own editor out of these. */
export * from './lib/components/migration-plan-editor/migration-plan.utils';
export * from './lib/components/migration-plan-editor/tabs/migration-building-block-tab.component';
export * from './lib/components/migration-plan-editor/tabs/migration-data-migration-tab.component';
export * from './lib/components/migration-plan-editor/tabs/migration-general-fields.component';
export * from './lib/components/migration-plan-editor/tabs/migration-process-migration-tab.component';
