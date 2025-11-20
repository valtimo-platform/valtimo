export const endpoints = {
  formFlow: {
    getAll: '/api/management/v1/form-flow/definition',
    getByKeyAndVersion: (key: string, version: number) =>
      `/api/management/v1/form-flow/definition/${key}/${version}`,
    delete: (key: string) =>
      `/api/management/v1/form-flow/definition/${key}`,
    create: '/api/management/v1/form-flow/definition',
  },

  caseDefinition: {
    create: '/api/management/v1/case-definition/case',
    delete: (key: string) =>
      `/api/management/v1/case-definition/case/${key}`,
    getAll: '/api/management/v1/case-definition/case',
    getByKey: (key: string) =>
      `/api/management/v1/case-definition/case/${key}`,
  },

  // 🔜 Add more domains here (e.g. dashboards, plugins, etc.)
};
