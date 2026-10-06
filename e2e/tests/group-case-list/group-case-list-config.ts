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

export const MEMBER_KEYS = ['bezwaar', 'verhuizing'] as const;

/** Applicant name per case type: same meaning, different document schema. */
export const DOC_PATHS: Record<string, string> = {
  bezwaar: 'doc:achternaam',
  verhuizing: 'doc:aanvrager.naam',
};

/** verhuizing requires these fields; its process is not started. */
export const verhuizingContent = (applicantName: string) => ({
  aanvrager: {naam: applicantName},
  status: 'ingediend',
  scenario: 'e2e',
});

/** Both define the internal status `aanvraag-ontvangen`. */
export const SHARED_STATUS_MEMBER_KEYS = ['bezwaar', 'energy-subsidy-request'] as const;
export const SHARED_STATUS_TITLE = 'Aanvraag ontvangen';

/** Cell index per column; 0 is the row selection checkbox. */
export const CELL = {createdOn: 1, name: 2, status: 3} as const;
