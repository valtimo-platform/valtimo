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

/**
 * Namespace for every key this suite writes. Translations are stored as one nested JSON object
 * per language, so keeping all test data under a single top-level key makes both the assertions
 * and the cleanup unambiguous.
 */
export const TRANSLATION_PREFIX = 'e2eTranslationManagement';

/** Languages the dev application is configured with, in table column order. */
export const LANGUAGE_KEYS = ['en', 'nl'];

export const SEEDED = {
  alpha: `${TRANSLATION_PREFIX}.alpha`,
  beta: `${TRANSLATION_PREFIX}.beta`,
};

export const SEEDED_CONTENT = {
  en: {alpha: 'Alpha English', beta: 'Beta English'},
  nl: {alpha: 'Alpha Nederlands', beta: 'Beta Nederlands'},
};

export const EXPECTED_COLUMN_TITLES = ['Key', 'English', 'Nederlands'];
