interface ObjectSyncConfig {
  id: string;
  connectorInstanceId: string;
  documentDefinitionName: string;
  enabled: boolean;
  objectTypeId: string;
  title?: string;
}

interface CreateObjectSyncConfigRequest {
  connectorInstanceId: string;
  enabled: boolean;
  documentDefinitionName: string;
  objectTypeId: string;
}

interface CreateObjectSyncConfigResult {
  errors: Array<any>;
  objectSyncConfig: ObjectSyncConfig;
}

export {ObjectSyncConfig, CreateObjectSyncConfigRequest, CreateObjectSyncConfigResult};
