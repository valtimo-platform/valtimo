export const endpoints = {
  dashboard: {
    getAll: '/api/management/v1/dashboard',
    get: (key: string) => `/api/management/v1/dashboard/${key}`,
    create: '/api/management/v1/dashboard',
    delete: (key: string) => `/api/management/v1/dashboard/${key}`,
    widgetConfigurations: (dashboardKey: string) =>
      `/api/management/v1/dashboard/${dashboardKey}/widget-configuration`,
    widgetConfiguration: (dashboardKey: string, widgetKey: string) =>
      `/api/management/v1/dashboard/${dashboardKey}/widget-configuration/${widgetKey}`,
    dataSources: '/api/management/v1/dashboard/widget-data-sources',
  },

  formFlow: {
    getAll: '/api/management/v1/form-flow/definition',
    getByKeyAndVersion: (key: string, version: number) =>
      `/api/management/v1/form-flow/definition/${key}/${version}`,
    delete: (key: string) =>
      `/api/management/v1/form-flow/definition/${key}`,
    create: '/api/management/v1/form-flow/definition',
  },

  caseDefinition: {
    create: '/api/management/v1/case-definition/draft',
    delete: (key: string) =>
      `/api/management/v1/case-definition/case/${key}`,
    getAll: '/api/management/v1/case-definition/case',
    getByKey: (key: string) =>
      `/api/management/v1/case-definition/${key}`,
    getByKeyAndVersion: (key: string, version?: string) =>
      `/api/management/v1/case-definition/${key?.toLowerCase()}/version/${version ?? '0.0.1'}`,
    internalStatus: (caseDefinitionName: string) =>
      `/api/management/v1/case-definition/${caseDefinitionName}/internal-status`,
    zgwDocumentColumn: (caseDefinitionName: string) =>
      `/api/management/v1/case-definition/${caseDefinitionName}/zgw-document-column`,
    caseTag: (caseDefinitionName: string) =>
      `/api/management/v1/case-definition/${caseDefinitionName}/case-tag`,
    documentenApiVersion: (caseDefinitionName: string) =>
      `/api/management/v1/case-definition/${caseDefinitionName}/documenten-api/version`,
    caseTab: (caseDefinitionName: string, version: string) =>
      `/api/management/v1/case-definition/${caseDefinitionName}/version/${version}/tab`,
    headerWidget: (caseDefinitionName: string, version: string) =>
      `/api/management/v1/case-definition/${caseDefinitionName}/version/${version}/header-widget`,
    documentDefinition: (caseDefinitionName: string, version: string) =>
      `/api/management/v1/case-definition/${caseDefinitionName}/version/${version}/document-definition`,
  },

  processDefinition: {
    getAll: '/api/v1/process/definition',
    getByKey: (key: string) =>
      `/api/v1/process/definition/${key}`,
    getVersions: (key: string) =>
      `/api/v1/process/definition/${key}/versions`,
    getXml: (id: string) =>
      `/api/v1/process/definition/${id}/xml`,
    startByKeyAndBusinessKey: (key: string, businessKey: string) =>
      `/api/v1/process/definition/${key}/${businessKey}/start`,
    deploy: '/api/v1/process/definition/deployment',
  },

  processInstance: {
    getById: (id: string) => `/api/v1/process/${id}`,
    getTasks: (id: string) => `/api/v1/process/${id}/tasks`,
    getLog: (id: string) => `/api/v1/process/${id}/log`,
    getHistory: (id: string) => `/api/v1/process/${id}/history`,
    getComments: (id: string) => `/api/v1/process/${id}/comments`,
    getActivities: (id: string) => `/api/v1/process/${id}/activities`,
    getActiveTask: (id: string) => `/api/v1/process/${id}/activetask`,
    delete: (id: string) => `/api/v1/process/${id}/delete`,
    comment: (id: string) => `/api/v1/process/${id}/comment`,
  },

  form: {
    getAll: '/api/v1/form-management',
    getById: (caseKey: string, formId: string) => `/api/management/v1/case-definition/${caseKey}/version/0.0.1/form/${formId}`,
    exists: (name: string) => `/api/v1/form-management/exists/${name}`,
    delete: (id: string) => `/api/v1/form-management/${id}`,
    create: (caseKey: string) =>
      `/api/management/v1/case-definition/${caseKey}/version/0.0.1/form`,
  },

  users: {
    getAll: '/api/v1/users',
    getById: (id: string) => `/api/v1/users/${id}`,
    getByEmail: (email: string) => `/api/v1/users/email/${email}/`,
    activate: (id: string) => `/api/v1/users/${id}/activate`,
    deactivate: (id: string) => `/api/v1/users/${id}/deactivate`,
    delete: (id: string) => `/api/v1/users/${id}`,
    sendVerificationEmail: (id: string) =>
      `/api/v1/users/send-verification-email/${id}`,
    updateSettings: '/api/v1/user/settings',
  },

  pluginConfiguration: {
    getAll: '/api/v1/plugin/configuration',
    getExport: '/api/v1/plugin/configuration/export',
    delete: (id: string) => `/api/v1/plugin/configuration/${id}`,
    update: (id: string) => `/api/v1/plugin/configuration/${id}`,
  },

  tags: {
    getByCaseDefinition: (caseDefinitionName: string) =>
      `/api/v1/case-definition/${caseDefinitionName}/case-tag`,
  },

  statuses: {
    getByCaseDefinition: (caseDefinitionName: string) =>
      `/api/v1/case-definition/${caseDefinitionName}/internal-status`,
  },

  searchFields: {
    getByCaseDefinition: (caseDefinitionName: string) =>
      `/api/v1/case-definition/${caseDefinitionName}/search-fields`,
  },

  zgw: {
    getZaaktype: '/api/v1/openzaak/zaaktype',
    getUploadCheck: (caseDefinitionName: string) =>
      `/api/v1/uploadprocess/case/${caseDefinitionName}/check-link`,
    getDocumentColumn: (caseDefinitionName: string) =>
      `/api/v1/case-definition/${caseDefinitionName}/zgw-document-column`,
  },

  version: {
    get: '/api/v1/valtimo/version',
  },
};
