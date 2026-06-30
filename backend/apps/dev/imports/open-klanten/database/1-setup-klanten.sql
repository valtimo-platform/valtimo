/*
 * Copyright 2015-2021 Ritense BV, the Netherlands.
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

INSERT INTO accounts_user VALUES (1, 'pbkdf2_sha256$150000$804RI2AKro7g$4bToWwzuZO7OtruzIi6VRshCwshQVgxFTwF7ZOYowRg=', '2021-09-22 21:28:40.15254+00', true, 'admin', '', '', 'admin@exmaple.com', true, true, '2021-09-22 14:13:43.383088+00');

INSERT INTO token_tokenauth (token, contact_person, email, organization, last_modified, created, application, administration, identifier) VALUES ('5bf819967d9fdd00d326ce20774768b4182285e5', 'ritense', 'support@ritense.com', 'Ritense', '2025-07-18 14:54:21.492 +0200', '2025-07-18 14:54:21.492 +0200', 'GZAC', '', 'valtimo_client');

INSERT INTO klantinteracties_partij(bezoekadres_nummeraanduiding_id, bezoekadres_adresregel1, bezoekadres_adresregel2, bezoekadres_adresregel3, bezoekadres_land, correspondentieadres_nummeraanduiding_id, correspondentieadres_adresregel1, correspondentieadres_adresregel2, correspondentieadres_adresregel3, correspondentieadres_land, uuid, nummer, interne_notitie, soort_partij, voorkeurstaal, indicatie_actief, bezoekadres_huisnummertoevoeging, bezoekadres_postcode, bezoekadres_stad, bezoekadres_straatnaam, correspondentieadres_huisnummertoevoeging, correspondentieadres_postcode, correspondentieadres_stad, correspondentieadres_straatnaam) VALUES ( '', '', '', '', 'NL', '', '', '', '', '', 'b39c60c0-6575-42bf-b9e2-5fb4f4c56f3f', '0000000001', '', 'persoon', '', 'false', '', '', '', '', '', '', '', '');
INSERT INTO klantinteracties_partijidentificator(uuid, andere_partij_identificator, partij_identificator_code_objecttype, partij_identificator_code_soort_object_id, partij_identificator_object_id, partij_identificator_code_register, partij_id) VALUES ('ac2a3e9d-d3bb-483b-8085-b2aeecb0b169', '', 'natuurlijk_persoon', 'bsn', '569312863', 'brp', 1);
INSERT INTO klantinteracties_persoon(contactnaam_voorletters, contactnaam_voornaam, contactnaam_voorvoegsel_achternaam, contactnaam_achternaam, partij_id) VALUES ('', 'Peter', 'van', 'Klaver', 1);
INSERT INTO contactgegevens_persoon(adres_adresregel1, adres_adresregel2, adres_adresregel3, adres_land, uuid, geboortedatum, geslachtsnaam, geslacht, voorvoegsel, voornamen, adres_nummeraanduiding_id, adres_huisnummer, adres_huisnummertoevoeging, adres_postcode, adres_stad, adres_straatnaam) VALUES ('', '', '', 'NL', '5200dd6f-95c3-4448-8e20-0f7afe498f48', '1870-01-01', 'Klaver', 'm', 'van', 'Peter', '', '1', 'A', '1111 AA', 'Amsterdam', 'Pettenflet');
