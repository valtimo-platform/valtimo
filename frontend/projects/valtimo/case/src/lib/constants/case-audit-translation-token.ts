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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {InjectionToken} from '@angular/core';

export type AuditEventTranslations = {
  [languageKey: string]: {[eventClassName: string]: string};
};

const CASE_AUDIT_TRANSLATION_TOKEN = new InjectionToken<AuditEventTranslations>(
  'Provide translations for custom audit events shown in the case detail audit tab.'
);

export {CASE_AUDIT_TRANSLATION_TOKEN};
