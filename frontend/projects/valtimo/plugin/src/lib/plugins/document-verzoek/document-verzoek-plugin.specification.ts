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

import {PluginSpecification} from '../../models';
import {DocumentVerzoekConfigurationComponent} from './components/document-verzoek-configuration/document-verzoek-configuration.component';
import {DOCUMENT_VERZOEK_PLUGIN_LOGO_BASE64} from './assets/document-verzoek-plugin-logo';

const documentVerzoekPluginSpecification: PluginSpecification = {
  pluginId: 'document-verzoek',
  pluginConfigurationComponent: DocumentVerzoekConfigurationComponent,
  pluginLogoBase64: DOCUMENT_VERZOEK_PLUGIN_LOGO_BASE64,
  pluginTranslations: {
    nl: {
      title: 'Document Verzoek',
      description:
        'De document-verzoek-plugin verwerkt events uit de Notificaties API voor het buiten GZAC toevoegen van EnkelvoudigeInformatieobjecten aan een bestaande Zaak. Het event bevat de referenties naar de Zaak en het aangemaakte Zaakinformatieobject dat de relatie met het document vastlegt.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'De naam van de huidige plugin-configuratie. Onder deze naam kan de configuratie in de rest van de applicatie teruggevonden worden.',
      notificatiesApiPluginConfiguration: 'Notificaties API-configuratie',
      zakenApiPlugin: 'Zaken API-plugin',
      documentenApiPlugin: 'Documenten API-plugin',
      zakenApiPluginTooltip:
        'Zaken API-plugin die wordt gebruikt om het Zaak Informatie Object op te halen',
      documentenApiPluginTooltip:
        'Documenten API-plugin die wordt gebruikt om het informatie object op te halen',
      informatieobjecttypeUrls: 'InformatieObject type Urls',
      type: 'Type',
      eventMessage: 'Message event naam',
      eventMessageTooltip:
        'naam van het event dat wordt gepubliceerd als een document van een zaak wordt onvangen',
      caseDefinitionKey: 'Dossier definitie',
      caseDefinitionKeyTooltip:
        'De naam van de dossier definitie van het dossier type dat verwerkt moet worden.',
      addInformatieobjecttypeUrl: 'voeg InformatieObject type Url toe',
      informatieobjecttypeUrlTooltip:
        'InformatieObject type Url waarvoor de notificatie binnen kunnen komen',
      documentVerzoekPropertiesTooltip:
        'De zaak typen waarvoor de notificatie binnen kunnen komen.',
      notificatiesApiPluginConfigurationTooltip:
        'Configuratie van de Notificaties API die wordt gebruikt om te communiceren tussen GZAC en andere applicaties.',
      typeTooltip: 'Het zaak type waarvoor document typen worden verwerkt',
      close: 'Sluiten',
      save: 'Opslaan',
    },
    en: {
      title: 'Document Verzoek',
      description:
        'The document verzoek plugin processes events from the Notifications API for adding EnkelvoudigeInformatieobjecten to an existing Zaak outside of GZAC. The event contains references to the Zaak and the created Zaakinformatieobject that captures the relationship with the document.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'The name of the current plugin configuration. Under this name, the configuration can be found in the rest of the application.',
      notificatiesApiPluginConfiguration: 'Notificaties API configuration',
      zakenApiPlugin: 'Zaken API-plugin',
      zakenApiPluginTooltip: 'Zaken API-plugin used to retrieve the Zaak Informatie Object',
      documentenApiPlugin: 'Documenten API-plugin',
      documentenApiPluginTooltip: 'Documenten API-plugin used to retrieve the information object',
      informatieobjecttypeUrls: 'InformatieObject type Urls',
      addInformatieobjecttypeUrl: 'Add InformatieObject type Url',
      informatieobjecttypeUrlTooltip:
        'InformatieObject type Urls that subscribe to process new document events.',
      type: 'Type',
      eventMessage: 'Message event name',
      eventMessageTooltip: 'name of the event that is published when a case document is received',
      caseDefinitionKey: 'Case definition',
      caseDefinitionKeyTooltip:
        'Case definition name of the type of Case type that needs to be processed.',
      addVerzoekType: 'Add document verzoek type',
      notificatiesApiPluginConfigurationTooltip:
        'Configuration of the Notificaties API used to communicate between GZAC and other applications.',
      typeTooltip: "The type of verzoek used to identify the object. Eg. 'verzoek'.",
      close: 'Close',
      save: 'Save',
    },
  },
};

export {documentVerzoekPluginSpecification};
