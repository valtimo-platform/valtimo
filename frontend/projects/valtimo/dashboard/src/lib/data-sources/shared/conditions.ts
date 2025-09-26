/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

const CONDITIONS_HELPER_TEXTS = {
  DE: (example = 'case:createdBy') =>
    `Zum Beispiel: ‘${example}’, ‘Not equal to’, ‘test@test.com’. Um mit leeren Werten zu vergleichen, kann ‘\${null}’ als Wert verwendet werden. Um mit dem aktuellen Datum zu vergleichen, kann ‘\${localDateTimeNow}’ als Wert verwendet werden. Zusätzlich wird Logik wie ‘\${localDateTimeNow.minusWeeks(2)}’ unterstützt. Die Platzhalter ‘\${currentUserId}’, ‘\${currentUserEmail}’ und ‘\${currentUserIdentifier}’ ermöglichen die Anzeige personalisierter Informationen für den aktuellen Dashboard-Benutzer.`,
  NL: (example = 'case:createdBy') =>
    `Bijvoorbeeld: ‘${example}’, ‘Not equal to’, ‘test@test.com’. Om te vergelijken met lege waarden, kun je ‘\${null}’ gebruiken als waarde. Om te vergelijken met de huidige datum, gebruik je ‘\${localDateTimeNow}’ als waarde. Hier wordt logica zoals ‘\${localDateTimeNow.minusWeeks(2)}’ ondersteund. De placeholders ‘\${currentUserId}’, ‘\${currentUserEmail}’ en ‘\${currentUserIdentifier}’ maken het mogelijk om gepersonaliseerde informatie weer te geven voor de huidige dashboardgebruiker.`,
  EN: (example = 'case:createdBy') =>
    `For example: '${example}', 'Not equal to', 'test@test.com'. To compare against empty values, you can use '\${null}' as a value. To compare with the current date, use '\${localDateTimeNow}' as a value. Additionally, logic such as '\${localDateTimeNow.minusWeeks(2)}' is supported. The placeholders '\${currentUserId}', '\${currentUserEmail}', and '\${currentUserIdentifier}' enable the display of personalized information for the current dashboard user.`,
};

export {CONDITIONS_HELPER_TEXTS};
