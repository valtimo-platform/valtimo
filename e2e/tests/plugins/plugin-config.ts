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

import { randomUUID as uuidv4 } from 'crypto';

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
        testId: 'pluginConfigurationId',
        type: 'input',
        value: uuidv4(),
      },
      {testId: 'besluitenApiConfigurationTitle', type: 'input', value: 'Test Besluiten API Plugin'},
      {testId: 'besluitenApiRsin', type: 'input', value: '328674989'},
      {testId: 'besluitenApiUrl', type: 'input', value: 'http://localhost:8001/besluiten/api/v1/'},
      {
        testId: 'besluitenApiAuthenticationPluginConfiguration',
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
    ],
    pluginIdentifier: 'Test Besluiten API Plugin',
  },
  'Catalogi API': {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {testId: 'catalogiApiConfigurationTitle', type: 'input', value: 'Test Catalogi API Plugin'},
      {testId: 'catalogiApiUrl', type: 'input', value: 'http://localhost:8001/catalogi/api/v1/'},
      {
        testId: 'catalogApiAuthenticationPluginConfiguration',
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
    ],
    pluginIdentifier: 'Test Catalogi API',
  },
  'Catalogi API Same ID': {
    fieldMap: [
      {
        testId: 'pluginConfigurationId',
        type: 'input',
        value: '72196b0c-90da-4df2-84d7-42d419170edc',
      },
      {testId: 'catalogiApiConfigurationTitle', type: 'input', value: 'Test Catalogi API Plugin'},
      {testId: 'catalogiApiUrl', type: 'input', value: 'http://localhost:8001/catalogi/api/v1/'},
      {
        testId: 'catalogApiAuthenticationPluginConfiguration',
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
    ],
    pluginIdentifier: 'Test Catalogi API',
  },

  'Documenten API': {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {
        testId: 'documentenApiConfigurationTitle',
        type: 'input',
        value: 'Test Documenten API Plugin',
      },
      {
        testId: 'documentenApiUrl',
        type: 'input',
        value: 'http://localhost:8001/documenten/api/v1/',
      },
      {testId: 'documentenApiBronorganisatie', type: 'input', value: '151368513'},
      {
        testId: 'documentenApiAuthenticationPluginConfiguration',
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
      {
        testId: 'documentenApiApiVersion',
        type: 'select',
        value: '1.4.2-maykin-1.13.0',
      },
    ],
    pluginIdentifier: 'Test Documenten API',
  },

  'Klantinteracties API': {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {
        testId: 'klantInteractiesApiConfigurationTitle',
        type: 'input',
        value: 'Test Klantinteracties API Plugin',
      },
      {
        testId: 'klantInteractiesApiUrl',
        type: 'input',
        value: 'http://localhost:8001/klantinteracties/api/v1',
      },
      {
        testId: 'klantInteractiesApiAuthenticationPluginConfiguration',
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
    ],
    pluginIdentifier: 'Test Klantinteracties API',
  },

  'Notificaties API': {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {
        testId: 'notificatiesApiConfigurationTitle',
        type: 'input',
        value: 'Test Notificaties API Plugin',
      },
      {testId: 'notificatiesApiUrl', type: 'input', value: 'http://localhost:8002/api/v1/'},
      {
        testId: 'notificatiesApiCallbackUrl',
        type: 'input',
        value: 'http://localhost:8080/api/v1/notificatiesapi/callback',
      },
      {
        testId: 'notificatiesApiAuthenticationPluginConfiguration',
        type: 'select',
        value: 'OpenNotificaties Authentication - OpenNotificaties',
      },
    ],
    pluginIdentifier: 'Test Notificaties API',
  },

  OpenNotificaties: {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {
        testId: 'openNotificatiesConfigurationTitle',
        type: 'input',
        value: 'Test OpenNotificaties Plugin',
      },
      {testId: 'openNotificatiesClientId', type: 'input', value: 'valtimo_client'},
      {testId: 'openNotificatiesClientSecret', type: 'input', value: '123456789'},
    ],
    pluginIdentifier: 'Test OpenNotificaties',
  },

  'Objecten API': {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {testId: 'objectenApiConfigurationTitle', type: 'input', value: 'Test Objecten API Plugin'},
      {testId: 'objectenApiUrl', type: 'input', value: 'http://localhost:8002/api/v1/'},
      {
        testId: 'objectenApiAuthenticationPluginConfiguration',
        type: 'select',
        value: 'Objecten API Authentication - Object token authentication',
      },
    ],
    pluginIdentifier: 'Test Objecten API',
  },

  'Object token authentication': {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {
        testId: 'objectTokenAuthenticationConfigurationTitle',
        type: 'input',
        value: 'Test Object token authentication Plugin',
      },
      {testId: 'objectTokenAuthenticationToken', type: 'input', value: '593028174662901385427'},
    ],
    pluginIdentifier: 'Test Object token authentication',
  },

  'Objecttypen API': {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {
        testId: 'objecttypenApiConfigurationTitle',
        type: 'input',
        value: 'Test Objecttypen API Plugin',
      },
      {testId: 'objecttypenApiUrl', type: 'input', value: 'http://localhost:8002/api/v1/'},
      {
        testId: 'objecttypenApiAuthenticationPluginConfiguration',
        type: 'select',
        value: 'Objecten API Authentication - Object token authentication',
      },
    ],
    pluginIdentifier: 'Test Objecttypen API',
  },

  'OpenKlant token authentication': {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {
        testId: 'openKlantTokenAuthenticationConfigurationTitle',
        type: 'input',
        value: 'Test OpenKlant token authentication Plugin',
      },
      {testId: 'openKlantTokenAuthenticationToken', type: 'input', value: '804193275660982431517'},
    ],
    pluginIdentifier: 'Test OpenKlant token authentication',
  },

  OpenZaak: {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {testId: 'openZaakConfigurationTitle', type: 'input', value: 'Test OpenZaak Plugin'},
      {testId: 'openZaakClientId', type: 'input', value: 'valtimo_client'},
      {testId: 'openZaakClientSecret', type: 'input', value: '129870443512908776534'},
    ],
    pluginIdentifier: 'Test OpenZaak',
  },

  Portaaltaak: {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {testId: 'portaaltaakConfigurationTitle', type: 'input', value: 'Test Portaaltaak Plugin'},
      {
        testId: 'portaaltaakNotificatiesApiPluginConfiguration',
        type: 'select',
        value: 'Notificaties API - Notificaties API',
      },
      {
        testId: 'portaaltaakObjectManagementConfiguration',
        type: 'select',
        value: 'Bezwaar',
      },
      {
        testId: 'portaaltaakCompleteTaakProcess',
        type: 'select',
        value: 'Bezwaar',
      },
    ],
    pluginIdentifier: 'Test Portal task',
  },

  SmartDocuments: {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {
        testId: 'smartDocumentsConfigurationTitle',
        type: 'input',
        value: 'Test SmartDocuments Plugin',
      },
      {testId: 'smartDocumentsUrl', type: 'input', value: 'http://localhost:8002'},
      {testId: 'smartDocumentsUsername', type: 'input', value: 'valtimo_client'},
      {testId: 'smartDocumentsPassword', type: 'input', value: '705913488227640159382'},
    ],
    pluginIdentifier: 'Test SmartDocuments',
  },

  Verzoek: {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {testId: 'verzoekConfigurationTitle', type: 'input', value: 'Test Verzoek Plugin'},
      {
        testId: 'verzoekNotificatiesApiPluginConfiguration',
        type: 'select',
        value: 'Notificaties API - Notificaties API',
      },
      {
        testId: 'verzoekProcessToStart',
        type: 'select',
        value: 'Bezwaar',
      },
      {
        testId: 'verzoekRsin',
        type: 'input',
        value: 'rsin',
      },
    ],
    pluginIdentifier: 'Test Verzoek',
  },

  'Zaken API': {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {testId: 'zakenApiConfigurationTitle', type: 'input', value: 'Test Zaken API Plugin'},
      {testId: 'zakenApiUrl', type: 'input', value: 'http://localhost:8002/zaken/api/v1'},
      {
        testId: 'zakenApiAuthenticationPluginConfiguration',
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
    ],
    pluginIdentifier: 'Test Zaken API',
  },
};
