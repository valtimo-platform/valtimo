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
export * from './lib/constants';
export * from './lib/models';
export * from './lib/services';

/* Editor extension points — case-management extends the base and projects its General tab; shell tabs stay internal. */
export * from './lib/components/migration-plan-editor/migration-plan-editor-base.component';
export * from './lib/components/migration-plan-editor/migration-plan-editor-shell/migration-plan-editor-shell.component';
export * from './lib/components/migration-plan-editor/migration-general-fields/migration-general-fields.component';
export * from './lib/components/migration-plan-editor/migration-status.utils';
