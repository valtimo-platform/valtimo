interface Objecttype {
  id: string;
  title: string;
  objecttypenApiPluginConfigurationId: string;
  objecttypeId: string;
  objectenApiPluginConfigurationId: string;
  showInDataMenu: boolean;
  formDefinitionView?: string;
  formDefinitionEdit?: string;
}

type ObjecttypeKeys = keyof Objecttype;

export  {Objecttype, ObjecttypeKeys}
