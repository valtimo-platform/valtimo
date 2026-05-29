/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {randomUUID} from 'crypto';
import {
  DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS,
  BESLUITEN_API_CONFIGURATION_TEST_IDS,
  CATALOGI_API_CONFIGURATION_TEST_IDS,
  DOCUMENTEN_API_CONFIGURATION_TEST_IDS,
  KLANTINTERACTIES_API_CONFIGURATION_TEST_IDS,
  NOTIFICATIES_API_CONFIGURATION_TEST_IDS,
  OPEN_NOTIFICATIES_CONFIGURATION_TEST_IDS,
  OBJECTEN_API_CONFIGURATION_TEST_IDS,
  OBJECT_TOKEN_AUTHENTICATION_CONFIGURATION_TEST_IDS,
  OBJECTTYPEN_API_CONFIGURATION_TEST_IDS,
  OPEN_KLANT_TOKEN_AUTHENTICATION_CONFIGURATION_TEST_IDS,
  OPEN_ZAAK_CONFIGURATION_TEST_IDS,
  PORTAALTAAK_CONFIGURATION_TEST_IDS,
  SMART_DOCUMENTS_CONFIGURATION_TEST_IDS,
  VERZOEK_CONFIGURATION_TEST_IDS,
  ZAKEN_API_CONFIGURATION_TEST_IDS,
} from '../../../constants';

export interface PluginFieldMap {
  testId: string;
  type: 'input' | 'select';
  value: string;
}

export interface PluginTestConfiguration {
  fieldMap: PluginFieldMap[];
  pluginIdentifier: string;
}

export const pluginTypes = [
  'Besluiten API',
  'Catalogi API',
  // 'Documenten API',
  // 'Klantinteracties API',
  // 'Notificaties API',
  // 'OpenNotificaties',
  // 'Objecten API',
  // 'Object token authentication',
  // 'Objecttypen API',
  // 'OpenKlant token authentication',
  // 'OpenZaak',
  // 'Portaaltaak',
  // 'SmartDocuments',
  // 'Verzoek',
  // 'Zaken API',
];

export const pluginTestConfiguration = {
  'Besluiten API': {
    fieldMap: [
      {
        testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId,
        type: 'input',
        value: randomUUID(),
      },
      {testId: BESLUITEN_API_CONFIGURATION_TEST_IDS.configurationTitle, type: 'input', value: 'Test Besluiten API Plugin'},
      {testId: BESLUITEN_API_CONFIGURATION_TEST_IDS.rsin, type: 'input', value: '328674989'},
      {testId: BESLUITEN_API_CONFIGURATION_TEST_IDS.url, type: 'input', value: 'http://localhost:8001/besluiten/api/v1/'},
      {
        testId: BESLUITEN_API_CONFIGURATION_TEST_IDS.authenticationPluginConfiguration,
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
    ],
    pluginIdentifier: 'Test Besluiten API Plugin',
  },
  'Catalogi API': {
    fieldMap: [
      {testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId, type: 'input', value: randomUUID()},
      {testId: CATALOGI_API_CONFIGURATION_TEST_IDS.configurationTitle, type: 'input', value: 'Test Catalogi API Plugin'},
      {testId: CATALOGI_API_CONFIGURATION_TEST_IDS.url, type: 'input', value: 'http://localhost:8001/catalogi/api/v1/'},
      {
        testId: CATALOGI_API_CONFIGURATION_TEST_IDS.authenticationPluginConfiguration,
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
    ],
    pluginIdentifier: 'Test Catalogi API',
  },
  'Catalogi API Same ID': {
    fieldMap: [
      {
        testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId,
        type: 'input',
        value: '72196b0c-90da-4df2-84d7-42d419170edc',
      },
      {testId: CATALOGI_API_CONFIGURATION_TEST_IDS.configurationTitle, type: 'input', value: 'Test Catalogi API Plugin'},
      {testId: CATALOGI_API_CONFIGURATION_TEST_IDS.url, type: 'input', value: 'http://localhost:8001/catalogi/api/v1/'},
      {
        testId: CATALOGI_API_CONFIGURATION_TEST_IDS.authenticationPluginConfiguration,
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
    ],
    pluginIdentifier: 'Test Catalogi API',
  },

  'Documenten API': {
    fieldMap: [
      {testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId, type: 'input', value: randomUUID()},
      {
        testId: DOCUMENTEN_API_CONFIGURATION_TEST_IDS.configurationTitle,
        type: 'input',
        value: 'Test Documenten API Plugin',
      },
      {
        testId: DOCUMENTEN_API_CONFIGURATION_TEST_IDS.url,
        type: 'input',
        value: 'http://localhost:8001/documenten/api/v1/',
      },
      {testId: DOCUMENTEN_API_CONFIGURATION_TEST_IDS.bronorganisatie, type: 'input', value: '151368513'},
      {
        testId: DOCUMENTEN_API_CONFIGURATION_TEST_IDS.authenticationPluginConfiguration,
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
      {
        testId: DOCUMENTEN_API_CONFIGURATION_TEST_IDS.apiVersion,
        type: 'select',
        value: '1.4.2-maykin-1.13.0',
      },
    ],
    pluginIdentifier: 'Test Documenten API',
  },

  'Klantinteracties API': {
    fieldMap: [
      {testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId, type: 'input', value: randomUUID()},
      {
        testId: KLANTINTERACTIES_API_CONFIGURATION_TEST_IDS.configurationTitle,
        type: 'input',
        value: 'Test Klantinteracties API Plugin',
      },
      {
        testId: KLANTINTERACTIES_API_CONFIGURATION_TEST_IDS.url,
        type: 'input',
        value: 'http://localhost:8001/klantinteracties/api/v1',
      },
      {
        testId: KLANTINTERACTIES_API_CONFIGURATION_TEST_IDS.authenticationPluginConfiguration,
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
    ],
    pluginIdentifier: 'Test Klantinteracties API',
  },

  'Notificaties API': {
    fieldMap: [
      {testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId, type: 'input', value: randomUUID()},
      {
        testId: NOTIFICATIES_API_CONFIGURATION_TEST_IDS.configurationTitle,
        type: 'input',
        value: 'Test Notificaties API Plugin',
      },
      {testId: NOTIFICATIES_API_CONFIGURATION_TEST_IDS.url, type: 'input', value: 'http://localhost:8002/api/v1/'},
      {
        testId: NOTIFICATIES_API_CONFIGURATION_TEST_IDS.callbackUrl,
        type: 'input',
        value: 'http://localhost:8080/api/v1/notificatiesapi/callback',
      },
      {
        testId: NOTIFICATIES_API_CONFIGURATION_TEST_IDS.authenticationPluginConfiguration,
        type: 'select',
        value: 'OpenNotificaties Authentication - OpenNotificaties',
      },
    ],
    pluginIdentifier: 'Test Notificaties API',
  },

  OpenNotificaties: {
    fieldMap: [
      {testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId, type: 'input', value: randomUUID()},
      {
        testId: OPEN_NOTIFICATIES_CONFIGURATION_TEST_IDS.configurationTitle,
        type: 'input',
        value: 'Test OpenNotificaties Plugin',
      },
      {testId: OPEN_NOTIFICATIES_CONFIGURATION_TEST_IDS.clientId, type: 'input', value: 'valtimo_client'},
      {testId: OPEN_NOTIFICATIES_CONFIGURATION_TEST_IDS.clientSecret, type: 'input', value: '123456789'},
    ],
    pluginIdentifier: 'Test OpenNotificaties',
  },

  'Objecten API': {
    fieldMap: [
      {testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId, type: 'input', value: randomUUID()},
      {testId: OBJECTEN_API_CONFIGURATION_TEST_IDS.configurationTitle, type: 'input', value: 'Test Objecten API Plugin'},
      {testId: OBJECTEN_API_CONFIGURATION_TEST_IDS.url, type: 'input', value: 'http://localhost:8002/api/v1/'},
      {
        testId: OBJECTEN_API_CONFIGURATION_TEST_IDS.authenticationPluginConfiguration,
        type: 'select',
        value: 'Objecten API Authentication - Object token authentication',
      },
    ],
    pluginIdentifier: 'Test Objecten API',
  },

  'Object token authentication': {
    fieldMap: [
      {testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId, type: 'input', value: randomUUID()},
      {
        testId: OBJECT_TOKEN_AUTHENTICATION_CONFIGURATION_TEST_IDS.configurationTitle,
        type: 'input',
        value: 'Test Object token authentication Plugin',
      },
      {testId: OBJECT_TOKEN_AUTHENTICATION_CONFIGURATION_TEST_IDS.token, type: 'input', value: '593028174662901385427'},
    ],
    pluginIdentifier: 'Test Object token authentication',
  },

  'Objecttypen API': {
    fieldMap: [
      {testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId, type: 'input', value: randomUUID()},
      {
        testId: OBJECTTYPEN_API_CONFIGURATION_TEST_IDS.configurationTitle,
        type: 'input',
        value: 'Test Objecttypen API Plugin',
      },
      {testId: OBJECTTYPEN_API_CONFIGURATION_TEST_IDS.url, type: 'input', value: 'http://localhost:8002/api/v1/'},
      {
        testId: OBJECTTYPEN_API_CONFIGURATION_TEST_IDS.authenticationPluginConfiguration,
        type: 'select',
        value: 'Objecten API Authentication - Object token authentication',
      },
    ],
    pluginIdentifier: 'Test Objecttypen API',
  },

  'OpenKlant token authentication': {
    fieldMap: [
      {testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId, type: 'input', value: randomUUID()},
      {
        testId: OPEN_KLANT_TOKEN_AUTHENTICATION_CONFIGURATION_TEST_IDS.configurationTitle,
        type: 'input',
        value: 'Test OpenKlant token authentication Plugin',
      },
      {testId: OPEN_KLANT_TOKEN_AUTHENTICATION_CONFIGURATION_TEST_IDS.token, type: 'input', value: '804193275660982431517'},
    ],
    pluginIdentifier: 'Test OpenKlant token authentication',
  },

  OpenZaak: {
    fieldMap: [
      {testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId, type: 'input', value: randomUUID()},
      {testId: OPEN_ZAAK_CONFIGURATION_TEST_IDS.configurationTitle, type: 'input', value: 'Test OpenZaak Plugin'},
      {testId: OPEN_ZAAK_CONFIGURATION_TEST_IDS.clientId, type: 'input', value: 'valtimo_client'},
      {testId: OPEN_ZAAK_CONFIGURATION_TEST_IDS.clientSecret, type: 'input', value: '129870443512908776534'},
    ],
    pluginIdentifier: 'Test OpenZaak',
  },

  Portaaltaak: {
    fieldMap: [
      {testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId, type: 'input', value: randomUUID()},
      {testId: PORTAALTAAK_CONFIGURATION_TEST_IDS.configurationTitle, type: 'input', value: 'Test Portaaltaak Plugin'},
      {
        testId: PORTAALTAAK_CONFIGURATION_TEST_IDS.notificatiesApiPluginConfiguration,
        type: 'select',
        value: 'Notificaties API - Notificaties API',
      },
      {
        testId: PORTAALTAAK_CONFIGURATION_TEST_IDS.objectManagementConfiguration,
        type: 'select',
        value: 'Bezwaar',
      },
      {
        testId: PORTAALTAAK_CONFIGURATION_TEST_IDS.completeTaakProcess,
        type: 'select',
        value: 'Bezwaar',
      },
    ],
    pluginIdentifier: 'Test Portal task',
  },

  SmartDocuments: {
    fieldMap: [
      {testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId, type: 'input', value: randomUUID()},
      {
        testId: SMART_DOCUMENTS_CONFIGURATION_TEST_IDS.configurationTitle,
        type: 'input',
        value: 'Test SmartDocuments Plugin',
      },
      {testId: SMART_DOCUMENTS_CONFIGURATION_TEST_IDS.url, type: 'input', value: 'http://localhost:8002'},
      {testId: SMART_DOCUMENTS_CONFIGURATION_TEST_IDS.username, type: 'input', value: 'valtimo_client'},
      {testId: SMART_DOCUMENTS_CONFIGURATION_TEST_IDS.password, type: 'input', value: '705913488227640159382'},
    ],
    pluginIdentifier: 'Test SmartDocuments',
  },

  Verzoek: {
    fieldMap: [
      {testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId, type: 'input', value: randomUUID()},
      {testId: VERZOEK_CONFIGURATION_TEST_IDS.configurationTitle, type: 'input', value: 'Test Verzoek Plugin'},
      {
        testId: VERZOEK_CONFIGURATION_TEST_IDS.notificatiesApiPluginConfiguration,
        type: 'select',
        value: 'Notificaties API - Notificaties API',
      },
      {
        testId: VERZOEK_CONFIGURATION_TEST_IDS.processToStart,
        type: 'select',
        value: 'Bezwaar',
      },
      {
        testId: VERZOEK_CONFIGURATION_TEST_IDS.rsin,
        type: 'input',
        value: 'rsin',
      },
    ],
    pluginIdentifier: 'Test Verzoek',
  },

  'Zaken API': {
    fieldMap: [
      {testId: DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId, type: 'input', value: randomUUID()},
      {testId: ZAKEN_API_CONFIGURATION_TEST_IDS.configurationTitle, type: 'input', value: 'Test Zaken API Plugin'},
      {testId: ZAKEN_API_CONFIGURATION_TEST_IDS.url, type: 'input', value: 'http://localhost:8002/zaken/api/v1'},
      {
        testId: ZAKEN_API_CONFIGURATION_TEST_IDS.authenticationPluginConfiguration,
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
    ],
    pluginIdentifier: 'Test Zaken API',
  },
};
