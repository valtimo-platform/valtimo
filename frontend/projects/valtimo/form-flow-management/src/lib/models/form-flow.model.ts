/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

interface ListFormFlowDefinition {
  key: string;
  versions: Array<number>;
  readOnly?: boolean;
}

interface FormFlowDefinition {
  key: string;
  version?: number;
  readOnly?: boolean;
  startStep: string;
  steps: Array<FormFlowStep>;
}

interface FormFlowDefinitionId {
  key: string;
  version: number;
}

interface FormFlowStep {
  key: string;
  nextSteps: Array<FormFlowNextStep>;
  onBack: Array<string>;
  onOpen: Array<string>;
  onComplete: Array<string>;
  type: FormFlowStepType;
}

interface FormFlowNextStep {
  condition?: string;
  step: string;
}

interface FormFlowStepType {
  name: string;
  properties: FormStepTypeProperties | CustomComponentStepTypeProperties;
}

interface FormStepTypeProperties {
  definition: string;
}

interface CustomComponentStepTypeProperties {
  componentId: string;
}

interface DeleteFormFlowsRequest {
  formFlowKeys: Array<string>;
}

interface LoadedValue<T> {
  isLoading: boolean;
  value?: T;
}

export {
  ListFormFlowDefinition,
  FormFlowDefinition,
  FormFlowDefinitionId,
  FormFlowStep,
  FormFlowNextStep,
  FormFlowStepType,
  FormStepTypeProperties,
  CustomComponentStepTypeProperties,
  DeleteFormFlowsRequest,
  LoadedValue,
};
