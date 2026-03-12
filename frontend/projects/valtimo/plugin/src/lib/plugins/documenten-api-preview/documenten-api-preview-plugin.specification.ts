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
import {DocumentenApiPreviewConfigurationComponent} from './components/documenten-api-preview-configuration/documenten-api-preview-configuration.component';
import {DOCUMENTEN_API_PREVIEW_PLUGIN_LOGO_BASE64} from './assets';

const documentenApiPreviewPluginSpecification: PluginSpecification = {
  pluginId: 'documentenapipreview',
  pluginConfigurationComponent: DocumentenApiPreviewConfigurationComponent,
  pluginLogoBase64: DOCUMENTEN_API_PREVIEW_PLUGIN_LOGO_BASE64,
  pluginTranslations: {
    nl: {
      title: 'Documenten API Preview',
      description: 'Plugin voor het weergeven (preview) van documenten binnen GZAC.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'Hier kunt je een eigen naam verzinnen. Onder deze naam zal de plugin te herkennen zijn in de rest van de applicatie',
      pdfConversionUrl: 'PDF Conversie URL',
      pdfConversionUrlTooltip:
        'In dit veld moet de verwijzing komen naar de locatie van de PDF conversie server (Project Gotenberg).',
      documentenApiPluginConfiguration: 'Configuratie documenten-api plug-in',
      documentenApiPluginConfigurationTooltip:
        'Selecteer de plugin die gebruikt wordt voor het ontsluiten van documenten. Deze plugin zal worden gebruikt om de originele documenten te ontsluiten zodat deze geconverteerd kunnen worden naar PDF voor weergave in GZAC.',
    },
    en: {
      title: 'Documenten API Preview',
      description: 'Plugin to allow previewing documents directly in the GZAC.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'Here you can enter a name for the plugin. This name will be used to recognize the plugin throughout the rest of the application',
      pdfConversionUrl: 'PDF Conversion URL',
      pdfConversionUrlTooltip: 'This field must contain the URL to the PDF conversion server.',
      documentenApiPluginConfiguration: 'Document API configuration',
      documentenApiPluginConfigurationTooltip:
        'Select the plugin that can access the documents. This plugin will be used to access the original document so it can be convert it to PDF and previewed in GZAC.',
    },
  },
};

export {documentenApiPreviewPluginSpecification};
