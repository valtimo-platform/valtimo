interface PluginDefinition {
  key: string;
  description?: string;
  title?: string;
}

interface PluginConfiguration {
  definitionKey?: string;
  pluginDefinition?: PluginDefinition;
  id?: string;
  newId?: string;
  title: string;
  properties: object;
}
export {PluginConfiguration, PluginDefinition};
