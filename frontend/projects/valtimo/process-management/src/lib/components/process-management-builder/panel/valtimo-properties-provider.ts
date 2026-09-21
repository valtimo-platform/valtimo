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

import {useService} from 'bpmn-js-properties-panel';
import {TextFieldEntry} from '@bpmn-io/properties-panel';
import {html} from 'htm/preact';
import {getBusinessObject, is} from 'bpmn-js/lib/util/ModelUtil';
import {MAX_ACTIVITY_ID_LENGTH, PROCESS_LINK_PANEL_TEST_IDS} from '../../../constants';
import {ProcessManagementEditorService} from '../../../services';
import {
  BpmnElement,
  OpenProcessLinkModalEvent,
  ProcessDefinitionValidationError,
  ProcessManagementWindow,
} from '../../../models';
import {ModalParams, ProcessLink, ProcessLinkService} from '@valtimo/process-link';
import {TranslateService} from '@ngx-translate/core';
import {mapActivityTypeToActivityListenerType} from '../../../utils';
import {VNode} from 'preact';
import {PluginTranslationService} from '@valtimo/plugin';

// Mirrors the QName rules of bpmn-js-properties-panel, which does not expose them
const SPACE_REGEX = /\s/;
const QNAME_REGEX = /^([a-z][\w-.]*:)?[a-z_][\w-.]*$/i;
const ID_REGEX = /^[a-z_][\w-.]*$/i;

const PROCESS_LINKABLE_TYPES = [
  'bpmn:UserTask',
  'bpmn:StartEvent',
  'bpmn:ServiceTask',
  'bpmn:SendTask',
  'bpmn:ReceiveTask',
  'bpmn:IntermediateThrowEvent',
  'bpmn:IntermediateCatchEvent',
  'bpmn:CallActivity',
];

const isProcessLinkable = (element: BpmnElement): boolean =>
  PROCESS_LINKABLE_TYPES.some(type => is(element, type));

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

  private get processLinkService(): ProcessLinkService {
    return (window as any as ProcessManagementWindow).processLinkService;
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

    const elementErrors = this.processManagementEditorService.validationErrors.filter(
      error => error.elementId === element.id
    );

    const autofillInfo = this.processManagementEditorService.getAutofillForActivity(element.id);
    const isAutofillDismissed = this.processManagementEditorService.isAutofillDismissed(element.id);

    return (groups: any[]) => {
      const generalGroup = groups.find((g: any) => g.id === 'general');
      if (generalGroup) {
        generalGroup.entries = generalGroup.entries.filter(
          (entry: any) => entry.id !== 'isExecutable'
        );

        // Same scope as the auto-filled id, so typing and generating share one limit
        if (is(element, 'bpmn:FlowNode')) {
          const idEntry = generalGroup.entries.find((entry: any) => entry.id === 'id');
          if (idEntry) {
            idEntry.component = LengthLimitedIdElement;
            idEntry.translateService = this.translateService;
          }
        }
      }

      if (elementErrors.length > 0) {
        const errorGroup = {
          id: 'validationErrorsGroup',
          label: this.translateService.instant('processManagement.validationErrors'),
          entries: [
            {
              id: 'validationErrorsEntry',
              errors: elementErrors,
              translateService: this.translateService,
              component: ValidationErrorsElement,
            },
          ],
          shouldOpen: true,
        };
        groups.unshift(errorGroup);
      }

      if (autofillInfo && !isAutofillDismissed) {
        const targetGroupId = this.getGroupIdForModificationType(autofillInfo.modificationType);
        const targetGroup = groups.find((g: any) => g.id === targetGroupId);
        if (targetGroup) {
          const notificationEntry = {
            id: 'autofilledNotificationEntry',
            activityId: element.id,
            element,
            translateService: this.translateService,
            processManagementEditorService: this.processManagementEditorService,
            processLinkService: this.processLinkService,
            component: AutofilledNotificationElement,
          };
          targetGroup.entries.unshift(notificationEntry);
          targetGroup.shouldOpen = true;
        }
      }

      if (isProcessLinkable(element)) {
        const editingAllowed = this.processManagementEditorService.editingAllowed;

        if (editingAllowed || processLink) {
          const customGroup = {
            id: 'customRootGroup',
            label: 'Process link',
            entries: [this.createCustomRootElement(element, processLink, editingAllowed)],
            groupType: 'root',
          };
          this.addAsSecondOrFirst(groups, customGroup);
        }
      }
      return groups;
    };
  }

  private getGroupIdForModificationType(modificationType: string): string {
    const groupMapping: Record<string, string> = {
      SERVICE_TASK_EXPRESSION: 'CamundaPlatform__Implementation',
      SEND_TASK_EXPRESSION: 'CamundaPlatform__Implementation',
      MESSAGE_EVENT_EXPRESSION: 'message',
      TIMER_DURATION: 'timer',
      CALL_ACTIVITY_BUSINESS_KEY: 'CamundaPlatform__BusinessKey',
    };
    return groupMapping[modificationType] || 'general';
  }

  public createCustomRootElement(
    element: any,
    processLink: ProcessLink | null,
    editingAllowed: boolean
  ): any {
    return {
      translateService: this.translateService,
      processManagementEditorService: this.processManagementEditorService,
      pluginTranslationService: this.pluginTranslationService,
      id: 'customRootElement',
      processLink,
      element,
      editingAllowed,
      component: CustomRootElement,
      isEdited: (node: HTMLInputElement) => node && !!node.value,
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
  editingAllowed: boolean;
}): VNode => {
  const {
    element,
    processLink,
    translateService,
    processManagementEditorService,
    pluginTranslationService,
    editingAllowed,
  } = props;
  const modeling = useService('modeling');
  const elementRegistry = useService('elementRegistry');
  const editProcessLinkText = translateService.instant('interface.edit');
  const unlinkText = translateService.instant('processLink.unlink');
  const createText = translateService.instant('processLink.create');
  const viewText = translateService.instant('interface.view');

  const getModalParams = (): ModalParams => {
    const currentElement = elementRegistry.get(element.id) || element;
    return {
      processDefinitionKey: processManagementEditorService.selectionProcessDefinition?.key,
      processDefinitionId: processManagementEditorService.selectionProcessDefinition?.id,
      element: {
        id: currentElement.id,
        type: currentElement.type,
        activityListenerType: mapActivityTypeToActivityListenerType(
          currentElement.type,
          currentElement
        ),
        name: currentElement.di?.bpmnElement?.name,
      },
    };
  };

  const handleCreateClick = (): void => {
    const event: OpenProcessLinkModalEvent = {
      modalParams: getModalParams(),
    };

    processManagementEditorService.sendOpenProcessLinkModalEvent(event, () => {
      // Defer to avoid calling modeling.updateProperties during command stack execute/revert phase
      setTimeout(() => modeling.updateProperties(element, {}), 0);
    });
  };

  const handleEditClick = (): void => {
    const event: OpenProcessLinkModalEvent = {
      processLink,
      modalParams: getModalParams(),
    };

    processManagementEditorService.sendOpenProcessLinkModalEvent(event, () => {
      // Defer to avoid calling modeling.updateProperties during command stack execute/revert phase
      setTimeout(() => modeling.updateProperties(element, {}), 0);
    });
  };

  const handleUnlinkClick = (): void => {
    processManagementEditorService.sendDeleteProcessLinkEvent(
      {activityId: processLink.activityId},
      () => {
        // Defer to avoid calling modeling.updateProperties during command stack execute/revert phase
        setTimeout(() => modeling.updateProperties(element, {}), 0);
      }
    );
  };

  const processLinkFormDefinitionId = processLink?.formDefinitionId;
  const processLinkFormDefinitionName = processManagementEditorService.formDefinitionOptions.find(
    option => option.id === processLinkFormDefinitionId
  )?.name;

  const hiddenInput = html`<input
    type="hidden"
    class="bio-properties-panel-input"
    value=${processLink ? 'configured' : ''}
  />`;
  const wrapEntry = (content: any) =>
    html`<div data-entry-id=${props.id}>${hiddenInput}${content}</div>`;

  const linkedButtons = !editingAllowed
    ? html`<div class="process-link-properties-panel__buttons">
        <button
          class="cds--btn cds--btn--primary cds--btn--sm cds--layout--size-md"
          data-test-id=${PROCESS_LINK_PANEL_TEST_IDS.editButton}
          onClick=${handleEditClick}
        >
          ${viewText}
        </button>
      </div>`
    : html`<div class="process-link-properties-panel__buttons">
        <button
          class="cds--btn cds--btn--danger cds--btn--sm cds--layout--side-md"
          data-test-id=${PROCESS_LINK_PANEL_TEST_IDS.unlinkButton}
          onClick=${handleUnlinkClick}
        >
          ${unlinkText}
        </button>

        <button
          class="cds--btn cds--btn--primary cds--btn--sm cds--layout--size-md"
          data-test-id=${PROCESS_LINK_PANEL_TEST_IDS.editButton}
          onClick=${handleEditClick}
        >
          ${editProcessLinkText}
        </button>
      </div>`;

  if (processLinkFormDefinitionName) {
    return wrapEntry(
      html`<div class="process-link-properties-panel">
        <div class="process-link-properties-panel__header">
          <span class="process-link-properties-panel__title">${processLinkFormDefinitionName}</span>

          <cds-tag
            class="cds--tag cds--tag--blue cds--tag--md cds--layout--size-md  cds-tag--no-margin"
            ><span class="cds--tag__label">
              ${translateService.instant('processLinkType.form')}
            </span>
          </cds-tag>
        </div>

        ${linkedButtons}
      </div>`
    );
  }

  const processLinkFormFlowDefinitionKey = processLink?.formFlowDefinitionKey;

  if (processLinkFormFlowDefinitionKey) {
    return wrapEntry(
      html`<div class="process-link-properties-panel">
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

        ${linkedButtons}
      </div>`
    );
  }

  const buildingBlockDefinitionKey = processLink?.buildingBlockDefinitionKey;
  const buildingBlockDefinitionVersion = processLink?.buildingBlockDefinitionVersionTag;

  if (buildingBlockDefinitionKey) {
    return wrapEntry(
      html`<div class="process-link-properties-panel">
        <div class="process-link-properties-panel__header">
          <span class="process-link-properties-panel__title"
            >${buildingBlockDefinitionKey} (${buildingBlockDefinitionVersion})</span
          >

          <cds-tag
            class="cds--tag cds--tag--green cds--tag--md cds--layout--size-md  cds-tag--no-margin"
            ><span class="cds--tag__label">
              ${translateService.instant('processLinkType.building-block')}
            </span>
          </cds-tag>
        </div>

        ${linkedButtons}
      </div>`
    );
  }

  const pluginActionKey = processLink?.pluginActionDefinitionKey;
  const pluginActionTranslation =
    pluginTranslationService.instantByPluginActionKey(pluginActionKey);
  const pluginTitleTranslation =
    pluginTranslationService.instantPluginTitleByPluginActionKey(pluginActionKey);

  if (pluginActionKey) {
    return wrapEntry(
      html`<div class="process-link-properties-panel">
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

        ${linkedButtons}
      </div>`
    );
  }

  const uiComponentKey = processLink?.componentKey;

  if (uiComponentKey) {
    return wrapEntry(
      html`<div class="process-link-properties-panel">
        <div class="process-link-properties-panel__header">
          <span class="process-link-properties-panel__title">${uiComponentKey}</span>

          <cds-tag
            class="cds--tag cds--tag--magenta cds--tag--md cds--layout--size-md  cds-tag--no-margin"
            ><span class="cds--tag__label">
              ${translateService.instant('processLinkType.ui-component')}
            </span>
          </cds-tag>
        </div>

        ${linkedButtons}
      </div>`
    );
  }

  const genericLinkedPanel = html`<div class="process-link-properties-panel">
    ${linkedButtons}
  </div>`;

  const genericCreatePanel = html`<div class="process-link-properties-panel">
    <div class="process-link-properties-panel__buttons">
      <button
        class="cds--btn cds--btn--primary cds--btn--sm cds--layout--size-md"
        data-test-id=${PROCESS_LINK_PANEL_TEST_IDS.createButton}
        onClick=${handleCreateClick}
      >
        ${createText}
      </button>
    </div>
  </div>`;

  return wrapEntry(processLink ? genericLinkedPanel : genericCreatePanel);
};

const LengthLimitedIdElement = (props: {
  element: BpmnElement;
  translateService: TranslateService;
}): VNode => {
  const {element, translateService} = props;
  const modeling = useService('modeling');
  const debounce = useService('debounceInput');
  const translate = useService('translate');

  const getValue = (): string => getBusinessObject(element).id;

  const setValue = (value: string, error: string): void => {
    if (error) return;

    modeling.updateProperties(element, {id: value});
  };

  const validate = (value: string): string | undefined => {
    const businessObject = getBusinessObject(element);
    const assigned = businessObject.$model.ids.assigned(value);

    if (!value) return translate('ID must not be empty.');

    if (assigned && assigned !== businessObject) return translate('ID must be unique.');

    if (SPACE_REGEX.test(value)) return translate('ID must not contain spaces.');

    if (!ID_REGEX.test(value)) {
      return QNAME_REGEX.test(value)
        ? translate('ID must not contain prefix.')
        : translate('ID must be a valid QName.');
    }

    if (value.length > MAX_ACTIVITY_ID_LENGTH) {
      return translateService.instant('processManagement.idTooLong', {
        max: MAX_ACTIVITY_ID_LENGTH,
      });
    }

    return undefined;
  };

  // The panel's text field has no maxLength prop, so cap the rendered input directly
  const capInputLength = (node: HTMLElement | null): void => {
    const input = node?.querySelector('input');
    if (input) input.maxLength = MAX_ACTIVITY_ID_LENGTH;
  };

  return html`<div ref=${capInputLength}>
    ${TextFieldEntry({
      element,
      id: 'id',
      label: translate('ID'),
      getValue,
      setValue,
      debounce,
      validate,
    })}
  </div>`;
};

const ValidationErrorsElement = (props: {
  errors: ProcessDefinitionValidationError[];
  translateService: TranslateService;
}): VNode => {
  const getErrorMessage = (error: ProcessDefinitionValidationError): string => {
    if (error.errorCode) {
      const translationKey = `processManagement.validationErrorCodes.${error.errorCode}`;
      const translated = props.translateService.instant(translationKey, {
        expression: error.expression ?? '',
      });
      if (translated !== translationKey) {
        return translated;
      }
    }
    return error.reason;
  };

  return html`<div class="validation-errors-panel">
    ${props.errors.map(
      error =>
        html`<div
          class="validation-errors-panel__item${error.severity === 'WARNING' ? ' warning' : ''}"
        >
          <span
            class="validation-errors-panel__icon${error.severity === 'WARNING' ? ' warning' : ''}"
            >!</span
          >
          <span
            class="validation-errors-panel__reason${error.severity === 'WARNING' ? ' warning' : ''}"
            >${getErrorMessage(error)}</span
          >
        </div>`
    )}
  </div>`;
};

const AutofilledNotificationElement = (props: {
  activityId: string;
  element: BpmnElement;
  translateService: TranslateService;
  processManagementEditorService: ProcessManagementEditorService;
  processLinkService: ProcessLinkService;
}): VNode => {
  const handleDismiss = (event: Event): void => {
    const processDefinitionId = props.processManagementEditorService.selectionProcessDefinition?.id;
    if (processDefinitionId) {
      props.processLinkService.deleteAutofill(processDefinitionId, props.activityId).subscribe();
    }
    props.processManagementEditorService.dismissAutofill(props.activityId);

    const target = event.currentTarget as HTMLElement;
    const panel = target.closest('.autofilled-notification-panel') as HTMLElement;
    if (panel) {
      panel.style.display = 'none';
    }
  };

  return html`<div class="autofilled-notification-panel">
    <span class="autofilled-notification-panel__icon">!</span>
    <span class="autofilled-notification-panel__message">
      ${props.translateService.instant('processManagement.autofilled.sidebarMessage')}
    </span>
    <button class="autofilled-notification-panel__dismiss" onClick=${handleDismiss}>×</button>
  </div>`;
};

const ValtimoPropertiesProviderModule = {
  __init__: ['customPropertiesProvider'],
  customPropertiesProvider: ['type', ValtimoPropertiesProvider],
};

export {ValtimoPropertiesProviderModule};
