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
import {ZAKEN_API_PLUGIN_LOGO_BASE64} from './assets';
import {LinkDocumentToZaakConfigurationComponent} from './components/link-document-to-zaak/link-document-to-zaak-configuration.component';
import {ZakenApiConfigurationComponent} from './components/zaken-api-configuration/zaken-api-configuration.component';
import {LinkUploadedDocumentToZaakConfigurationComponent} from './components/link-uploaded-document-to-zaak/link-uploaded-document-to-zaak-configuration.component';
import {SetZaakStatusConfigurationComponent} from './components/set-zaak-status/set-zaak-status-configuration.component';
import {CreateZaakResultaatConfigurationComponent} from './components/create-zaak-resultaat/create-zaak-resultaat-configuration.component';
import {CreateNatuurlijkPersoonZaakRolComponent} from './components/create-natuurlijk-persoon-zaak-rol/create-natuurlijk-persoon-zaak-rol.component';
import {CreateNietNatuurlijkPersoonZaakRolComponent} from './components/create-niet-natuurlijk-persoon-zaak-rol/create-niet-natuurlijk-persoon-zaak-rol.component';
import {CreateZaakConfigurationComponent} from './components/create-zaak/create-zaak-configuration.component';
import {SetZaakopschortingComponent} from './components/set-zaakopschorting/set-zaakopschorting.component';
import {StartHersteltermijnConfigurationComponent} from './components/start-hersteltermijn/start-hersteltermijn-configuration.component';
import {EndHersteltermijnComponent} from './components/end-hersteltermijn/end-hersteltermijn.component';
import {CreateZaakeigenschapComponent} from './components/create-zaakeigenschap/create-zaakeigenschap.component';
import {UpdateZaakeigenschapComponent} from './components/update-zaakeigenschap/update-zaakeigenschap.component';
import {DeleteZaakeigenschapComponent} from './components/delete-zaakeigenschap/delete-zaakeigenschap.component';

const zakenApiPluginSpecification: PluginSpecification = {
  pluginId: 'zakenapi',
  pluginConfigurationComponent: ZakenApiConfigurationComponent,
  pluginLogoBase64: ZAKEN_API_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'link-document-to-zaak': LinkDocumentToZaakConfigurationComponent,
    'link-uploaded-document-to-zaak': LinkUploadedDocumentToZaakConfigurationComponent,
    'set-zaakstatus': SetZaakStatusConfigurationComponent,
    'create-zaakresultaat': CreateZaakResultaatConfigurationComponent,
    'create-zaak': CreateZaakConfigurationComponent,
    'create-natuurlijk-persoon-zaak-rol': CreateNatuurlijkPersoonZaakRolComponent,
    'create-niet-natuurlijk-persoon-zaak-rol': CreateNietNatuurlijkPersoonZaakRolComponent,
    'set-zaakopschorting': SetZaakopschortingComponent,
    'start-hersteltermijn': StartHersteltermijnConfigurationComponent,
    'end-hersteltermijn': EndHersteltermijnComponent,
    'create-zaakeigenschap': CreateZaakeigenschapComponent,
    'update-zaakeigenschap': UpdateZaakeigenschapComponent,
    'delete-zaakeigenschap': DeleteZaakeigenschapComponent,
  },
  pluginTranslations: {
    nl: {
      title: 'Zaken API',
      url: 'Zaken API URL',
      urlTooltip:
        'In dit veld moet de verwijzing komen naar de REST api van Open zaak. Deze url moet dus eindigen op /zaken/api/v1/',
      description:
        'De API ondersteunt het opslaan en het naar andere applicaties ontsluiten van gegevens over alle gemeentelijke zaken, van elk type.',
      'link-document-to-zaak': 'Koppel document aan zaak',
      'link-uploaded-document-to-zaak': 'Koppel geupload document aan zaak',
      linkUploadedDocumentToZaakMessage:
        'Het koppelen van een geupload document aan een zaak heeft geen configuratie nodig.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'Onder deze naam zal de plugin te herkennen zijn in de rest van de applicatie',
      documentUrl: 'URL naar het document',
      documentUrlTooltip:
        'Dit veld ondersteunt URLs en proces variabelen. Gebruik pv:variable om een proces variabele uit te lezen',
      titel: 'Documenttitel',
      titelTooltip:
        '(Optioneel) Vult het titel veld in de metadata van de link tussen de Zaak en het Document',
      beschrijving: 'Documentbeschrijving',
      beschrijvingTooltip:
        '(Optioneel) Vult het beschrijving veld in de metadata van de link tussen de Zaak en het Document',
      authenticationPluginConfiguration: 'Configuratie authenticatie-plug-in',
      authenticationPluginConfigurationTooltip:
        'Selecteer de plugin die de authenticatie kan afhandelen. Wanneer de selectiebox leeg blijft zal de authenticatie plugin (bv. OpenZaak) eerst aangemaakt moeten worden',
      linkDocumentInformation:
        'Deze actie koppelt een document uit de Documenten API aan de zaak die bij het dossier hoort.',
      'create-zaak': 'Zaak aanmaken',
      createZaakInformation:
        'Deze actie creëert een zaak in de Zaken API en koppeld de nieuwe zaak aan het dossier.',
      rsin: 'RSIN',
      rsinTooltip: 'Rechtspersonen en Samenwerkingsverbanden Informatienummer',
      verlengingsduur: 'Aantal dagen dat de einddatum wordt verlengd (in cijfers)',
      toelichtingVerlenging: 'Reden voor verlenging',
      toelichtingOpschorting: 'Reden voor opschorting',
      zaakType: 'Zaaktype',
      zaakTypeUrl: 'Zaaktype-URL',
      zaakTypeTooltip: 'In dit veld moet de verwijzing komen naar de type zaak.',
      zaakTypeSelectTooltip:
        'In dit veld moet de verwijzing komen naar de type zaak. Als er slechts één zaaktype beschikbaar is, wordt deze standaard geselecteerd.',
      inputTypeZaakTypeToggle: 'Invoertype Zaaktype-URL',
      text: 'Tekst',
      selection: 'Selectie',
      'create-natuurlijk-persoon-zaak-rol': 'Zaakrol aanmaken - natuurlijk persoon',
      'create-niet-natuurlijk-persoon-zaak-rol': 'Zaakrol aanmaken - niet natuurlijk persoon',
      'set-zaakopschorting': 'Schort een zaak op',
      'start-hersteltermijn': 'Start hersteltermijn',
      startRecoveryPeriodInformation:
        'Deze actie start een hersteltermijn voor de zaak die aan dit proces is gekoppeld.',
      maxDurationInDays: 'Maximale duur in dagen',
      maxDurationInDaysTooltip:
        'De ingevoerde waarde vertegenwoordigt de maximale duur van de hersteltermijn in dagen.',
      'end-hersteltermijn': 'Beëindig hersteltermijn',
      endHersteltermijnInformation: 'Beëindigt de momenteel lopende hersteltermijn van de Zaak',
      'create-zaakeigenschap': 'Creëer zaakeigenschap',
      'update-zaakeigenschap': 'Bijwerken zaakeigenschap',
      'delete-zaakeigenschap': 'Verwijder zaakeigenschap',
      eigenschapUrl: 'Eigenschap URL',
      eigenschapUrlTooltip: 'URL-referentie naar de eigenschap.',
      eigenschapValue: 'Eigenschap waarde',
      eigenschapValueTooltip: 'De waarde van de zaakeigenschap',
      eigenschapUrlSelect: 'Eigenschap',
      eigenschapUrlSelectTooltip: 'Selecteer een eigenschap.',
      inputTypeEigenschapToggle: 'Invoertype eigenschap-URL',
      caseDefinitionTooltipEigenschap:
        'Selecteer de dossierdefinitie waarvan u een eigenschap wilt selecteren. Als er slechts één eigenschap beschikbaar is, wordt deze standaard geselecteerd.',
      roltypeUrl: 'Roltype URL',
      rolToelichting: 'Roltoelichting',
      inpBsn: 'Initiator BSN',
      anpIdentificatie: 'Ander natuurlijk persoon identificatie',
      annIdentificatie: 'Ander niet natuurlijk persoon identificatie',
      annIdentificatieTooltip:
        'Het door de gemeente uitgegeven unieke nummer voor een ander niet-natuurlijk persoon (annIdentificatie).',
      inpA_nummer: 'Administratienummer persoon',
      innNnpId: 'Niet natuurlijk persoonsnummer',
      innNnpIdTooltip:
        'Het door een kamer toegekend uniek nummer voor de ingeschreven niet-natuurlijk persoon (innNnpId).',
      roltypeUrlTooltip: 'URL naar een roltype binnen het Zaaktype van een Zaak',
      rolToelichtingTooltip: 'Omschrijving van de aard van de rol',
      inpBsnTooltip: 'Het burgerservicenummer van de initiator',
      anpIdentificatieTooltip:
        'Het door de gemeente uitgegeven unieke nummer voor een ander natuurlijk persoon',
      inpA_nummerTooltip: 'Het administratienummer van de persoon, bedoeld in de Wet BRP',
      'set-zaakstatus': 'Zaakstatus aanmaken',
      statustypeUrl: 'Zaakstatus type URL',
      statustypeUrlTooltip: 'URL-referentie naar het statustype.',
      statustoelichting: 'Zaakstatus toelichting',
      statustoelichtingTooltip:
        'Een, voor de initiator van de zaak relevante, toelichting op de status van een zaak.',
      'create-zaakresultaat': 'Zaakresultaat aanmaken',
      resultaattypeUrl: 'Zaakresultaat type URL',
      resultaattypeUrlTooltip: 'URL-referentie naar het resultaattype.',
      resultaattoelichting: 'Zaakresultaat toelichting',
      resultaattoelichtingTooltip: 'Een toelichting op wat het resultaat van de zaak inhoudt.',
      caseDefinition: 'Dossierdefinitie',
      caseDefinitionTooltip:
        'Selecteer de dossierdefinitie waarvan u een Zaakstatus-type wilt selecteren. Als er slechts één statustype beschikbaar is, wordt deze standaard geselecteerd.',
      caseDefinitionTooltipResultaat:
        'Selecteer de dossierdefinitie waarvan u een Zaakresultaat-type wilt selecteren. Als er slechts één resultaattype beschikbaar is, wordt deze standaard geselecteerd.',
      statustypeUrlSelect: 'Zaakstatus',
      statustypeUrlSelectTooltip: 'Selecteer het statustype.',
      resultaattypeUrlSelect: 'Zaakresultaat',
      resultaattypeUrlSelectTooltip: 'Selecteer het resultaattype.',
      inputTypeZaakStatusToggle: 'Invoertype Zaakstatus-URL',
      inputTypeZaakResultaatToggle: 'Invoertype Zaakresultaat-URL',
      addZaakProperty: "Voeg nieuwe parameter toe",
      plannedEndDate: "Geplande eind datum",
      finalDeliveryDate: "Laatste opleverings datum",
      dateformatTooltip: "Een datum in formaat van yyyy-mm-dd. Kan ook een verwijzing zijn naar het document of process, bijvoorbeeld doc:customer/startDatum of pv:startDatum"
    },
    en: {
      title: 'Zaken API',
      url: 'URL',
      urlTooltip:
        'This field must contain the URL to the rest API of Open Zaak, therefore this URL should end with /zaken/api/v1/',
      description:
        'The API supports the storage and disclosure of data on all municipal matters to other applications, of all types.',
      'link-document-to-zaak': 'Link document to zaak',
      'link-uploaded-document-to-zaak': 'Link uploaded document to zaak',
      linkUploadedDocumentToZaakMessage:
        'Linking an uploaded document to a zaak requires no configuration.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'With this name the plugin will be recognizable in the rest of the application',
      documentUrl: 'URL to the document',
      documentUrlTooltip:
        'This field supports URLs and process variables. Use pv:variable to read a process variable',
      titel: 'Document title',
      titelTooltip:
        '(Optional) Fills the title field in the metadata of the link between the Zaak and the Document',
      beschrijving: 'Document description',
      beschrijvingTooltip:
        '(Optional) Fills the description field in the metadata of the link between the Zaak and the Document',
      authenticationPluginConfiguration: 'Authentication plugin configuration',
      authenticationPluginConfigurationTooltip:
        'Select the plugin that can handle the authentication. If the selection box remains empty, the authentication plugin (e.g. OpenZaak) will have to be created first',
      linkDocumentInformation:
        'This action links a document from the Documents API to the zaak associated with the case.',
      'create-zaak': 'Create zaak',
      createZaakInformation:
        'This action creates a zaak in the Zaken API and links the new zaak with the case.',
      rsin: 'RSIN',
      rsinTooltip: 'Legal Entities and Partnerships Information Number',
      verlengingsduur: 'Amount of days to prolong (in numbers)',
      toelichtingVerlenging: 'Reason for prolonging',
      toelichtingOpschorting: 'Reason for suspending',
      zaakType: 'Zaaktype',
      zaakTypeUrl: 'Zaaktype URL',
      zaakTypeTooltip: 'In this field the reference must be made to the type of the zaak.',
      zaakTypeSelectTooltip:
        'In this field the reference must be made to the type of the zaak. If only one zaaktype is available, it will be selected by default.',
      inputTypeZaakTypeToggle: 'Input type Zaaktype-URL',
      text: 'Text',
      selection: 'Selection',
      'create-natuurlijk-persoon-zaak-rol': 'Create Zaakrol - natural person',
      'create-niet-natuurlijk-persoon-zaak-rol': 'Create Zaakrol - not a natural person',
      'set-zaakopschorting': 'Suspend case',
      'start-hersteltermijn': 'Start recovery period',
      startHersteltermijnInformation:
        'This action initiates a recovery period for the case associated with this process.',
      maxDurationInDays: 'Maximum duration in days',
      maxDurationInDaysTooltip:
        'The entered value represents the maximum duration of the recovery period in days.',
      'end-hersteltermijn': 'End recovery period',
      endHersteltermijnInformation: 'Ends the currently running recovery period of the Zaak',
      'create-zaakeigenschap': 'Create zaakeigenschap',
      'update-zaakeigenschap': 'Update zaakeigenschap',
      'delete-zaakeigenschap': 'Delete zaakeigenschap',
      eigenschapUrl: 'Property URL',
      eigenschapUrlTooltip: 'URL reference to the eigenschap.',
      eigenschapValue: 'Eigenschap value',
      eigenschapValueTooltip: 'The value of the zaakeigenschap',
      eigenschapUrlSelect: 'Eigenschap',
      eigenschapUrlSelectTooltip: 'Select a eigenschap.',
      inputTypeEigenschapToggle: 'Input type eigenschap-URL',
      caseDefinitionTooltipEigenschap:
        'Select the case definition from which you want to select an eigenschap. If only one eigenschap is available, it will be selected by default.',
      roltypeUrl: 'Role type URL',
      rolToelichting: 'Role explanation',
      inpBsn: 'Initiator BSN',
      anpIdentificatie: 'Other natural person identification',
      annIdentificatie: 'Other not natural person identification',
      annIdentificatieTooltip:
        'The unique number issued by the municipality for another non-natural person (annIdentificatie).',
      inpA_nummer: 'Administration number person',
      innNnpId: 'Not a natural personal number',
      innNnpIdTooltip:
        'The unique number assigned by the government for the registered non-natural person (innNnpId).',
      roltypeUrlTooltip: 'URL to a role type within the Zaaktype of a Zaak',
      rolToelichtingTooltip: 'Description of the nature of the role',
      inpBsnTooltip: "The initiator's social security number",
      anpIdentificatieTooltip:
        'The unique number issued by the municipality for another natural person',
      inpA_nummerTooltip: 'The administration number of the person, as referred to in the Wet BRP',
      'set-zaakstatus': 'Create zaakstatus',
      statustypeUrl: 'Zaakstatus type URL',
      statustypeUrlTooltip: 'URL reference to the status type.',
      statustoelichting: 'Zaakstatus explanation',
      statustoelichtingTooltip:
        'An explanation of the status of a zaak that is relevant to the initiator of the zaak.',
      'create-zaakresultaat': 'Create Zaakresultaat',
      resultaattypeUrl: 'Zaakresultaat type URL',
      resultaattypeUrlTooltip: 'URL reference to the resultaat type.',
      resultaattoelichting: 'Zaakresultaat explanation',
      resultaattoelichtingTooltip: 'An explanation of what the result of the zaak means.',
      caseDefinition: 'Case definition',
      caseDefinitionTooltip:
        'Select the case definition from which you want to select a Zaakstatus type. If only one status type is available, it will be selected by default.',
      caseDefinitionTooltipResultaat:
        'Select the case definition from which you want to select a Resultaat type. If only one resultaat type is available, it will be selected by default.',
      statustypeUrlSelect: 'Zaakstatus',
      statustypeUrlSelectTooltip: 'Select the status type.',
      resultaattypeUrlSelect: 'Zaakresultaat',
      resultaattypeUrlSelectTooltip: 'Select the resultaat type.',
      inputTypeZaakStatusToggle: 'Input type Zaakstatus-URL',
      inputTypeZaakResultaatToggle: 'Input type Zaakresultaat-URL',
      addZaakProperty: "Add new case property",
      plannedEndDate: "Planned end date",
      finalDeliveryDate: "Final delivery date",
      dateformatTooltip: "A date in the format of yyyy-mm-dd. Can also be a reference to the document or process, for example doc:customer/startDate or pv:startDate"
    },
    de: {
      title: 'Zaken API',
      url: 'URL',
      urlTooltip:
        'Dieses Feld muss die URL zur rest API von Open Zaak enthalten, daher sollte diese URL mit enden /zaken/api/v1/',
      description:
        'Die API unterstützt die Speicherung und Weitergabe von Daten zu allen kommunalen Belangen an andere Anwendungen.',
      'link-document-to-zaak': 'Dokument mit Zaak verknüpfen',
      'link-uploaded-document-to-zaak': 'Hochgeladenes Dokument mit Zaak verknüpfen',
      linkUploadedDocumentToZaakMessage:
        'Das Verknüpfen eines hochgeladenen Dokuments mit einem Zaak erfordert keine Konfiguration.',
      configurationTitle: 'Konfigurationsname',
      configurationTitleTooltip:
        'An diesem Namen wird das Plugin im Rest der Anwendung erkennbar sein',
      documentUrl: 'URL zum Dokument',
      documentUrlTooltip:
        'Dieses Feld unterstützt URLs und Prozessvariablen. Verwenden Sie pv:Variablen, um eine Prozessvariable zu lesen',
      titel: 'Dokumenttitel',
      titelTooltip:
        '(Optional) Füllt das Titelfeld in den Metadaten des Links zwischen dem Zaak und dem Dokument aus',
      beschrijving: 'Dokumentbeschreibung',
      beschrijvingTooltip:
        '(Optional) Füllt das Beschreibungsfeld in den Metadaten des Links zwischen dem Zaak und dem Dokument aus',
      authenticationPluginConfiguration: 'Authentifizierungs-Plugin-Konfiguration',
      authenticationPluginConfigurationTooltip:
        'Wählen Sie das Plugin aus, das die Authentifizierung verarbeiten kann. Bleibt das Auswahlfeld leer, muss zunächst das Authentifizierungs-Plugin (z. B. OpenZaak) erstellt werden',
      linkDocumentInformation:
        'Diese Aktion verknüpft ein Dokument aus der Dokumenten-API mit dem mit dem Fall verknüpften Zaak.',
      'create-zaak': 'Zaak erschaffen',
      createZaakInformation:
        'Diese Aktion hat einen zaak in der Zaken-API definiert und den neuen zaak mit dem Fall verknüpft.',
      rsin: 'RSIN',
      rsinTooltip: 'Informationsnummer für juristische Personen und Partnerschaften.',
      verlengingsduur: 'Anzahl der Tage, um die das Enddatum verlängert wird (in Zahlen)',
      toelichtingVerlenging: 'Grund für die Verlängerung',
      toelichtingOpschorting: 'Grund für die Suspendierung',
      zaakType: 'Zaaktype',
      zaakTypeUrl: 'Zaaktype-URL',
      zaakTypeTooltip: 'In diesem Feld muss auf die zaaktype verwiesen werden.',
      zaakTypeSelectTooltip:
        'In diesem Feld muss auf die zaaktype verwiesen werden. Wenn nur ein Zaaktyp verfügbar ist, wird dieser standardmäßig ausgewählt.',
      inputTypeZaakTypeToggle: 'Eingabetyp Zaaktype-URL',
      text: 'Text',
      selection: 'Auswahl',
      'create-natuurlijk-persoon-zaak-rol': 'Zaakrol erstellen – natürliche Person',
      'create-niet-natuurlijk-persoon-zaak-rol': 'Zaakrol erstellen – keine natürliche Person',
      'set-zaakopschorting': 'Einen Fall aussetzen',
      'start-hersteltermijn': 'Beginnen Sie mit der Erholungsphase',
      startHersteltermijnInformation:
        'Diese Aktion startet eine Erholungszeit für den Fall, der mit diesem Prozess verknüpft ist.',
      maxDurationInDays: 'Maximale Dauer in Tagen',
      maxDurationInDaysTooltip:
        'Der eingegebene Wert stellt die maximale Dauer der Erholungszeit in Tagen dar.',
      'end-hersteltermijn': 'Beenden Sie mit der Erholungsphase',
      endHersteltermijnInformation: 'Beenden die aktuelle Erholungsphase des Case',
      'create-zaakeigenschap': 'Zaakeigenschaft erstellen',
      'update-zaakeigenschap': 'Zaakeigenschaft aktualisieren',
      'delete-zaakeigenschap': 'Zaakeigenschaft löschen',
      eigenschapUrl: 'Eigenschafts-URL',
      eigenschapUrlTooltip: 'URL-Referenz zur Eigenschaft.',
      eigenschapValue: 'Eigenschaftswert',
      eigenschapValueTooltip: 'Der Wert der Zaakeigenschaft',
      inputTypeEigenschapToggle: 'Eingabetyp eigenschap-URL',
      eigenschapUrlSelect: 'Eigenschap',
      eigenschapUrlSelectTooltip: 'Wählen Sie den eigenschap aus.',
      caseDefinitionTooltipEigenschap:
        'Wählen Sie die eigenschap aus, aus der Sie einen eigenschap auswählen möchten. Wenn nur ein Statustyp verfügbar ist, wird dieser standardmäßig ausgewählt.',
      roltypeUrl: 'Rollentyp-URL',
      rolToelichting: 'Rollenerklärung',
      inpBsn: 'Initiator BSN',
      anpIdentificatie: 'Andere Identifizierung natürlicher Personen',
      annIdentificatie: 'Andere Identifizierung keine natürlicher Personen',
      annIdentificatieTooltip:
        'Die eindeutige Nummer, die von der Gemeinde für eine andere nicht natürliche Person vergeben wird (annIdentificatie).',
      inpA_nummer: 'Verwaltungsnummer Person',
      innNnpId: 'Keine natürliche Personennummer',
      innNnpIdTooltip:
        'Die von der Regierung vergebene eindeutige Nummer für die registrierte nicht natürliche Person (innNnpId).',
      roltypeUrlTooltip: 'URL zu einem Rollentyp innerhalb des Zaaktypes eines Zaaks',
      rolToelichtingTooltip: 'Beschreibung der Art der Rolle',
      inpBsnTooltip: 'Die Sozialversicherungsnummer des Initiators',
      anpIdentificatieTooltip:
        'Die eindeutige Nummer, die von der Gemeinde für eine andere natürliche Person vergeben wird',
      inpA_nummerTooltip: 'Die Verwaltungsnummer der Person im Sinne des Wet BRP',
      'set-zaakstatus': 'Fallstatus erstellen',
      statustypeUrl: 'URL des Zaakstatustyps',
      statustypeUrlTooltip: 'URL-Referenz zum Statustyp.',
      statustoelichting: 'Erklärung des Zaakstatus',
      statustoelichtingTooltip:
        'Eine Erklärung des Status eines zaak, die für den Initiator des Zaak relevant ist.',
      'create-zaakresultaat': 'Zaakgebnis erstellen',
      resultaattypeUrl: 'URL des Zaakgebnistyps',
      resultaattypeUrlTooltip: 'URL-Verweis auf den Ergebnistyp.',
      resultaattoelichting: 'Geschäftsergebniserklärung',
      resultaattoelichtingTooltip: 'Eine Erklärung, was das Ergebnis des Zaak beinhaltet.',
      caseDefinition: 'Falltyp',
      caseDefinitionTooltip:
        'Wählen Sie die Falltyp aus, aus der Sie einen Zaakstatus-typ auswählen möchten. Wenn nur ein Statustyp verfügbar ist, wird dieser standardmäßig ausgewählt.',
      caseDefinitionTooltipResultaat:
        'Wählen Sie die Falltyp aus, aus der Sie einen Zaakresultaat-typ auswählen möchten. Wenn nur ein Resultaattyp verfügbar ist, wird dieser standardmäßig ausgewählt.',
      statustypeUrlSelect: 'Zaakstatus',
      statustypeUrlSelectTooltip: 'Wählen Sie den Statustyp aus.',
      resultaattypeUrlSelect: 'Zaakresultaat',
      resultaattypeUrlSelectTooltip: 'Wählen Sie den Resultaattype aus.',
      inputTypeZaakStatusToggle: 'Eingabetyp Zaakstatus-URL',
      inputTypeZaakResultaatToggle: 'Eingabetyp Zaakresultaat-URL',
      addZaakProperty: "Neue Case-Eigenschaft hinzufügen",
      plannedEndDate: "Geplantes Enddatum",
      finalDeliveryDate: "Endgültiger Liefertermin",
      dateformatTooltip: "Ein Datum im Format yyyy-mm-dd. Kann auch ein Verweis auf das Dokument oder den Prozess sein, zum Beispiel doc:kunde/startDatum oder pv:startDatum"
    },
  },
};

export {zakenApiPluginSpecification};
