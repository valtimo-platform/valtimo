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
import { PluginSpecification, PluginSpecification } from '../../models';
import { ZAKEN_API_PLUGIN_LOGO_BASE64, ZAKEN_API_PLUGIN_LOGO_BASE64 } from './assets';
import {
  CreateMedewerkerZaakRolComponent,
} from './components/create-medewerker-zaak-rol/create-medewerker-zaak-rol.component';
import {
  CreateNatuurlijkPersoonZaakRolComponent,
} from './components/create-natuurlijk-persoon-zaak-rol/create-natuurlijk-persoon-zaak-rol.component';
import {
  CreateNietNatuurlijkPersoonZaakRolComponent,
} from './components/create-niet-natuurlijk-persoon-zaak-rol/create-niet-natuurlijk-persoon-zaak-rol.component';
import {
  CreateOrganisatorischeEenheidZaakRolComponent,
} from './components/create-organisatorische-eenheid-zaak-rol/create-organisatorische-eenheid-zaak-rol.component';
import {
  CreateVestigingZaakRolComponent,
} from './components/create-vestiging-zaak-rol/create-vestiging-zaak-rol.component';
import {
  CreateZaakObjectConfigurationComponent,
} from './components/create-zaak-object/create-zaak-object-configuration.component';
import {
  CreateZaakResultaatConfigurationComponent,
} from './components/create-zaak-resultaat/create-zaak-resultaat-configuration.component';
import {
  CreateZaakConfigurationComponent,
} from './components/create-zaak/create-zaak-configuration.component';
import {
  CreateZaakeigenschapComponent,
} from './components/create-zaakeigenschap/create-zaakeigenschap.component';
import { DeleteZaakRolComponent } from './components/delete-zaak-rol/delete-zaak-rol.component';
import {
  DeleteZaakeigenschapComponent,
} from './components/delete-zaakeigenschap/delete-zaakeigenschap.component';
import {
  EndHersteltermijnComponent,
} from './components/end-hersteltermijn/end-hersteltermijn.component';
import {
  GetZaakInformatieobjectenComponent,
} from './components/get-zaak-informatieobjecten/get-zaak-informatieobjecten.component';
import {
  GetZaakbesluitenConfigurationComponent,
} from './components/get-zaakbesluiten/get-zaakbesluiten-configuration.component';
import {
  LinkDocumentToZaakConfigurationComponent,
} from './components/link-document-to-zaak/link-document-to-zaak-configuration.component';
import {
  LinkUploadedDocumentToZaakConfigurationComponent,
} from './components/link-uploaded-document-to-zaak/link-uploaded-document-to-zaak-configuration.component';
import {
  PatchZaakConfigurationComponent,
} from './components/patch-zaak/patch-zaak-configuration.component';
import { RelateerZakenComponent } from './components/relateer-zaken/relateer-zaken.component';
import {
  SetZaakStatusConfigurationComponent,
} from './components/set-zaak-status/set-zaak-status-configuration.component';
import {
  SetZaakopschortingComponent,
} from './components/set-zaakopschorting/set-zaakopschorting.component';
import {
  StartHersteltermijnConfigurationComponent,
} from './components/start-hersteltermijn/start-hersteltermijn-configuration.component';
import {
  UpdateZaakeigenschapComponent,
} from './components/update-zaakeigenschap/update-zaakeigenschap.component';
import {
  ZakenApiConfigurationComponent,
} from './components/zaken-api-configuration/zaken-api-configuration.component';

const zakenApiPluginSpecification: PluginSpecification = {
  pluginId: 'zakenapi',
  pluginConfigurationComponent: ZakenApiConfigurationComponent,
  pluginLogoBase64: ZAKEN_API_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'link-document-to-zaak': LinkDocumentToZaakConfigurationComponent,
    'link-uploaded-document-to-zaak': LinkUploadedDocumentToZaakConfigurationComponent,
    'get-zaak-informatieobjecten': GetZaakInformatieobjectenComponent,
    'set-zaakstatus': SetZaakStatusConfigurationComponent,
    'create-zaakresultaat': CreateZaakResultaatConfigurationComponent,
    'delete-zaak-rol': DeleteZaakRolComponent,
    'create-zaak': CreateZaakConfigurationComponent,
    'create-natuurlijk-persoon-zaak-rol': CreateNatuurlijkPersoonZaakRolComponent,
    'create-niet-natuurlijk-persoon-zaak-rol': CreateNietNatuurlijkPersoonZaakRolComponent,
    'create-medewerker-zaak-rol': CreateMedewerkerZaakRolComponent,
    'create-organisatorische-eenheid-zaak-rol': CreateOrganisatorischeEenheidZaakRolComponent,
    'create-vestiging-zaak-rol': CreateVestigingZaakRolComponent,
    'set-zaakopschorting': SetZaakopschortingComponent,
    'start-hersteltermijn': StartHersteltermijnConfigurationComponent,
    'end-hersteltermijn': EndHersteltermijnComponent,
    'create-zaakeigenschap': CreateZaakeigenschapComponent,
    'update-zaakeigenschap': UpdateZaakeigenschapComponent,
    'delete-zaakeigenschap': DeleteZaakeigenschapComponent,
    'create-zaak-object': CreateZaakObjectConfigurationComponent,
    'relateer-zaken': RelateerZakenComponent,
    'patch-zaak': PatchZaakConfigurationComponent,
    'get-zaakbesluiten': GetZaakbesluitenConfigurationComponent,
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
      'create-zaak-object': 'Zaakobject aanmaken',
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
      now: 'Gebruik huidige datum/tijd',
      text: 'Tekst',
      selection: 'Selectie',
      'create-natuurlijk-persoon-zaak-rol': 'Zaakrol aanmaken - Natuurlijk persoon',
      'create-niet-natuurlijk-persoon-zaak-rol': 'Zaakrol aanmaken - Niet natuurlijk persoon',
      'create-medewerker-zaak-rol': 'Zaakrol aanmaken - Medewerker',
      'create-organisatorische-eenheid-zaak-rol': 'Zaakrol aanmaken - Organisatorische eenheid',
      'create-vestiging-zaak-rol': 'Zaakrol aanmaken - Vestiging',
      'delete-zaak-rol': 'Verwijderen Zaakrol',
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
        'Het door de gemeente uitgegeven unieke nummer voor een ander niet-natuurlijk persoon (annIdentificatie). (Max. 17 tekens)',
      inpA_nummer: 'Administratienummer persoon',
      innNnpId: 'Niet natuurlijk persoonsnummer',
      innNnpIdTooltip:
        'Het door een kamer toegekend uniek nummer voor de ingeschreven niet-natuurlijk persoon (innNnpId). (Max. 9 tekens)',
      roltypeUrlTooltip: 'URL naar een roltype binnen het Zaaktype van een Zaak',
      rolToelichtingTooltip: 'Omschrijving van de aard van de rol',
      inpBsnTooltip: 'Het burgerservicenummer van de initiator (Numeriek, max 9 tekens)',
      anpIdentificatieTooltip:
        'Het door de gemeente uitgegeven unieke nummer voor een ander natuurlijk persoon. (Max. 17 tekens)',
      inpA_nummerTooltip:
        'Het administratienummer van de persoon, bedoeld in de Wet BRP. (Numeriek, max. 10 tekens)',
      'set-zaakstatus': 'Zaakstatus aanmaken',
      statustypeUrl: 'Zaakstatus type URL',
      statustypeUrlTooltip: 'URL-referentie naar het statustype.',
      datumStatusGezet: 'Datum status gezet.',
      datumStatusGezetTooltip: 'Datum/tijd waarde van het zaakstatus.',
      datumStatusGezetInvalidText: 'Datum en tijd mogen niet in de toekomst liggen.',
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
      inputDatumStatusGezetToggle: 'Invoertype datum status gezet',
      inputTypeZaakResultaatToggle: 'Invoertype Zaakresultaat-URL',
      addZaakProperty: 'Voeg nieuwe parameter toe',
      'relateer-zaken': 'Relateer zaken',
      teRelaterenZaakUri: 'URL naar de te relateren zaak',
      aardRelatie: 'Aard van de relatie',
      'option-vervolg': 'De andere zaak gaf aanleiding tot het starten van de onderhanden zaak.',
      'option-onderwerp':
        'De andere zaak is relevant voor cq. is onderwerp van de onderhanden zaak.',
      'option-bijdrage':
        'Aan het bereiken van de uitkomst van de andere zaak levert de onderhanden zaak een bijdrage.',
      identificatie: 'Identificatie',
      identificatieMedewerkerTooltip:
        'Een korte unieke aanduiding van de medewerker. (Max. 24 tekens)',
      identificatieOrganisatorischeEenheidTooltip:
        'Een korte identificatie van de organisatorische eenheid. (Max. 24 tekens)',
      voorletters: 'Voorletters',
      voorlettersTooltip:
        'De verzameling letters die gevormd wordt door de eerste letter van alle in volgorde voorkomende voornamen. (Max. 20 tekens)',
      achternaam: 'Achternaam',
      achternaamTooltip:
        'De achternaam zoals de medewerker die in het dagelijkse verkeer gebruikt. (Max. 200 tekens)',
      voorvoegselAchternaam: 'Achternaam voorvoegsel',
      voorvoegselAchternaamTooltip:
        'Deel van de geslachtsnaam dat voorkomt in Tabel 36 (GBA), voorvoegseltabel, en door een spatie van de geslachtsnaam is. (Max. 10 tekens)',
      afwijkendeNaamBetrokkene: 'Afwijkende naam betrokkene',
      afwijkendeNaamBetrokkeneTooltip:
        'De naam van de betrokkene waaronder deze in relatie tot de zaak aangesproken wil worden. (Max. 625 tekens)',
      indicatieMachtiging: 'Indicatie machtiging',
      indicatieMachtigingTooltip: 'Het type machtiging.',
      nvt: 'N.v.t',
      gemachtigde: 'Gemachtigde',
      machtiginggever: 'Machtiginggever',
      naam: 'Naam',
      naamTooltip: 'De feitelijke naam van de organisatorische eenheid.',
      isGehuisvestIn: 'Is gehuisvest in',
      isGehuisvestInTooltip:
        'Locatie waar de organisatorische eenheid gehuisvest is. (Max. 24 tekens)',
      handelsnaam: 'Handelsnaam',
      handelsnaamTooltip: 'De naam van de vestiging waaronder gehandeld wordt. (Max. 625 tekens)',
      kvkNummer: 'KVK-nummer',
      kvkNummerTooltip: 'Een uniek nummer toegekend door de Kamer van Koophandel. (Max. 8 tekens)',
      vestigingsNummer: 'Vestigingsnummer',
      vestigingsNummerTooltip: 'Een korte unieke aanduiding van de Vestiging. (Max. 24 tekens)',
      'get-zaakbesluiten': 'Ophalen zaakbesluiten',
      'patch-zaak': 'Zaak bijwerken',
      patchZaakInformation:
        'Deze actie maakt het mogelijk eigenschappen van de Zaak in de Zaken API gekoppeld aan het dossier bij te werken.',
      addPatchZaakProperty: 'Voeg parameter toe',
      dateformatTooltip:
        'Een datum in formaat van yyyy-mm-dd. Kan ook een verwijzing zijn naar het document of process, bijvoorbeeld doc:customer/startDatum of pv:startDatum',
      omschrijving: 'Omschrijving',
      explanation: 'Toelichting',
      plannedEndDate: 'Geplande eind datum',
      finalDeliveryDate: 'Laatste opleveringsdatum',
      publicationDate: 'Publicatiedatum',
      communicationChannel: 'Communicatiekanaal (URL)',
      communicationChannelName: 'Communicatiekanaal naam',
      paymentIndication: 'Betalingsindicatie',
      lastPaymentDate: 'Laatste betaaldatum',
      caseGeometry: 'Zaakgeometrie',
      caseGeometryType: 'Zaakgeometrie type',
      caseGeometryCoordinates: 'Zaakgeometrie coördinaten',
      caseGeometryCoordinatesTooltip: 'Lijst van punten, bv [0.0, 1.0]',
      mainCase: 'Hoofdzaak',
      archiveActionDate: 'Archief actiedatum',
      startDateRetentionPeriod: 'Startdatum bewaartermijn',
      zaakObjectObjectUrl: 'Object URL',
      zaakObjectObjectUrlTooltip: 'URL-referentie naar de resource die het OBJECT beschrijft.',
      objectType: 'Object Type',
      objectTypeTooltip:
        'Beschrijft het type OBJECT gerelateerd aan de ZAAK. Als er geen passend type is, dan moet het type worden opgegeven onder objectTypeOverige.',
      relatieomschrijving: 'Relatieomschrijving',
      relatieomschrijvingTooltip: 'Omschrijving van de betrekking tussen de ZAAK en het OBJECT.',
      zakelijkRechtIdentificatie: 'Zakelijk recht identificatie',
      zakelijkRechtIdentificatieTooltip: 'De unieke identificatie van het OBJECT',
      zakelijkRechtAvgAard: 'Zakelijk recht AVG aard',
      zakelijkRechtAvgAardTooltip: 'Aanduiding voor de aard van het recht',
      objectTypeOverige: 'Object type overige',
      objectTypeOverigeTooltip:
        'Beschrijft het type OBJECT als objectType de waarde "overige" heeft.',
      objectTypeOverigeDefinitie: 'Object type overige definitie',
      objectTypeOverigeDefinitieUrl: 'URL',
      objectTypeOverigeDefinitieUrlTooltip:
        'URL-referentie naar de objecttype resource in een API. Deze resource moet de JSON-schema-definitie van het objecttype bevatten.',
      objectTypeOverigeDefinitieSchema: 'Schema',
      objectTypeOverigeDefinitieSchemaTooltip:
        'Een geldige jq expressie. Dit wordt gecombineerd met de resource uit het url-attribuut om het schema van het objecttype uit te lezen. Bijvoorbeeld: .jsonSchema.',
      objectTypeOverigeDefinitieObjectData: 'Object data',
      objectTypeOverigeDefinitieObjectDataTooltip:
        'Een geldige jq expressie. Dit wordt gecombineerd met de JSON data uit de OBJECT url om de objectgegevens uit te lezen en de vorm van de gegevens tegen het schema te valideren. Bijvoorbeeld: .record.data.',
      objectIdentificatie: 'Object identificatie',
      rolUuid: 'Rol UUID',
      rolUuidTooltip: 'De UUID van de rol',
      createZaakrolNietNatuurlijkPersoonIdentifierFieldsInformation:
        'Minimaal &eacute;&eacute;n van de volgende velden moet worden ingevuld als identificatie voor de niet natuurlijke persoon:<br/>- Niet natuurlijk persoonsnummer<br/>- Ander niet natuurlijk persoon identificatie<br/>- KVK-nummer<br/>- Vestigingsnummer',
      'get-zaak-informatieobjecten': 'Zaakinformatieobjecten ophalen',
      resultProcessVariable: 'Resultaat process variable',
      resultProcessVariableTooltip: 'De naam van de procesvariabele waarin het resultaat wordt opgeslagen.',
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
      'create-zaak-object': 'Create zaak object',
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
      now: 'Use current date/time',
      text: 'Text',
      selection: 'Selection',
      'create-natuurlijk-persoon-zaak-rol': 'Create Zaakrol - natural person',
      'create-niet-natuurlijk-persoon-zaak-rol': 'Create Zaakrol - not a natural person',
      'create-medewerker-zaak-rol': 'Create Zaakrol - Employee',
      'create-organisatorische-eenheid-zaak-rol': 'Create Zaakrol - Organizational unit',
      'create-vestiging-zaak-rol': 'Create Zaakrol - Branch',
      'delete-zaak-rol': 'Removing Zaakrol',
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
        'The unique number issued by the municipality for another non-natural person (annIdentificatie). (Max. 17 characters)',
      inpA_nummer: 'Administration number person',
      innNnpId: 'Not a natural personal number',
      innNnpIdTooltip:
        'The unique number assigned by the government for the registered non-natural person (innNnpId). (Max. 9 characters)',
      roltypeUrlTooltip: 'URL to a role type within the Zaaktype of a Zaak',
      rolToelichtingTooltip: 'Description of the nature of the role',
      inpBsnTooltip: "The initiator's social security number",
      anpIdentificatieTooltip:
        'The unique number issued by the municipality for another natural person. (Max. 17 characters)',
      inpA_nummerTooltip:
        'The administration number of the person, as referred to in the Wet BRP. (Numeric, max. 10 characters)',
      'set-zaakstatus': 'Create zaakstatus',
      statustypeUrl: 'Zaakstatus type URL',
      statustypeUrlTooltip: 'URL reference to the status type.',
      datumStatusGezet: 'Date status set.',
      datumStatusGezetTooltip: 'Date/time value of the zaakstatus.',
      datumStatusGezetInvalidText: 'Date and time may not be in the future.',
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
      inputDatumStatusGezetToggle: 'Input type datum status gezet',
      inputTypeZaakResultaatToggle: 'Input type Zaakresultaat-URL',
      addZaakProperty: 'Add new case property',
      'relateer-zaken': 'Add relation between two Zaken',
      teRelaterenZaakUri: 'URL to the Zaak to be related',
      aardRelatie: 'Nature of the relationship',
      'option-vervolg': 'The other Zaak prompted the start of the current Zaak.',
      'option-onderwerp': 'The other Zaak is relevant to or the subject of the current Zaak.',
      'option-bijdrage': 'The current Zaak contributes to the outcome of the other Zaak.',
      identificatie: 'Identification',
      identificatieMedewerkerTooltip:
        'A short unique designation of the employee. (Max. 24 characters)',
      identificatieOrganisatorischeEenheidTooltip:
        'A short identification of the organizational unit. (Max. 24 characters)',
      voorletters: 'Initials',
      voorlettersTooltip:
        'The collection of letters formed by the first letter of all forenames in order. (Max. 20 characters)',
      achternaam: 'Last name',
      achternaamTooltip:
        'The last name as used by the employee in daily life. (Max. 200 characters)',
      voorvoegselAchternaam: 'Prefix to last name',
      voorvoegselAchternaamTooltip:
        'Part of the genus name that appears in Table 36 (GBA), prefix table, and is separated from the genus name by a space. (Max. 10 characters)',
      afwijkendeNaamBetrokkene: 'Alternative name of the person involved',
      afwijkendeNaamBetrokkeneTooltip:
        'The name of the person involved under which they wish to be addressed in relation to the case. (Max. 625 characters)',
      indicatieMachtiging: 'Authorization indication',
      indicatieMachtigingTooltip: 'The type that represents the authorization indication',
      nvt: 'N/A',
      gemachtigde: 'Authorized representative',
      machtiginggever: 'Authorizing party',
      naam: 'Name',
      naamTooltip: 'The actual name of the organizational unit.',
      isGehuisvestIn: 'Is housed in',
      isGehuisvestInTooltip:
        'Location where the organizational unit is housed. (Max. 24 characters)',
      handelsnaam: 'Trade name',
      handelsnaamTooltip:
        'The name of the establishment where the business is conducted. (Max. 625 characters)',
      kvkNummer: 'Chamber of Commerce number',
      kvkNummerTooltip: 'A unique number assigned by the Chamber of Commerce. (Max. 8 characters)',
      vestigingsNummer: 'Branch number',
      vestigingsNummerTooltip: 'A short unique designation of the branch. (Max. 24 characters)',
      'get-zaakbesluiten': 'Retrieve zaakbesluiten',
      'patch-zaak': 'Update zaak',
      patchZaakInformation:
        'This action allows you to update properties of a Zaak in the Zaken API which is linked to the case.',
      dateformatTooltip:
        'A date in the format of yyyy-mm-dd. Can also be a reference to the document or process, for example doc:customer/startDate or pv:startDate',
      addPatchZaakProperty: 'Add property',
      omschrijving: 'Description',
      explanation: 'Explanation',
      plannedEndDate: 'Planned end date',
      finalDeliveryDate: 'Final delivery date',
      publicationDate: 'Publication date',
      communicationChannel: 'Communication channel (URL)',
      communicationChannelName: 'Communication channel name',
      paymentIndication: 'Payment indication',
      lastPaymentDate: 'Last payment date',
      caseGeometry: 'Case geometry',
      caseGeometryType: 'Case geometry type',
      caseGeometryCoordinates: 'Case geometry coordinates',
      caseGeometryCoordinatesTooltip: 'List of points, i.e. [0.0, 1.0]',
      mainCase: 'Main case',
      archiveActionDate: 'Archive action date',
      startDateRetentionPeriod: 'Start date of retention period',
      zaakObjectObjectUrl: 'Object URL',
      zaakObjectObjectUrlTooltip: 'URL reference to the resource that describes the OBJECT.',
      objectType: 'Object Type',
      objectTypeTooltip:
        'Describes the type of OBJECT related to the ZAAK. If there is no suitable type, then the type must be specified under objectTypeOverige.',
      relatieomschrijving: 'Relationship description',
      relatieomschrijvingTooltip:
        'Description of the relationship between the ZAAK and the OBJECT.',
      zakelijkRechtIdentificatie: 'Property right identification',
      zakelijkRechtIdentificatieTooltip: 'The unique identification of the OBJECT',
      zakelijkRechtAvgAard: 'Property right AVG nature',
      zakelijkRechtAvgAardTooltip: 'Indication of the nature of the right',
      objectTypeOverige: 'Object type other',
      objectTypeOverigeTooltip:
        "Describes the type of OBJECT when objectType has the value 'overige'.",
      objectTypeOverigeDefinitie: 'Object type other definition',
      objectTypeOverigeDefinitieUrl: 'URL',
      objectTypeOverigeDefinitieUrlTooltip:
        'URL reference to the object type resource in an API. This resource must contain the JSON schema definition of the object type.',
      objectTypeOverigeDefinitieSchema: 'Schema',
      objectTypeOverigeDefinitieSchemaTooltip:
        'A valid jq expression. This is combined with the resource from the url attribute to read the schema of the object type. Example: .jsonSchema.',
      objectTypeOverigeDefinitieObjectData: 'Object data',
      objectTypeOverigeDefinitieObjectDataTooltip:
        'A valid jq expression. This is combined with the JSON data from the OBJECT url to read the object data and validate the data structure against the schema. Example: .record.data.',
      objectIdentificatie: 'Object identification',
      rolUuid: 'Rol UUID',
      rolUuidTooltip: 'The UUID of the rol',
      createZaakrolNietNatuurlijkPersoonIdentifierFieldsInformation:
        'At least one of the following fields must be completed to identify the non-natural person:<br/>- Not a natural person identification<br/>- Other not natural person number<br/>- Chamber of Commerce number<br/>- Branch number',
      'get-zaak-informatieobjecten': 'Get zaak informatieobjecten',
      resultProcessVariableTooltip: 'The name of the process variable in which the result is stored.'
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
      'create-zaak-object': 'Zaakobject erschaffen',
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
      now: 'Aktuelles Datum/Uhrzeit verwenden',
      text: 'Text',
      selection: 'Auswahl',
      'create-natuurlijk-persoon-zaak-rol': 'Zaakrol erstellen – natürliche Person',
      'create-niet-natuurlijk-persoon-zaak-rol': 'Zaakrol erstellen – keine natürliche Person',
      'create-medewerker-zaak-rol': 'Zaakrol erstellen – Mitarbeiter',
      'create-organisatorische-eenheid-zaak-rol': 'Zaakrol erstellen – Organisationseinheit',
      'create-vestiging-zaak-rol': 'Zaakrol erstellen – Niederlassung',
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
        'Die eindeutige Nummer, die von der Gemeinde für eine andere nicht natürliche Person vergeben wird (annIdentificatie). (Max. 17 Zeichen)',
      inpA_nummer: 'Verwaltungsnummer Person',
      innNnpId: 'Keine natürliche Personennummer',
      innNnpIdTooltip:
        'Die von der Regierung vergebene eindeutige Nummer für die registrierte nicht natürliche Person (innNnpId). (Max. 9 Zeichen)',
      roltypeUrlTooltip: 'URL zu einem Rollentyp innerhalb des Zaaktypes eines Zaaks',
      rolToelichtingTooltip: 'Beschreibung der Art der Rolle',
      inpBsnTooltip: 'Die Sozialversicherungsnummer des Initiators',
      anpIdentificatieTooltip:
        'Die eindeutige Nummer, die von der Gemeinde für eine andere natürliche Person vergeben wird. (Max. 17 Zeichen)',
      inpA_nummerTooltip:
        'Die Verwaltungsnummer der Person im Sinne des Wet BRP. (Numerisch, max. 10 Zeichen)',
      'set-zaakstatus': 'Fallstatus erstellen',
      statustypeUrl: 'URL des Zaakstatustyps',
      statustypeUrlTooltip: 'URL-Referenz zum Statustyp.',
      datumStatusGezet: 'Datumsstatus festgelegt.',
      datumStatusGezetTooltip: 'Datums-/Uhrzeitwert des zaakstatus.',
      datumStatusGezetInvalidText: 'Datum und Uhrzeit dürfen nicht in der Zukunft liegen.',
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
      inputDatumStatusGezetToggle: 'Eingabetyp datum status gezet',
      inputTypeZaakResultaatToggle: 'Eingabetyp Zaakresultaat-URL',
      addZaakProperty: 'Neue Case-Eigenschaft hinzufügen',
      'relateer-zaken': 'Beziehung zwischen Zaken herstellen',
      teRelaterenZaakUri: 'URL zum zu verknüpfenden Zaak',
      aardRelatie: 'Art der Beziehung',
      'option-vervolg': 'Der andere Zaak gab Anlass zur Einleitung des aktuellen Zaak.',
      'option-onderwerp': 'Der andere Zaak ist relevant für bzw. Gegenstand des aktuellen Zaak.',
      'option-bijdrage': 'Der aktuelle Zaak trägt zum Ergebnis des anderen Zaak bei.',
      identificatie: 'Identifikation',
      identificatieMedewerkerTooltip:
        'Eine kurze, eindeutige Bezeichnung des Mitarbeiters. (Max. 24 Zeichen)',
      identificatieOrganisatorischeEenheidTooltip:
        'Eine kurze Identifikation der organisatorischen Einheit. (Max. 24 Zeichen)',
      voorletters: 'Initialen',
      voorlettersTooltip:
        'Die Sammlung von Buchstaben, die durch den ersten Buchstaben aller in Reihenfolge vorkommenden Vornamen gebildet wird.',
      achternaam: 'Nachname',
      achternaamTooltip:
        'Der Nachname, wie ihn der Mitarbeiter im täglichen Verkehr verwendet. (Max. 200 Zeichen)',
      voorvoegselAchternaam: 'Nachnamenspräfix',
      voorvoegselAchternaamTooltip:
        'Teil des Gattungsnamens, der in Tabelle 36 (GBA), Präfixtabelle, erscheint und durch ein Leerzeichen vom Gattungsnamen getrennt ist. (Max. 10 Zeichen)',
      afwijkendeNaamBetrokkene: 'Abweichender Name der betroffenen Person',
      afwijkendeNaamBetrokkeneTooltip:
        'Der Name der betroffenen Person, unter dem sie im Zusammenhang mit dem Vorgang angesprochen werden möchte. (Max. 625 Zeichen)',
      indicatieMachtiging: 'Vollmachtsanzeige',
      indicatieMachtigingTooltip: 'Der Typ, der die Vollmachtsanzeige darstellt',
      nvt: 'Nicht zutreffend',
      gemachtigde: 'Bevollmächtigter',
      machtiginggever: 'Vollmachtgeber',
      naam: 'Name',
      naamTooltip: 'Der tatsächliche Name der organisatorischen Einheit.',
      isGehuisvestIn: 'Ist untergebracht in',
      isGehuisvestInTooltip:
        'Ort, an dem die organisatorische Einheit untergebracht ist. (Max. 24 Zeichen)',
      handelsnaam: 'Handelsname',
      handelsnaamTooltip:
        'Der Name der Niederlassung, in der das Geschäft betrieben wird. (Max. 625 Zeichen)',
      kvkNummer: 'Handelskammernummer',
      kvkNummerTooltip:
        'Eine eindeutige Nummer, die von der Handelskammer vergeben wird. (Max. 8 Zeichen)',
      vestigingsNummer: 'Niederlassungsnummer',
      vestigingsNummerTooltip:
        'Eine kurze eindeutige Bezeichnung der Niederlassung. (Max. 24 Zeichen)',
      'get-zaakbesluiten': 'Zaakbesluiten abrufen',
      'patch-zaak': 'Zaak aktualisieren',
      patchZaakInformation:
        'Mit dieser Aktion können Sie die Eigenschaften des Falls in der mit der Datei verknüpften Zaken-API aktualisieren.',
      addPatchZaakProperty: 'Parameter hinzufügen',
      dateformatTooltip:
        'Ein Datum im Format yyyy-mm-dd. Kann auch ein Verweis auf das Dokument oder den Prozess sein, zum Beispiel doc:kunde/startDatum oder pv:startDatum',
      omschrijving: 'Beschreibung',
      explanation: 'Erläuterung',
      plannedEndDate: 'Geplantes Enddatum',
      finalDeliveryDate: 'Letztes Lieferdatum',
      publicationDate: 'Veröffentlichungsdatum',
      communicationChannel: 'Kommunikationskanal (URL)',
      communicationChannelName: 'Name des Kommunikationskanals',
      paymentIndication: 'Zahlungsanzeige',
      lastPaymentDate: 'Letztes Zahlungsdatum',
      caseGeometry: 'Vorgangsgeometrie',
      caseGeometryType: 'Vorgangsgeometrie type',
      caseGeometryCoordinates: 'Vorgangsgeometrie Koordinaten',
      caseGeometryCoordinatesTooltip: 'Liste von Punkten, zB [0.0, 1.0]',
      mainCase: 'Hauptvorgang',
      archiveActionDate: 'Archivierungsaktionsdatum',
      startDateRetentionPeriod: 'Startdatum der Aufbewahrungsfrist',
      zaakObjectObjectUrl: 'Objekt-URL',
      zaakObjectObjectUrlTooltip: 'URL-Referenz zur Ressource, die das OBJECT beschreibt.',
      objectType: 'Objekttyp',
      objectTypeTooltip:
        'Beschreibt den Typ des OBJECT, das mit dem ZAAK verbunden ist. Wenn kein passender Typ vorhanden ist, muss der Typ unter objectTypeOverige angegeben werden.',
      relatieomschrijving: 'Beziehungsbeschreibung',
      relatieomschrijvingTooltip: 'Beschreibung der Beziehung zwischen dem ZAAK und dem OBJECT.',
      zakelijkRechtIdentificatie: 'Grundstücksrechtsidentifikation',
      zakelijkRechtIdentificatieTooltip: 'Die eindeutige Identifikation des OBJECT',
      zakelijkRechtAvgAard: 'Grundstücksrecht AVG Art',
      zakelijkRechtAvgAardTooltip: 'Kennzeichnung der Art des Rechts',
      objectTypeOverige: 'Sonstiger Objekttyp',
      objectTypeOverigeTooltip:
        'Beschreibt den Typ des OBJECT, wenn objectType den Wert „overige“ hat.',
      objectTypeOverigeDefinitie: 'Sonstiger Objekttyp-Definition',
      objectTypeOverigeDefinitieUrl: 'URL',
      objectTypeOverigeDefinitieUrlTooltip:
        'URL-Referenz zur Objekttyp-Ressource in einer API. Diese Ressource muss die JSON-Schema-Definition des Objekttyps enthalten.',
      objectTypeOverigeDefinitieSchema: 'Schema',
      objectTypeOverigeDefinitieSchemaTooltip:
        'Ein gültiger jq-Ausdruck. Dies wird mit der Ressource aus dem URL-Attribut kombiniert, um das Schema des Objekttyps auszulesen. Beispiel: .jsonSchema.',
      objectTypeOverigeDefinitieObjectData: 'Objektdaten',
      objectTypeOverigeDefinitieObjectDataTooltip:
        'Ein gültiger jq-Ausdruck. Dies wird mit den JSON-Daten aus der OBJEKT-URL kombiniert, um die Objektdaten auszulesen und die Struktur der Daten gegen das Schema zu validieren. Beispiel: .record.data.',
      objectIdentificatie: 'Objektidentifikation',
      rolUuid: 'Rolle UUID',
      rolUuidTooltip: 'Die UUID der Rolle',
      createZaakrolNietNatuurlijkPersoonIdentifierFieldsInformation:
        'Mindestens eines der folgenden Felder muss ausgefüllt werden, um die juristische Person zu identifizieren:<br/>- Keine natürliche Personennummer<br/>- Andere Identifizierung keine natürlicher Personen<br/>- Handelskammernummer<br/>- Niederlassungsnummer',
      'get-zaak-informatieobjecten': 'Informatieobjecten zum Fall abrufen',
      resultProcessVariable: 'Ergebnis Prozessvariable',
      resultProcessVariableTooltip: 'Der Name der Prozessvariable, in der das Ergebnis gespeichert wird.',
      rolUuid: 'Rolle UUID',
      rolUuidTooltip: 'Die UUID der Rolle'
    },
  },
};

export {zakenApiPluginSpecification};
