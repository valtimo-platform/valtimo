type ConnectorPropertyEditType = 'string' | 'number' | 'string[]' | 'number[]';
type ConnectorPropertyValueType = string | number | Array<number> | Array<string>;

interface ConnectorProperties {
  className: string;
  [key: string]: ConnectorPropertyValueType | ConnectorProperties;
}

interface ConnectorPropertyEditField {
  key: string;
  editType: ConnectorPropertyEditType;
  defaultValue?: ConnectorPropertyValueType;
}

interface ConnectorInstance {
  id: string;
  name: string;
  type: ConnectorType;
  properties: ConnectorProperties;
}

interface ConnectorInstanceCreateRequest {
  name: string;
  typeId: string;
  connectorProperties: ConnectorProperties;
}

interface ConnectorInstanceUpdateRequest {
  name: string;
  typeId: string;
  id: string;
  connectorProperties: ConnectorProperties;
}

interface ConnectorType {
  className: string;
  id: string;
  name: string;
  properties: ConnectorProperties;
}

type ConnectorModal = 'add' | 'modify';

export {
  ConnectorProperties,
  ConnectorInstance,
  ConnectorType,
  ConnectorModal,
  ConnectorPropertyEditField,
  ConnectorPropertyEditType,
  ConnectorInstanceCreateRequest,
  ConnectorInstanceUpdateRequest,
  ConnectorPropertyValueType
};
