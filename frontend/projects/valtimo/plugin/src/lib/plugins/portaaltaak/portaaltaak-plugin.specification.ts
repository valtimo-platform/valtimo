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

import {PluginSpecification} from '../../models';
import {PortaaltaakConfigurationComponent} from './components/portaaltaak-configuration/portaaltaak-configuration.component';
import {PORTAALTAAK_PLUGIN_LOGO_BASE64} from './assets/portaaltaak-plugin-logo';
import {CreatePortalTaskComponent} from './components/create-portal-task/create-portal-task.component';
import {CompletePortalTaskComponent} from './components/complete-portal-task/complete-portal-task.component';

const portaaltaakPluginSpecification: PluginSpecification = {
  pluginId: 'portaaltaak',
  pluginConfigurationComponent: PortaaltaakConfigurationComponent,
  pluginLogoBase64: PORTAALTAAK_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'create-portaaltaak': CreatePortalTaskComponent,
    'complete-portaaltaak': CompletePortalTaskComponent,
  },
  pluginTranslations: {
    nl: {
      title: 'Portaaltaak',
      description: 'Een component om een portaaltaakrouteringscomponent te benaderen.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'De naam van de huidige plugin-configuratie. Onder deze naam kan de configuratie in de rest van de applicatie teruggevonden worden.',
      notificatiesApiPluginConfiguration: 'Notificaties API plugin',
      notificatiesApiPluginConfigurationTooltip:
        'Selecteer de Notificaties API plugin. Wanneer de selectiebox leeg us, zal de notificatie API plugin eerst aangemaakt moeten worden.',
      objectManagementConfiguration: 'Object management configuratie',
      objectManagementConfigurationTooltip:
        'Selecteer de gewenste object management configuratie. Wanneer de selectiebox leeg is, zal de object management configuratie eerst aangemaakt moeten worden.',
      'create-portaaltaak': 'Portaaltaak aanmaken',
      'complete-portaaltaak': 'Portaaltaak afronden',
      formType: 'Formuliertype',
      formTypeTooltip:
        'Kies hier of het te tonen formulier afomstig moet zijn van een ingestelde definitie, of van een externe URL.',
      id: 'Formulierdefinitie',
      url: 'URL',
      formTypeId: 'Formulier ID',
      formTypeIdTooltip: 'Het ID van het formulier dat getoond moet worden',
      formTypeUrl: 'Formulier URL',
      formTypeUrlTooltip: 'Een URL die wijst naar het formulier dat getoond moet worden',
      sendData: 'Taakgegevens voor de ontvanger',
      sendDataTooltip:
        "Voor hier sleutels en waarden in voor data die verstuurd moet worden naar de Objecten API. De sleutel is hier de sleutel van het Form.IO-veld dat gevuld moet worden (bijvoorbeeld 'firstName'). De waarde wijst naar de data waarmee dit veld gevuld moet worden (bijvoorbeeld 'doc:/customer/firstName').",
      receiveData: 'Ingevulde gegevens door de ontvanger',
      receiveDataTooltip:
        "Voor hier sleutels en waarden in voor data die ontvangen moet worden van de Objecten API. De sleutel is hier de locatie waar de data opgeslagen moet worden (bijvoorbeeld 'doc:/customer/signedAgreement'). De waarde wijst naar de sleutel van het Form.IO-veld waar de data vandaan moet komen (bijvoorbeeld '/signedAgreement').",
      receiver: 'Ontvanger',
      receiverTooltip: 'Bepaal hier bij wie de data van de afgeronde taak terecht moet komen.',
      zaakInitiator: 'Zaak-initiator',
      other: 'Anders',
      otherReceiver: 'Andere ontvanger',
      otherReceiverTooltip:
        'U heeft de optie geselecteerd voor een andere ontvanger. Selecteer hier welk type dit moet zijn.',
      kvk: 'KVK-nummer',
      bsn: 'Burgerservicenummer (BSN)',
      kvkTooltip: 'Het KVK-nummer van de gewenste ontvanger.',
      bsnTooltip: 'Het Burgerservicenummer (BSN) van de gewenste ontvanger.',
      completeTaakProcess: 'Geüploade documentverwerkingsproces',
      completeTaakProcessTooltip:
        'Het proces dat de geüploade documenten in de portal moet afhandelen.',
      identificationKey: 'Identificatiesleutel',
      identificationKeyTooltip:
        "De ingevoerde sleutel bepaalt hoe de ontvanger wordt geïdentificeerd. Geldige voorbeelden zijn 'bsn' of 'kvk'.",
      identificationValue: 'Identificatiewaarde',
      identificationValueTooltip:
        "De waarde waarmee de ontvanger wordt geïdentificeerd. Wanneer er bijvoorbeeld in het veld 'Identificatiesleutel' de waarde 'bsn' is ingevoerd, kan er in dit veld een burgerservicenummer worden ingevoerd (bijvoorbeeld 558099476).",
      verloopDurationInDays: 'Verlooptijd taak in dagen',
      verloopDurationInDaysTooltip:
        'Het aantal dagen na aanmaken van een taak dat deze verloopt. Deze wordt alleen ingesteld voor de portaal taak, niet in het BPMN proces.',
    },
    en: {
      title: 'Portal task',
      description: 'A component to access a portal task routing component.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'The name of the current plugin configuration. Under this name, the configuration can be found in the rest of the application.',
      notificatiesApiPluginConfiguration: 'Notificaties API plugin',
      notificatiesApiPluginConfigurationTooltip:
        'Select the Notificaties API plugin. If the selection box remains empty, the Notificaties API plugin will first have to be created.',
      objectManagementConfiguration: 'Object management configuration',
      objectManagementConfigurationTooltip:
        'Select the object management configuration. If the selection box remains empty, the object management configuration will first have to be created.',
      'create-portaaltaak': 'Create portal task',
      'complete-portaaltaak': 'Complete portal task',
      formType: 'Form type',
      formTypeTooltip:
        'Choose here whether the form to be displayed should come from a set definition or from an external URL.',
      id: 'Form definition',
      url: 'URL',
      formTypeId: 'Formulier ID',
      formTypeIdTooltip: 'Het ID van het formulier dat getoond moet worden',
      formTypeUrl: 'Formulier URL',
      formTypeUrlTooltip: 'Een URL die wijst naar het formulier dat getoond moet worden',
      sendData: 'Task data for the recipient',
      sendDataTooltip:
        "Enter keys and values here for data to be sent to the Objecten API. The key here is the key of the Form.IO field to be populated (e.g. 'firstName'). The value points to the data with which this field must be filled (e.g. 'doc:/customer/firstName').",
      receiveData: 'Information entered by the recipient',
      receiveDataTooltip:
        "Enter keys and values here for data to be received from the Objecten API. The key here is the location where the data should be stored (e.g. 'doc:/customer/signedAgreement'). The value points to the key of the Form.IO field where the data should come from (e.g. '/signedAgreement').",
      receiver: 'Receiver',
      receiverTooltip: 'Determine here who should receive the data of the completed task.',
      zaakInitiator: 'Case initiator',
      other: 'Other',
      otherReceiver: 'Other receiver',
      otherReceiverTooltip:
        'You have selected the option for another receiver. Select here which type this should be.',
      kvk: 'KVK number',
      bsn: 'Citizen service number (BSN)',
      kvkTooltip: 'The KVK number of the desired receiver.',
      bsnTooltip: 'The Citizen service number (BSN) of the desired receiver',
      completeTaakProcess: 'Process to complete Portaaltaak',
      completeTaakProcessTooltip:
        'The process that should handle the uploaded documents in the portal.',
      identificationKey: 'Identification key',
      identificationKeyTooltip:
        "The key entered determines how the recipient is identified. Valid examples are 'bsn' or 'kvk'.",
      identificationValue: 'Identification value',
      identificationValueTooltip:
        "The value that identifies the recipient. For example, if the value 'bsn' is entered in the 'Identification key' field, a citizen service number can be entered in this field (for example 558099476).",
      verloopDurationInDays: 'Number of days for the task to expire',
      verloopDurationInDaysTooltip:
        'The number of days from the creation time until the task expires. This will only be used in the portal task. The BPMN due date needs to be configured separately.',
    },
    de: {
      title: 'Portalaufgabe',
      description:
        'Eine Komponente für den Zugriff auf eine Portal-Aufgabenweiterleitungskomponente.',
      configurationTitle: 'Konfigurationsname',
      configurationTitleTooltip:
        'Der Name der aktuellen Plugin-Konfiguration. Unter diesem Namen ist die Konfiguration im Rest der Anwendung zu finden.',
      notificatiesApiPluginConfiguration: 'Benachrichtigungs-API plugin',
      notificatiesApiPluginConfigurationTooltip:
        'Wählen Sie das Benachrichtigungs-API-Plugin aus. Bleibt das Auswahlfeld leer, muss das Benachrichtigungs-API-Plugin erst erstellt werden',
      objectManagementConfiguration: 'Objektverwaltungskonfiguration',
      objectManagementConfigurationTooltip:
        'Wählen Sie die Objektverwaltungskonfiguration aus. Bleibt das Auswahlfeld leer, muss zunächst die Objektverwaltungskonfiguration erstellt werden.',
      'create-portaaltaak': 'Portalaufgabe erstellen',
      'complete-portaaltaak': 'Portaaltaak komplett',
      formType: 'Formulartyp',
      formTypeTooltip:
        'Wählen Sie hier aus, ob das anzuzeigende Formular aus einer Set-Definition oder von einer externen URL stammen soll.',
      id: 'Formulardefinition',
      url: 'URL',
      sendData: 'Auftragsdaten für den Empfänger',
      sendDataTooltip:
        "Geben Sie hier Schlüssel und Werte für Daten ein, die an die Objecten API gesendet werden sollen. Der Schlüssel hier ist der Schlüssel des Form.IO-Felds, das gefüllt werden soll (z. B. 'firstName‘). Der Wert zeigt auf die Daten, mit denen dieses Feld gefüllt wird muss ausgefüllt werden (z.B. 'doc:/customer/firstName').",
      receiveData: 'Vom Empfänger eingegebene Informationen',
      receiveDataTooltip:
        "Geben Sie hier Schlüssel und Werte für Daten ein, die von der Objecten API empfangen werden sollen. Der Schlüssel hier ist der Ort, an dem die Daten gespeichert werden sollen (z. B. 'doc:/customer/signedAgreement'). Der Wert zeigt auf den Schlüssel des Form.IO-Feld, aus dem die Daten stammen sollen (z. B. '/signedAgreement').",
      receiver: 'Empfänger',
      receiverTooltip:
        'Bestimmen Sie hier, wer die Daten der abgeschlossenen Aufgabe erhalten soll.',
      zaakInitiator: 'Initiator des Falles',
      other: 'Andere',
      otherReceiver: 'Anderer Empfänger',
      otherReceiverTooltip:
        'Sie haben die Option für einen anderen Empfänger gewählt. Wählen Sie hier aus, welcher Typ das sein soll.',
      kvk: 'KVK-Nummer',
      bsn: 'Bürgerservicenummer (BSN)',
      kvkTooltip: 'Die KVK-Nummer des gewünschten Empfängers.',
      bsnTooltip: 'Die Bürgerservicenummer (BSN) des gewünschten Empfängers.',
      completeTaakProcess: 'Handhabungsprozess für hochgeladene Dokumente',
      completeTaakProcessTooltip:
        'Der Prozess, der die hochgeladenen Dokumente im Portal handhaben soll.',
      identificationKey: 'Identifikationsschlüssel',
      identificationKeyTooltip:
        "Der eingegebene Schlüssel bestimmt, wie der Empfänger identifiziert wird. Gültige Beispiele sind 'bsn' oder 'kvk'.",
      identificationValue: 'Identifikationswert',
      identificationValueTooltip:
        "Der Wert, der den Empfänger identifiziert. Wird beispielsweise im Feld 'Identifikationsschlüssel' der Wert 'bsn' eingetragen, kann in diesem Feld eine Sozialversicherungsnummer eingetragen werden (z. B. 558099476).",
      verloopDurationInDays: 'Ablaufzeit der Aufgabe in Tagen',
      verloopDurationInDaysTooltip:
        'Die Anzahl der Tage vom Erstellungszeitpunkt bis zum Ablauf der Aufgabe. Dies wird nur in der Portalaufgabe verwendet. Das BPMN-Fälligkeitsdatum muss separat konfiguriert werden.',
    },
  },
};

export {portaaltaakPluginSpecification};
