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
  //   'Catalogi API',
  //   'Documenten API',
  //   'Klantinteracties API',
  //   'Notificaties API',
  //   'OpenNotificaties',
  //   'Objecten API',
  //   'Object token authentication',
  //   'Objecttypen API',
  //   'OpenKlant token authentication',
  //   'OpenZaak',
  //   'Portal task',
  //   'SmartDocuments',
  //   'Verzoek',
  //   'Zaken API',
];

export const pluginTestConfiguration = {
  'Besluiten API': {
    fieldMap: [
      {
        testId: 'pluginConfigurationId',
        type: 'input',
        value: '857d4312-c420-4a22-979b-625818d97ed4',
      },
      {testId: 'besluitenApiUrlConfigurationTitle', type: 'input', value: 'Test Besluiten API'},
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
      {testId: 'configurationId', type: 'input', value: '22c78b91-0b0f-4008-8d8f-c4a84b8e71ed'},
      {testId: 'configurationName', type: 'input', value: 'Test Catalogi API'},
      {testId: 'catalogiApiUrl', type: 'input', value: 'http://localhost:8001/catalogi/api/v1/'},
      {
        testId: 'authenticationPluginConfiguration',
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
    ],
    pluginIdentifier: 'Test Catalogi API',
  },

  'Documenten API': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: '5474fe57-532a-4050-8d89-32e62ca3e896'},
      {testId: 'configurationName', type: 'input', value: 'Test Documenten API'},
      {
        testId: 'documentenApiUrl',
        type: 'input',
        value: 'http://localhost:8001/documenten/api/v1/',
      },
      {testId: 'organisationRsin', type: 'input', value: '151368508'},
      {
        testId: 'authenticationPluginConfiguration',
        type: 'select',
        value: 'OpenZaak Authentication - OpenZaak',
      },
      {testId: 'documentenApiVersion', type: 'input', value: '1.4.2-maykin-1.13.0'},
    ],
    pluginIdentifier: 'Test Documenten API',
  },

  'Klantinteracties API': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: '5474fe57-532a-4050-8d89-32e62ca3e896'},
      {testId: 'configurationName', type: 'input', value: 'Besluiten config'},
      {testId: 'klantinteractiesApiUrl', type: 'input', value: 'Besluiten config'},
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
      {testId: 'configurationId', type: 'input', value: 'config-besluiten-id'},
      {testId: 'configurationName', type: 'input', value: 'Test Notificaties API'},
      {testId: 'notificatiesApiUrl', type: 'input', value: 'Besluiten config'},
      {testId: 'callbackUrl', type: 'input', value: '123456789'},
      {
        testId: 'authenticationPluginConfiguration',
        type: 'select',
        value: '123456789',
      },
    ],
    pluginIdentifier: 'Test Notificaties API',
  },

  OpenNotificaties: {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: 'config-besluiten-id'},
      {testId: 'configurationName', type: 'input', value: 'Test OpenNotificaties'},
      {testId: 'clientId', type: 'input', value: 'Besluiten config'},
      {testId: 'secret', type: 'input', value: '123456789'},
    ],
    pluginIdentifier: 'Test OpenNotificaties',
  },

  'Objecten API': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: 'config-besluiten-id'},
      {testId: 'configurationName', type: 'input', value: 'Test Objecten API'},
      {testId: 'objectenApiUrl', type: 'input', value: 'Besluiten config'},
      {
        testId: 'authenticationPluginConfiguration',
        type: 'select',
        value: '123456789',
      },
    ],
    pluginIdentifier: 'Test Objecten API',
  },

  'Object token authentication': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: 'config-besluiten-id'},
      {testId: 'configurationName', type: 'input', value: 'Test Object token authentication'},
      {testId: 'token', type: 'input', value: 'Besluiten config'},
    ],
    pluginIdentifier: 'Test Object token authentication',
  },

  'Objecttypen API': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: 'config-besluiten-id'},
      {testId: 'configurationName', type: 'input', value: 'Test Objecttypen API'},
      {testId: 'objecttypenApiUr', type: 'input', value: 'Besluiten config'},
      {
        testId: 'authenticationPluginConfiguration',
        type: 'select',
        value: 'Besluiten config',
      },
    ],
    pluginIdentifier: 'Test Objecttypen API',
  },

  'OpenKlant token authentication': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: 'config-besluiten-id'},
      {testId: 'configurationName', type: 'input', value: 'Test OpenKlant token authentication'},
      {testId: 'token', type: 'input', value: 'Besluiten config'},
    ],
    pluginIdentifier: 'Test OpenKlant token authentication',
  },

  OpenZaak: {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: 'config-besluiten-id'},
      {testId: 'configurationName', type: 'input', value: 'Test OpenZaak'},
      {testId: 'clientId', type: 'input', value: 'Besluiten config'},
      {testId: 'secret', type: 'input', value: 'Besluiten config'},
    ],
    pluginIdentifier: 'Test OpenZaak',
  },

  'Portal task': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: 'config-besluiten-id'},
      {testId: 'configurationName', type: 'input', value: 'Test Portal task'},
      {testId: 'notificatiesApiPlugin', type: 'input', value: 'Besluiten config'},
      {testId: 'objectManagementConfiguration', type: 'input', value: 'Besluiten config'},
      {testId: 'processToCompletePortaaltaak', type: 'input', value: 'Besluiten config'},
    ],
    pluginIdentifier: 'Test Portal task',
  },

  SmartDocuments: {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: 'config-besluiten-id'},
      {testId: 'configurationName', type: 'input', value: 'Test SmartDocuments'},
      {testId: 'notificatiesApiPlugin', type: 'input', value: 'Besluiten config'},
      {testId: 'username', type: 'input', value: 'Besluiten config'},
      {testId: 'password', type: 'input', value: 'Besluiten config'},
    ],
    pluginIdentifier: 'Test SmartDocuments',
  },

  Verzoek: {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: 'config-besluiten-id'},
      {testId: 'configurationName', type: 'input', value: 'Test Verzoek'},
      {testId: 'notificatiesApiConfiguration', type: 'input', value: 'Besluiten config'},
      {testId: 'process', type: 'input', value: 'Besluiten config'},
      {testId: 'rsin', type: 'input', value: 'Besluiten config'},
    ],
    pluginIdentifier: 'Test Verzoek',
  },

  'Zaken API': {
    fieldMap: [
      {testId: 'configurationId', type: 'input', value: 'config-besluiten-id'},
      {testId: 'configurationName', type: 'input', value: 'Test Zaken API'},
      {testId: 'url', type: 'input', value: 'Besluiten config'},
      {
        testId: 'authenticationPluginConfiguration',
        type: 'select',
        value: 'Besluiten config',
      },
    ],
    pluginIdentifier: 'Test Zaken API',
  },
};
