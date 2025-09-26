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

import {ListItem} from 'carbon-components-angular';

interface FormSubmissionResult {
  errors: string[];
  documentId?: string;
}

interface BpmnElement {
  id: string;
  type: string;
  activityListenerType?: string;
  name?: string;
}

interface FormFlowDefinition {
  id: string;
  name: string;
}

interface FormFlowInstance {
  id: string;
  step?: FormFlowStep;
}

interface FormFlowCreateRequest {
  documentId: string | null;
  documentDefinitionName: string | null;
}

interface FormFlowCreateResult {
  formFlowInstanceId: string;
}

type FormFlowStepType = 'form' | 'custom-component';

interface FormFlowStep {
  id: string;
  type: FormFlowStepType;
  typeProperties: FormTypeProperties;
}

interface FormTypeProperties {
  definition?: any;
  id?: string;
}

interface ModalParams {
  element: BpmnElement;
  processDefinitionKey: string;
  processDefinitionId: string;
}

interface FormDefinitionListItem extends ListItem {
  id: string;
}

interface FormFlowBreadcrumbs extends ListItem {
  currentStepIndex: number;
  breadcrumbs: Array<FormFlowBreadcrumb>;
}

interface FormFlowBreadcrumb extends ListItem {
  title: string;
  key: string;
  stepInstanceId: string;
  completed: boolean;
}

export {
  FormSubmissionResult,
  BpmnElement,
  FormFlowDefinition,
  FormFlowInstance,
  FormFlowStepType,
  FormFlowStep,
  FormTypeProperties,
  FormFlowCreateResult,
  FormFlowCreateRequest,
  ModalParams,
  FormDefinitionListItem,
  FormFlowBreadcrumbs,
  FormFlowBreadcrumb,
};
