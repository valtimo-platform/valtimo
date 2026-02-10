export interface IkoPropertyField {
  testId: string;
  value: string;
}

export interface IkoServerConfiguration {
  title: string;
  key: string;
  propertyFields: IkoPropertyField[];
}

export interface IkoViewConfiguration {
  title: string;
  key: string;
  propertyFields: IkoPropertyField[];
}

export const serverConfiguration: IkoServerConfiguration = {
  title: 'IKO e2e test server',
  key: 'iko-e2e-test-server',
  propertyFields: [
    {
      testId: 'ikoProperty-ikoServerUrl',
      value: 'https://google.com',
    },
  ],
};

export const viewConfiguration: IkoViewConfiguration = {
  title: 'Klant',
  key: 'klant',
  propertyFields: [
    {
      testId: 'ikoProperty-connectorTag',
      value: 'klant',
    },
    {
      testId: 'ikoProperty-connectorInstanceTag',
      value: 'lokaal',
    },
    {
      testId: 'ikoProperty-endpointOperation',
      value: 'lijst',
    },
  ],
};
