/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {BreadcrumbService} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';
import {
  BuildingBlockManagementParams,
  CaseManagementParams,
  ManagementContext,
  ProcessDefinitionWithPropertiesDto,
} from '@valtimo/shared';
import Modeler from 'bpmn-js/lib/Modeler';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import {is} from 'bpmn-js/lib/util/ModelUtil';

const getLatestProcessDefinition = (
  processDefinitions: ProcessDefinitionWithPropertiesDto[]
): ProcessDefinitionWithPropertiesDto | null => {
  if (!processDefinitions || processDefinitions.length === 0) return null;

  return processDefinitions.reduce((acc, version) =>
    version.version > acc.version ? version : acc
  );
};

const initBreadcrumbsForContext = (
  breadcrumbService: BreadcrumbService,
  translateService: TranslateService,
  params: CaseManagementParams | BuildingBlockManagementParams,
  context: ManagementContext
): void => {
  if (!params) return;

  if (context === 'case') {
    const caseParams = params as CaseManagementParams;
    const route = `/case-management/case/${caseParams.caseDefinitionKey}/version/${caseParams.caseDefinitionVersionTag}`;

    breadcrumbService.setThirdBreadcrumb({
      route: [route],
      content: `${caseParams.caseDefinitionKey} (${caseParams.caseDefinitionVersionTag})`,
      href: route,
    });

    const routeWithProcesses = `${route}/processes`;

    breadcrumbService.setFourthBreadcrumb({
      route: [routeWithProcesses],
      content: translateService.instant('caseManagement.tabs.processes'),
      href: routeWithProcesses,
    });
  }

  if (context === 'buildingBlock') {
    const bbParams = params as BuildingBlockManagementParams;
    const route = `/building-block-management/building-block/${bbParams.buildingBlockDefinitionKey}/version/${bbParams.buildingBlockDefinitionVersionTag}`;
    const generalRoute = `${route}/general`;

    breadcrumbService.setThirdBreadcrumb({
      route: [generalRoute],
      content: `${bbParams.buildingBlockDefinitionKey} (${bbParams.buildingBlockDefinitionVersionTag})`,
      href: generalRoute,
    });

    const processRoute = `${route}/process-definition`;

    breadcrumbService.setFourthBreadcrumb({
      route: [processRoute],
      content: translateService.instant('buildingBlockManagement.tabs.processes'),
      href: processRoute,
    });
  }
};

const DisableBpmnWriteModule = {
  paletteProvider: ['value', {}],
  contextPadProvider: ['value', {}],
  directEditing: [
    'value',
    {
      registerProvider: () => {},
      activate: () => {},
      deactivate: () => {},
      isActive: () => false,
    },
  ],
  move: ['value', null],
  resizeHandles: ['value', {addResizer: () => {}, removeResizers: () => {}}],
};

const disableCommands = (editor: Modeler | NavigatedViewer): void => {
  const commandStack = (editor as any).get('commandStack') as any;
  const originalExecute = commandStack?.execute?.bind(commandStack);

  if (commandStack?.execute) {
    commandStack.execute = (command: string, context: any) => {
      if (
        command === 'elements.delete' ||
        command === 'elements.copy' ||
        command === 'elements.paste' ||
        command === 'elements.create'
      ) {
        return;
      }
      originalExecute(command, context);
    };
  }
};

const applyBuildingBlockCalledElement = (
  editor: Modeler | NavigatedViewer,
  activityId: string,
  mainProcessDefinitionKey: string,
  versionTag: string
): void => {
  if (!editor) return;

  const elementRegistry = (editor as any).get('elementRegistry') as any;
  const modeling = (editor as any).get('modeling') as any;
  const moddle = (editor as any).get('moddle') as any;

  const element = elementRegistry.get(activityId);

  if (!element || !is(element, 'bpmn:CallActivity')) {
    return;
  }

  modeling.updateProperties(element, {
    calledElement: mainProcessDefinitionKey,
    'camunda:calledElementBinding': 'versionTag',
    'camunda:calledElementVersionTag': versionTag,
    'camunda:calledElementType': 'BPMN',
  });

  let extensionElements = element.businessObject.extensionElements;

  if (!extensionElements) {
    extensionElements = moddle.create('bpmn:ExtensionElements', {values: []});
    modeling.updateProperties(element, {
      extensionElements,
    });
  }

  extensionElements.values = (extensionElements.values || []).filter(
    (val: any) => !(val.$type === 'camunda:In' && val.businessKey)
  );

  const inWithBusinessKey = moddle.create('camunda:In', {
    businessKey: '#{buildingBlockInstanceId}',
  });

  extensionElements.values.push(inWithBusinessKey);

  modeling.updateProperties(element, {
    extensionElements,
  });
};

const clearBuildingBlockCalledElement = (
  editor: Modeler | NavigatedViewer,
  activityId: string
): void => {
  const localEditor = editor as any;
  if (!localEditor) return;

  const elementRegistry = localEditor.get('elementRegistry') as any;
  const modeling = localEditor.get('modeling') as any;

  const element = elementRegistry.get(activityId);
  if (!element || !is(element, 'bpmn:CallActivity')) return;

  const bo = element.businessObject;
  const versionTag = bo.get('camunda:calledElementVersionTag');

  if (!versionTag || !versionTag.startsWith('BB:')) return;

  const props: any = {
    calledElement: undefined,
    'camunda:calledElementBinding': undefined,
    'camunda:calledElementVersionTag': undefined,
    'camunda:calledElementType': undefined,
  };

  const extensionElements = bo.extensionElements;
  if (extensionElements && Array.isArray(extensionElements.values)) {
    // Keep all elements except camunda:In with businessKey (building block mapping)
    extensionElements.values = extensionElements.values.filter(
      (val: any) => val.$type !== 'camunda:In' || !val.businessKey
    );

    if (extensionElements.values.length === 0) {
      props.extensionElements = undefined;
    } else {
      props.extensionElements = extensionElements;
    }
  }

  modeling.updateProperties(element, props);

  const attrs = bo.$attrs || {};

  Object.keys(attrs).forEach(key => {
    if (key.startsWith('camunda:calledElement')) delete attrs[key];
    if (key === 'calledElement') delete attrs[key];
  });
};

export {
  getLatestProcessDefinition,
  initBreadcrumbsForContext,
  DisableBpmnWriteModule,
  disableCommands,
  applyBuildingBlockCalledElement,
  clearBuildingBlockCalledElement,
};
