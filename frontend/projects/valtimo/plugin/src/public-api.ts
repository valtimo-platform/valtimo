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

/*
 * Public API Surface of plugin
 */

export * from './lib/services';
export * from './lib/models';
export * from './lib/pipes';
export * from './lib/constants';
/* plugin configuration container */
export * from './lib/components/plugin-configuration-container/plugin-configuration-container.component';
export * from './lib/components/plugin-configuration-container/plugin-configuration-container.module';
/* open-zaak plugin */
export * from './lib/plugins/open-zaak/open-zaak-plugin.module';
export * from './lib/plugins/open-zaak/components/open-zaak-configuration/open-zaak-configuration.component';
export * from './lib/plugins/open-zaak/open-zaak-plugin.specification';
/* object token authentication plugin */
export * from './lib/plugins/object-token-authentication/object-token-authentication-plugin.module';
export * from './lib/plugins/object-token-authentication/object-token-authentication-plugin.specification';
export * from './lib/plugins/object-token-authentication/components/object-token-authentication-configuration/object-token-authencation-configuration.component';
/* smart-documents plugin */
export * from './lib/plugins/smart-documents/smart-documents-plugin.module';
export * from './lib/plugins/smart-documents/smart-documents-plugin.specification';
export * from './lib/plugins/smart-documents/components/smart-documents-configuration/smart-documents-configuration.component';
export * from './lib/plugins/smart-documents/components/generate-document-configuration/generate-document-configuration.component';
export * from './lib/plugins/smart-documents/components/get-template-names/get-template-names.component';
/* documenten api plugin */
export * from './lib/plugins/documenten-api/documenten-api-plugin.module';
export * from './lib/plugins/documenten-api/documenten-api-plugin.specification';
export * from './lib/plugins/documenten-api/models/config';
export * from './lib/plugins/documenten-api/components/store-temp-document/store-temp-document-configuration.component';
export * from './lib/plugins/documenten-api/components/documenten-api-configuration/documenten-api-configuration.component';
export * from './lib/plugins/documenten-api/components/store-uploaded-document/store-uploaded-document-configuration.component';
export * from './lib/plugins/documenten-api/components/download-document/download-document-configuration.component';
/* objecttypen api plugin */
export * from './lib/plugins/objecttypen-api/objecttypen-api-plugin-module';
export * from './lib/plugins/objecttypen-api/objecttypen-api-plugin.specification';
export * from './lib/plugins/objecttypen-api/components/objecttypen-api-configuration/objecttypen-api-configuration.component';
/* zaken api plugin */
export * from './lib/plugins/zaken-api/zaken-api-plugin.module';
export * from './lib/plugins/zaken-api/zaken-api-plugin.specification';
export * from './lib/plugins/zaken-api/components/zaken-api-configuration/zaken-api-configuration.component';
export * from './lib/plugins/zaken-api/components/link-document-to-zaak/link-document-to-zaak-configuration.component';
export * from './lib/plugins/zaken-api/components/set-zaak-status/set-zaak-status-configuration.component';
export * from './lib/plugins/zaken-api/components/create-zaak-resultaat/create-zaak-resultaat-configuration.component';
export * from './lib/plugins/zaken-api/components/link-uploaded-document-to-zaak/link-uploaded-document-to-zaak-configuration.component';
export * from './lib/plugins/zaken-api/components/create-natuurlijk-persoon-zaak-rol/create-natuurlijk-persoon-zaak-rol.component';
export * from './lib/plugins/zaken-api/components/create-niet-natuurlijk-persoon-zaak-rol/create-niet-natuurlijk-persoon-zaak-rol.component';
export * from './lib/plugins/zaken-api/components/create-zaak/create-zaak-configuration.component';
export * from './lib/plugins/zaken-api/components/set-zaakopschorting/set-zaakopschorting.component';
export * from './lib/plugins/zaken-api/components/start-hersteltermijn/start-hersteltermijn-configuration.component';
export * from './lib/plugins/zaken-api/components/end-hersteltermijn/end-hersteltermijn.component';
export * from './lib/plugins/zaken-api/components/create-zaakeigenschap/create-zaakeigenschap.component';
export * from './lib/plugins/zaken-api/components/update-zaakeigenschap/update-zaakeigenschap.component';
export * from './lib/plugins/zaken-api/components/delete-zaakeigenschap/delete-zaakeigenschap.component';
/* objecten api plugin */
export * from './lib/plugins/objecten-api/objecten-api-plugin-module';
export * from './lib/plugins/objecten-api/objecten-api-plugin.specification';
export * from './lib/plugins/objecten-api/components/objecten-api-configuration/objecten-api-configuration.component';
export * from './lib/plugins/objecten-api/components/delete-object/delete-object.component';
/* catalogi api plugin */
export * from './lib/plugins/catalogi-api/catalogi-api-plugin-module';
export * from './lib/plugins/catalogi-api/catalogi-api-plugin.specification';
export * from './lib/plugins/catalogi-api/components/catalogi-api-configuration/catalogi-api-configuration.component';
export * from './lib/plugins/catalogi-api/components/get-besluittype/get-besluittype-configuration.component';
export * from './lib/plugins/catalogi-api/components/get-resultaattype/get-resultaattype-configuration.component';
export * from './lib/plugins/catalogi-api/components/get-statustype/get-statustype-configuration.component';
/* notificaties api plugin */
export * from './lib/plugins/notificaties-api/notificaties-api-plugin.module';
export * from './lib/plugins/notificaties-api/notificaties-api-plugin.specification';
export * from './lib/plugins/notificaties-api/components/notificaties-api-configuration/notificaties-api-configuration.component';
/* notificaties api authentication plugin */
export * from './lib/plugins/notificaties-api-authentication/open-notificaties-plugin.module';
export * from './lib/plugins/notificaties-api-authentication/open-notificaties-plugin.specification';
export * from './lib/plugins/notificaties-api-authentication/components/open-notificaties-configuration/open-notificaties-configuration.component';
/* portaaltaak plugin */
export * from './lib/plugins/portaaltaak/portaaltaak-plugin.module';
export * from './lib/plugins/portaaltaak/portaaltaak-plugin.specification';
export * from './lib/plugins/portaaltaak/components/portaaltaak-configuration/portaaltaak-configuration.component';
export * from './lib/plugins/portaaltaak/components/create-portal-task/create-portal-task.component';
export * from './lib/plugins/portaaltaak/components/complete-portal-task/complete-portal-task.component';
/* verzoek plugin */
export * from './lib/plugins/verzoek/verzoek-plugin.module';
export * from './lib/plugins/verzoek/verzoek-plugin.specification';
export * from './lib/plugins/verzoek/components/verzoek-configuration/verzoek-configuration.component';
/* besluiten plugin */
export * from './lib/plugins/besluiten-api/besluiten-api-plugin.module';
export * from './lib/plugins/besluiten-api/besluiten-api-plugin.specification';
export * from './lib/plugins/besluiten-api/components/besluiten-api-configuration/besluiten-api-configuration.component';
export * from './lib/plugins/besluiten-api/components/create-zaak-besluit/create-zaak-besluit-configuration.component';
export * from './lib/plugins/besluiten-api/components/link-document-to-besluit/link-document-to-besluit-configuration.component';
/* exact */
export * from './lib/plugins/exact/exact.plugin.specification';
export * from './lib/plugins/exact/exact-plugin.module';
