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

import {useService} from 'bpmn-js-properties-panel';
import {html} from 'htm/preact';
import {is} from 'bpmn-js/lib/util/ModelUtil';
import {ProcessManagementEditorService} from '../../../services';
import {BpmnElement, OpenProcessLinkModalEvent, ProcessManagementWindow} from '../../../models';
import {ModalParams, ProcessLink} from '@valtimo/process-link';
import {TranslateService} from '@ngx-translate/core';
import {mapActivityTypeToActivityListenerType} from '../../../utils';
import {VNode} from 'preact';
import {PluginTranslationService} from '@valtimo/plugin';

class ValtimoPropertiesProvider {
  static $inject = ['propertiesPanel', 'translate'];

  private get processManagementEditorService(): ProcessManagementEditorService {
    return (window as any as ProcessManagementWindow).processManagementEditorService;
  }

  private get translateService(): TranslateService {
    return (window as any as ProcessManagementWindow).translateService;
  }

  private get pluginTranslationService(): PluginTranslationService {
    return (window as any as ProcessManagementWindow).pluginTranslationService;
  }

  constructor(propertiesPanel: any) {
    propertiesPanel.registerProvider(500, this);
  }

  private addAsSecondOrFirst<T>(arr: T[], element: T): T[] {
    if (arr.length === 0) {
      arr.push(element);
    } else {
      arr.splice(1, 0, element);
    }
    return arr;
  }

  public getGroups(element: BpmnElement): (groups: any[]) => any[] {
    const processLink: ProcessLink | null =
      this.processManagementEditorService.processLinksForSelectedDefinition.find(
        processLink => processLink.activityId === element.id
      ) || null;

    return (groups: any[]) => {
      if (
        is(element, 'bpmn:UserTask') ||
        is(element, 'bpmn:StartEvent') ||
        is(element, 'bpmn:ServiceTask') ||
        is(element, 'bpmn:CallActivity')
      ) {
        const customGroup = {
          id: 'customRootGroup',
          label: 'Process link',
          entries: [this.createCustomRootElement(element, processLink)],
          groupType: 'root',
        };
        this.addAsSecondOrFirst(groups, customGroup);
      }
      return groups;
    };
  }

  public createCustomRootElement(element: any, processLink: ProcessLink | null): any {
    return {
      translateService: this.translateService,
      processManagementEditorService: this.processManagementEditorService,
      pluginTranslationService: this.pluginTranslationService,
      id: 'customRootElement',
      processLink,
      element,
      component: CustomRootElement,
      isEdited: () => false,
    };
  }
}

const CustomRootElement = (props: {
  translateService: TranslateService;
  processManagementEditorService: ProcessManagementEditorService;
  pluginTranslationService: PluginTranslationService;
  id: string;
  processLink: ProcessLink;
  element: BpmnElement;
}): VNode => {
  const {
    element,
    processLink,
    translateService,
    processManagementEditorService,
    pluginTranslationService,
  } = props;
  const modeling = useService('modeling');
  const editProcessLinkText = translateService.instant('interface.edit');
  const unlinkText = translateService.instant('processLink.unlink');
  const createText = translateService.instant('processLink.create');

  const modalParams: ModalParams = {
    processDefinitionKey: processManagementEditorService.selectionProcessDefinition?.key,
    processDefinitionId: processManagementEditorService.selectionProcessDefinition?.id,
    element: {
      id: element.id,
      type: element.type,
      activityListenerType: mapActivityTypeToActivityListenerType(element.type),
      name: element.di.bpmnElement.name,
    },
  };

  const handleCreateClick = (): void => {
    const event: OpenProcessLinkModalEvent = {
      modalParams,
    };

    processManagementEditorService.sendOpenProcessLinkModalEvent(event, () => {
      modeling.updateProperties(element, {});
    });
  };

  const handleEditClick = (): void => {
    const event: OpenProcessLinkModalEvent = {
      processLink,
      modalParams,
    };

    processManagementEditorService.sendOpenProcessLinkModalEvent(event, () => {
      modeling.updateProperties(element, {});
    });
  };

  const handleUnlinkClick = (): void => {
    processManagementEditorService.deleteProcessLink({activityId: processLink.activityId}, () => {
      modeling.updateProperties(element, {});
    });
  };

  const processLinkFormDefinitionId = processLink?.formDefinitionId;
  const processLinkFormDefinitionName = processManagementEditorService.formDefinitionOptions.find(
    option => option.id === processLinkFormDefinitionId
  )?.name;

  if (processLinkFormDefinitionName) {
    return html`<div class="process-link-properties-panel">
      <div class="process-link-properties-panel__header">
        <span class="process-link-properties-panel__title">${processLinkFormDefinitionName}</span>

        <cds-tag
          class="cds--tag cds--tag--blue cds--tag--md cds--layout--size-md  cds-tag--no-margin"
          ><span class="cds--tag__label">
            ${translateService.instant('processLinkType.form')}
          </span>
        </cds-tag>
      </div>

      <div class="process-link-properties-panel__buttons">
        <button
          class="cds--btn cds--btn--danger cds--btn--sm cds--layout--side-md"
          onClick=${handleUnlinkClick}
        >
          ${unlinkText}
        </button>

        <button
          class="cds--btn cds--btn--primary cds--btn--sm cds--layout--size-md"
          onClick=${handleEditClick}
        >
          ${editProcessLinkText}
        </button>
      </div>
    </div>`;
  }

  const processLinkFormFlowDefinitionKey = processLink?.formFlowDefinitionKey;

  if (processLinkFormFlowDefinitionKey) {
    return html`<div class="process-link-properties-panel">
      <div class="process-link-properties-panel__header">
        <span class="process-link-properties-panel__title"
          >${processLinkFormFlowDefinitionKey}</span
        >

        <cds-tag
          class="cds--tag cds--tag--teal cds--tag--md cds--layout--size-md  cds-tag--no-margin"
          ><span class="cds--tag__label">
            ${translateService.instant('processLinkType.form-flow')}
          </span>
        </cds-tag>
      </div>

      <div class="process-link-properties-panel__buttons">
        <button
          class="cds--btn cds--btn--danger cds--btn--sm cds--layout--side-md"
          onClick=${handleUnlinkClick}
        >
          ${unlinkText}
        </button>

        <button
          class="cds--btn cds--btn--primary cds--btn--sm cds--layout--size-md"
          onClick=${handleEditClick}
        >
          ${editProcessLinkText}
        </button>
      </div>
    </div>`;
  }

  const pluginActionKey = processLink?.pluginActionDefinitionKey;
  const pluginActionTranslation =
    pluginTranslationService.instantByPluginActionKey(pluginActionKey);
  const pluginTitleTranslation =
    pluginTranslationService.instantPluginTitleByPluginActionKey(pluginActionKey);

  if (pluginActionKey) {
    return html`<div class="process-link-properties-panel">
      <div class="process-link-properties-panel__header">
        <span class="process-link-properties-panel__title-container">
          <span class="process-link-properties-panel__title">${pluginTitleTranslation}</span>

          <span class="process-link-properties-panel__title">${pluginActionTranslation}</span>
        </span>

        <cds-tag
          class="cds--tag cds--tag--purple cds--tag--md cds--layout--size-md  cds-tag--no-margin"
          ><span class="cds--tag__label">
            ${translateService.instant('processLinkType.plugin')}
          </span>
        </cds-tag>
      </div>

      <div class="process-link-properties-panel__buttons">
        <button
          class="cds--btn cds--btn--danger cds--btn--sm cds--layout--side-md"
          onClick=${handleUnlinkClick}
        >
          ${unlinkText}
        </button>

        <button
          class="cds--btn cds--btn--primary cds--btn--sm cds--layout--size-md"
          onClick=${handleEditClick}
        >
          ${editProcessLinkText}
        </button>
      </div>
    </div>`;
  }

  const uiComponentKey = processLink?.componentKey;

  if (uiComponentKey) {
    return html`<div class="process-link-properties-panel">
      <div class="process-link-properties-panel__header">
        <span class="process-link-properties-panel__title">${uiComponentKey}</span>

        <cds-tag
          class="cds--tag cds--tag--magenta cds--tag--md cds--layout--size-md  cds-tag--no-margin"
          ><span class="cds--tag__label">
            ${translateService.instant('processLinkType.ui-component')}
          </span>
        </cds-tag>
      </div>

      <div class="process-link-properties-panel__buttons">
        <button
          class="cds--btn cds--btn--danger cds--btn--sm cds--layout--side-md"
          onClick=${handleUnlinkClick}
        >
          ${unlinkText}
        </button>

        <button
          class="cds--btn cds--btn--primary cds--btn--sm cds--layout--size-md"
          onClick=${handleEditClick}
        >
          ${editProcessLinkText}
        </button>
      </div>
    </div>`;
  }

  const genericLinkedPanel = html`<div class="process-link-properties-panel">
    <div class="process-link-properties-panel__buttons">
      <button
        class="cds--btn cds--btn--danger cds--btn--sm cds--layout--side-md"
        onClick=${handleUnlinkClick}
      >
        ${unlinkText}
      </button>

      <button
        class="cds--btn cds--btn--primary cds--btn--sm cds--layout--size-md"
        onClick=${handleEditClick}
      >
        ${editProcessLinkText}
      </button>
    </div>
  </div>`;

  const genericCreatePanel = html`<div class="process-link-properties-panel">
    <div class="process-link-properties-panel__buttons">
      <button
        class="cds--btn cds--btn--primary cds--btn--sm cds--layout--size-md"
        onClick=${handleCreateClick}
      >
        ${createText}
      </button>
    </div>
  </div>`;

  return processLink ? genericLinkedPanel : genericCreatePanel;
};

const ValtimoPropertiesProviderModule = {
  __init__: ['customPropertiesProvider'],
  customPropertiesProvider: ['type', ValtimoPropertiesProvider],
};

export {ValtimoPropertiesProviderModule};
