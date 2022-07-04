/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.See the License for the specific language governing permissions and limitations under the License.
 */

import {PluginSpecification} from '../../models';
import {OpenZaakConfigurationComponent} from './components/open-zaak-configuration/open-zaak-configuration.component';
import {OPEN_ZAAK_PLUGIN_LOGO_BASE64} from './assets';
import {CreateZaakConfigurationComponent} from './components/create-zaak-configuration/create-zaak-configuration.component';
import {SetBesluitConfigurationComponent} from './components/set-besluit-configuration/set-besluit-configuration.component';
import {SetResultaatConfigurationComponent} from './components/set-resultaat-configuration/set-resultaat-configuration.component';
import {SetStatusConfigurationComponent} from './components/set-status-configuration/set-status-configuration.component';

const openZaakPluginSpecification: PluginSpecification = {
  pluginId: 'openzaak',
  pluginConfigurationComponent: OpenZaakConfigurationComponent,
  pluginLogoBase64: OPEN_ZAAK_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'create-zaak': CreateZaakConfigurationComponent,
    'set-status': SetStatusConfigurationComponent,
    'set-resultaat': SetResultaatConfigurationComponent,
    'set-besluit': SetBesluitConfigurationComponent,
  },
  pluginTranslations: {
    nl: {
      title: 'OpenZaak',
      description:
        'OpenZaak is een productiewaardig API platform die de API-standaard voor zaakgericht werken implementeert (de ZGW-API’s).',
      'create-zaak': 'Zaak aanmaken',
      'set-status': 'Status instellen',
      'set-resultaat': 'Resultaat instellen',
      'set-besluit': 'Besluit instellen',
      configurationTitle: 'Configuratienaam',
      url: 'OpenZaak URL',
      clientId: 'Client ID',
      secret: 'Secret',
      rsin: 'Rsin',
      catalogusUrl: 'Catalogus URL',
      zaakType: 'Zaaktype',
      zaakStatus: 'Zaakstatus',
      zaakResultaat: 'Resultaat',
      besluit: 'Besluit',
      documentDefinition: 'Documentdefinitie',
      noZaakTypeSelected: 'Geen zaaktype geselecteerd',
      noZaakTypeLinksFound: "Geen gelinkte zaaktype's gevonden",
      noProcessDefinition: 'Er is geen procesdefinitie geselecteerd',
    },
    en: {
      title: 'OpenZaak',
      description:
        'OpenZaak is a production-worthy API platform that implements the API standard for case-oriented working (the ZGW APIs).',
      'create-zaak': 'Create zaak',
      'set-status': 'Set status',
      'set-resultaat': 'Set result',
      'set-besluit': 'Set besluit',
      configurationTitle: 'Configuration name',
      url: 'OpenZaak URL',
      clientId: 'Client ID',
      secret: 'Secret',
      rsin: 'Rsin',
      catalogusUrl: 'Catalog URL',
      zaakType: 'Zaaktype',
      zaakStatus: 'Zaakstatus',
      zaakResultaat: 'Result',
      besluit: 'Besluit',
      documentDefinition: 'Document definition',
      noZaakTypeSelected: 'No zaaktype selected',
      noZaakTypeLinksFound: 'No linked zaaktypes found',
      noProcessDefinition: 'No process definition is selected',
    },
    de: {
      title: 'OpenZaak',
      description:
        'OpenZaak ist eine produktionstaugliche API-Plattform, die den API-Standard für fallorientiertes Arbeiten (die ZGW-APIs) implementiert.',
      'create-zaak': 'Zaak erstellen',
      'set-status': 'Status festlegen',
      'set-resultaat': 'Ergebnis einstellen',
      'set-besluit': 'Besluit setzen',
      configurationTitle: 'Konfigurationsname',
      url: 'OpenZaak URL',
      clientId: 'Client ID',
      secret: 'Secret',
      rsin: 'Rsin',
      catalogusUrl: 'Katalog URL',
      zaakType: 'Zaaktype',
      zaakStatus: 'Zaakstatus',
      zaakResultaat: 'Resultat',
      besluit: 'Besluit',
      documentDefinition: 'Dokumentendefinition',
      noZaakTypeSelected: 'Kein Zaaktype ausgewählt',
      noZaakTypeLinksFound: 'Keine verknüpften Zaaktypen gefunden',
      noProcessDefinition: 'Es ist keine Prozessdefinition ausgewählt',
    },
  },
};

export {openZaakPluginSpecification};
