import {useService} from 'bpmn-js-properties-panel';
import {html} from 'htm/preact';
import {is} from 'bpmn-js/lib/util/ModelUtil';
import {ProcessManagementEditorService} from '../../../services';
import {BpmnElement, OpenProcessLinkModalEvent, ProcessManagementWindow} from '../../../models';
import {ModalParams, ProcessLink} from '@valtimo/process-link';
import {TranslateService} from '@ngx-translate/core';
import {mapActivityTypeToActivityListenerType} from '../../../utils';
import {VNode} from 'preact';

class ValtimoPropertiesProvider {
  static $inject = ['propertiesPanel', 'translate'];

  private get processManagementEditorService(): ProcessManagementEditorService {
    return (window as any as ProcessManagementWindow).processManagementEditorService;
  }

  private get translateService(): TranslateService {
    return (window as any as ProcessManagementWindow).translateService;
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
  id: string;
  processLink: ProcessLink;
  element: BpmnElement;
}): VNode => {
  const {element, processLink, translateService, processManagementEditorService} = props;
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

  return processLink
    ? html`<div class="process-link-properties-panel">
        <button
          class="cds--btn cds--btn--primary cds--btn--md cds--layout--size-md"
          onClick=${handleEditClick}
        >
          ${editProcessLinkText}
        </button>
        <button
          class="cds--btn cds--btn--danger cds--btn--md cds--layout--side-md"
          onClick=${handleUnlinkClick}
        >
          ${unlinkText}
        </button>
      </div>`
    : html`<div class="process-link-properties-panel">
        <button
          class="cds--btn cds--btn--primary cds--btn--md cds--layout--size-md"
          onClick=${handleCreateClick}
        >
          ${createText}
        </button>
      </div>`;
};

const ValtimoPropertiesProviderModule = {
  __init__: ['customPropertiesProvider'],
  customPropertiesProvider: ['type', ValtimoPropertiesProvider],
};

export {ValtimoPropertiesProviderModule};
