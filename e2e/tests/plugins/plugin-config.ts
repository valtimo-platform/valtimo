import {v4 as uuidv4} from 'uuid';

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
  'Documenten API',
  'Klantinteracties API',
  'Notificaties API',
  'OpenNotificaties',
  'Objecten API',
  'Object token authentication',
  'Objecttypen API',
  'OpenKlant token authentication',
  'OpenZaak',
  'Portaaltaak',
  'SmartDocuments',
  'Verzoek',
  'Zaken API',
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
    pluginIdentifier: 'Test Besluiten API',
  },

  'Catalogi API': {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {testId: 'catalogApiConfigurationTitle', type: 'input', value: 'Test Catalogi API Plugin'},
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
      {testId: 'configurationId', type: 'input',  value: uuidv4()},
      {testId: 'configurationName', type: 'input', value: 'Test Documenten API Plugin'},
      {
        testId: 'documentenApiUrl',
        type: 'input',
        value: 'http://localhost:8001/documenten/api/v1/',
      },
      {testId: 'organisationRsin', type: 'input', value: '151368513'},
      {
        testId: 'documentenApiPluginConfiguration',
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
      {
        testId: 'documentenApiVersion',
        type: 'select',
        value: '1.4.2-maykin-1.13.0',
      },
    ],
    pluginIdentifier: 'Test Documenten API',
  },

  'Klantinteracties API': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: uuidv4()},
      {testId: 'configurationName', type: 'input', value: 'Test Klantinteracties API Plugin'},
      {testId: 'klantinteractiesApiUrl', type: 'input', value: 'http://localhost:8001/klantinteracties/api/v1'},
      {
        testId: 'authenticationPluginConfiguration',
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
    ],
    pluginIdentifier: 'Besluiten config',
  },

  'Notificaties API': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: uuidv4()},
      {testId: 'configurationName', type: 'input', value: 'Test Notificaties API Plugin'},
      {testId: 'notificatiesApiUrl', type: 'input', value: 'http://localhost:8002/api/v1/'},
      {testId: 'callbackUrl', type: 'input', value: 'http://localhost:8080/api/v1/notificatiesapi/callback'},
      {
        testId: 'authenticationPluginConfiguration',
        type: 'select',
        value: 'OpenNotificaties Authentication - OpenNotificaties',
      },
    ],
    pluginIdentifier: 'Test Notificaties API',
  },

  'OpenNotificaties': {
    fieldMap: [
      {testId: 'configurationId', type: 'input',value: uuidv4()},
      {testId: 'configurationName', type: 'input', value: 'Test OpenNotificaties Plugin'},
      {testId: 'clientId', type: 'input', value: 'valtimo_client'},
      {testId: 'secret', type: 'input', value: '123456789'},
    ],
    pluginIdentifier: 'Test OpenNotificaties',
  },

  'Objecten API': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: uuidv4()},
      {testId: 'configurationName', type: 'input', value: 'Test Objecten API Plugin'},
      {testId: 'url', type: 'input', value: 'http://localhost:8002/api/v1/'},
      {
        testId: 'authenticationPluginConfigurat',
        type: 'select',
        value: 'Objecten API Authentication - Object token authentication',
      },
    ],
    pluginIdentifier: 'Test Objecten API',
  },

  'Object token authentication': {
    fieldMap: [
      {testId: 'configurationId', type: 'input',value: uuidv4()},
      {testId: 'configurationName', type: 'input', value: 'Test Object token authentication Plugin'},
      {testId: 'token', type: 'input', value: '593028174662901385427'},
    ],
    pluginIdentifier: 'Test Object token authentication',
  },

  'Objecttypen API': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: uuidv4()},
      {testId: 'configurationName', type: 'input', value: 'Test Objecttypen API Plugin'},
      {testId: 'url', type: 'input', value: 'http://localhost:8002/api/v1/'},
      {
        testId: 'authenticationPluginConfigurat',
        type: 'select',
        value: 'Objecten API Authentication - Object token authentication',
      },
    ],
    pluginIdentifier: 'Test Objecttypen API',
  },

  'OpenKlant token authentication': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: uuidv4()},
      {testId: 'configurationName', type: 'input', value: 'Test OpenKlant token authentication Plugin'},
      {testId: 'token', type: 'input', value: '804193275660982431517'},
    ],
    pluginIdentifier: 'Test OpenKlant token authentication',
  },

  'OpenZaak': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: uuidv4()},
      {testId: 'configurationTitle', type: 'input', value: 'Test OpenZaak Plugin'},
      {testId: 'clientId', type: 'input', value: 'valtimo_client'},
      {testId: 'clientSecret', type: 'input', value: '129870443512908776534'},
    ],
    pluginIdentifier: 'Test OpenZaak',
  },

  'Portaaltaak': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: uuidv4()},
      {testId: 'configurationTitle', type: 'input', value: 'Test Portaaltaak Plugin'},
      {
        testId: 'notificatiesApiPluginConfigura',
        type: 'select',
        value: 'Notificaties API - Notificaties API',
      },
      {
        testId: 'objectManagementConfigurationI',
        type: 'select',
        value: 'Bezwaar',
      },
      {
        testId: 'completeTaakProcess',
        type: 'select',
        value: 'Bezwaar',
      },
    ],
    pluginIdentifier: 'Test Portal task',
  },

  'SmartDocuments': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: uuidv4()},
      {testId: 'configurationName', type: 'input', value: 'Test SmartDocuments Plugin'},
      {testId: 'url', type: 'input', value: 'http://localhost:8002'},
      {testId: 'username', type: 'input', value: 'valtimo_client'},
      {testId: 'password', type: 'input', value: '705913488227640159382'},
    ],
    pluginIdentifier: 'Test SmartDocuments',
  },

  'Verzoek': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: uuidv4()},
      {testId: 'configurationName', type: 'input', value: 'Test Verzoek Plugin'},
      {
        testId: 'notificatiesApiConfiguration',
        type: 'select',
        value: 'Notificaties API - Notificaties API',
      },
      {
        testId: 'process',
        type: 'select',
        value: 'Bezwaar',
      },
      {
        testId: 'rsin',
        type: 'input',
        value: 'rsin',
      },
    ],
    pluginIdentifier: 'Test Verzoek',
  },

  'Zaken API': {
    fieldMap: [
      {testId: 'pluginConfigurationId', type: 'input', value: uuidv4()},
      {testId: 'configurationName', type: 'input', value: 'Test Zaken API Plugin'},
      {testId: 'url', type: 'input', value: 'http://localhost:8002/zaken/api/v1'},
      {
        testId: 'authenticationPluginConfiguration',
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
    ],
    pluginIdentifier: 'Test Zaken API',
  },
};
