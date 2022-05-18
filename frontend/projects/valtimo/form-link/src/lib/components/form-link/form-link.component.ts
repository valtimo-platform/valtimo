/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.See the License for the specific language governing permissions and limitations under the License.
 */

import {Component, ViewChild, ViewContainerRef} from '@angular/core';
import {FormLinkModalComponent} from '../form-link-modal/form-link-modal.component';
import {BpmnElement} from '../../models';
import {ConfigService} from '@valtimo/config';
import {ModalComponent} from '@valtimo/components';

interface ModalParams {
  element: BpmnElement;
  processDefinitionKey: string;
}

@Component({
  selector: 'valtimo-form-link',
  templateUrl: './form-link.component.html',
  styleUrls: ['./form-link.component.scss'],
})
export class FormLinkComponent {
  @ViewChild('formLinkModal') public formLinkModal: FormLinkModalComponent;
  @ViewChild('extension', {read: ViewContainerRef, static: true})
  viewContainerRef: ViewContainerRef;

  constructor(private configService: ConfigService) {}

  openModal(params: ModalParams) {
    const element = params.element;
    const selector = 'form-links';
    const section = 'openzaak-service-task-connector-modal';

    this.getModal(params, element, selector, section);
    // The modal does not call its onInit properly
    this.formLinkModal.ngOnInit();
  }

  private getModal(
    params: ModalParams,
    element: BpmnElement,
    selector: string,
    section: string
  ): void {
    if (element.type === 'bpmn:ServiceTask') {
      const extension = this.configService.getSupportedExtensionPoint(selector, selector, section);
      const componentRef = this.configService.loadAndReturnExtensionPoint(
        this.viewContainerRef,
        extension.extensionPoint
      ) as unknown as ModalComponent;
      const component = componentRef['instance'];
      if (component) {
        component.openModal(params);
      }
    } else {
      this.openFormLinkModal(params);
    }
  }

  private openFormLinkModal(params: ModalParams): void {
    this.formLinkModal.openModal(params.element, params.processDefinitionKey);
  }
}
