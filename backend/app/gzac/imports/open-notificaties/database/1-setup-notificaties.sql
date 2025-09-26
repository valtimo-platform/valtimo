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

INSERT INTO authorizations_applicatie VALUES (1, '003aa834-4d24-4335-80aa-9a57555dcbe8', '{objectsapi}', 'ObjectsAPI', true);
INSERT INTO authorizations_applicatie VALUES (2, '1f5cb913-caa3-433b-851d-9a371a0c93a8', '{valtimo}', 'Valtimo', true);
INSERT INTO authorizations_applicatie VALUES (3, 'd346a22a-7f6a-48ef-99f2-4439c3f8f17d', '{openzaak}', 'Open Zaak', true);

INSERT INTO authorizations_authorizationsconfig VALUES (1, 'http://openzaak:8000/autorisaties/api/v1/', 'nrc');

INSERT INTO notifications_notificationsconfig VALUES (1, 'https://open-notificaties/api/v1/');

INSERT INTO vng_api_common_apicredential VALUES (1, 'http://openzaak:8000/autorisaties/api/v1/', 'opennotificaties', 'opennotificaties', 'openzaak', 'opennotificaties', 'opennotificaties');

INSERT INTO vng_api_common_jwtsecret VALUES (1, 'objectsapi', '9wu2''''Z`[x(eEk![:.$mBT6&:F!,%)EY74TS.AU+6');
INSERT INTO vng_api_common_jwtsecret VALUES (2, 'valtimo', 'zZ!xRP&$qTn4A9ETa^ZMKepDm^8egjPz');
INSERT INTO vng_api_common_jwtsecret VALUES (3, 'openzaak', 'openzaak');

INSERT INTO datamodel_kanaal VALUES(1, 'e069e3f0-6d5b-40ac-91fb-ad16384c5851', 'zaken', '', '{}');
INSERT INTO datamodel_kanaal VALUES(2, '132e72c8-59b4-46c3-ab77-3c9b43738d51', 'documenten', '', '{}');
INSERT INTO datamodel_kanaal VALUES(3, 'ed8f505d-6247-4357-bf0e-50e75609d4e8', 'besluiten', '', '{}');
INSERT INTO datamodel_kanaal VALUES(4, 'f4636227-e02c-4a49-8eaa-1908bb1a1e68', 'autorisaties', '', '{}');
INSERT INTO datamodel_kanaal VALUES(5, 'e3e3b1bc-8433-41a3-87b7-a08b83156e93', 'zaaktypen', '', '{}');
INSERT INTO datamodel_kanaal VALUES(6, 'a6fcc591-f9a5-4e44-b789-f8a4a86914b9', 'informatieobjecttypen', '', '{}');
INSERT INTO datamodel_kanaal VALUES(7, 'bffea38a-3aa2-4212-be7d-a7b1233a7408', 'besluittypen', '', '{}');

SELECT pg_catalog.setval('datamodel_kanaal_id_seq', 7, true);