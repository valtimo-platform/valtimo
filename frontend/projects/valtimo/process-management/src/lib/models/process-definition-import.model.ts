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

type MissingReferenceType =
  | 'SUB_PROCESS'
  | 'DECISION_DEFINITION'
  | 'FORM'
  | 'FORM_FLOW'
  | 'READ_ONLY_SYSTEM_PROCESS';

interface MissingReference {
  type: MissingReferenceType;
  reference: string;
  activityId: string | null;
  processDefinitionKey: string | null;
  blocksImport: boolean;
}

interface ProcessDefinitionPluginConfigurationPreview {
  pluginConfigurationId: string;
  pluginDefinitionKey: string | null;
  pluginActionDefinitionKey: string;
  processDefinitionKey: string;
  activityId: string;
  existsInTargetEnvironment: boolean;
}

type ReplacedElementType = 'PROCESS_DEFINITION' | 'DECISION_DEFINITION' | 'FORM';

interface ReplacedElement {
  type: ReplacedElementType;
  key: string;
}

interface ProcessDefinitionImportPreview {
  processDefinitionKeys: string[];
  /** The processes of the package that already exist here and will be replaced by the import. */
  existingProcessDefinitionKeys: string[];
  pluginConfigurations: ProcessDefinitionPluginConfigurationPreview[];
  missingReferences: MissingReference[];
  /** Elements bundled in the package that already exist here and will be replaced by the import. */
  elementsToReplace: ReplacedElement[];
  canImport: boolean;
}

interface ProcessDefinitionImportResult {
  processDefinitionKeys: string[];
  missingReferences: MissingReference[];
}

export {
  MissingReference,
  MissingReferenceType,
  ProcessDefinitionImportPreview,
  ProcessDefinitionImportResult,
  ProcessDefinitionPluginConfigurationPreview,
  ReplacedElement,
  ReplacedElementType,
};
