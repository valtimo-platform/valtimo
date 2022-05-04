/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {Component, NgZone, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {NgbModal, NgbModalOptions} from '@ng-bootstrap/ng-bootstrap';
import {FormManagementService, FormDefinition} from '@valtimo/form-management';
import {
  BpmnElement,
  CreateFormAssociationRequest,
  FormAssociation,
  FormFlowDefinition,
  ModifyFormAssociationRequest,
} from '../models';
import {FormLinkService} from '../form-link.service';
import {
  AlertService,
  ModalComponent,
  SearchableDropdownComponent,
  DropdownItem,
} from '@valtimo/components';
import {NGXLogger} from 'ngx-logger';
import {TranslateService} from '@ngx-translate/core';
import {FormFlowService} from '../form-flow.service';

declare var $;

@Component({
  selector: 'valtimo-form-link-modal',
  templateUrl: './form-link-modal.component.html',
  styleUrls: ['./form-link-modal.component.scss'],
})
export class FormLinkModalComponent implements OnInit {
  public modalOptions: NgbModalOptions;
  public formDefinitions: FormDefinition[] = [];
  public formFlowDefinitions: FormFlowDefinition[] = [];
  public selectedElement: BpmnElement | null = null;
  public associationType: string | null = null;
  public selectedFormDefinition: FormDefinition | null = null;
  public selectedFormFlowDefinition: FormFlowDefinition | null = null;
  public enteredCustomUrl: string | null = null;
  public enteredAngularState: string | null = null;
  public previousFormLink: FormAssociation | null = null;
  private processDefinitionKey: string | null = null;
  private isListenersAdded = false;
  private isFormDefinitionSelected = false;
  private isFormFlowDefinitionSelected = false;
  private isAngularStateSelected = false;
  private isCustomUrlSelected = false;
  private size = 50;
  private totalElements = null;
  @ViewChild('formLinkModal') modal: ModalComponent;

  private static convertElementType(elementType: string): string | null {
    switch (elementType) {
      case 'bpmn:StartEvent':
        return 'start-event';
      case 'bpmn:UserTask':
        return 'user-task';
      default:
        return null;
    }
  }

  constructor(
    private modalService: NgbModal,
    private formLinkService: FormLinkService,
    private formFlowService: FormFlowService,
    private formManagementService: FormManagementService,
    private alertService: AlertService,
    private logger: NGXLogger,
    private ngZone: NgZone,
    private readonly translateService: TranslateService
  ) {
    this.modalOptions = {};
  }

  ngOnInit() {
    this.formManagementService.queryFormDefinitions({size: this.size}).subscribe((results: any) => {
      this.totalElements = results.body.totalElements;
      if (this.size >= this.totalElements) {
        this.formDefinitions = results.body.content;
      } else {
        this.size = this.totalElements;
        this.ngOnInit();
      }
    });
    this.formFlowService.getFormFlowDefinitions().subscribe(formFlowDefinitions => {
      this.formFlowDefinitions = formFlowDefinitions;
    });
  }

  public get selectedAssociationType() {
    if (this.isFormDefinitionSelected) {
      return 'form-definition';
    } else if (this.isFormFlowDefinitionSelected) {
      return 'form-flow';
    } else if (this.isAngularStateSelected) {
      return 'angular-state';
    } else if (this.isCustomUrlSelected) {
      return 'custom-url';
    } else {
      return null;
    }
  }

  private addCollapseListeners(
    collapseFormDefinition,
    collapseFormFlowDefinition,
    collapseAngularState,
    collapseCustomUrl
  ) {
    collapseFormDefinition.on('show.bs.collapse', () => {
      this.ngZone.run(() => {
        this.isFormDefinitionSelected = true;
      });
    });
    collapseFormDefinition.on('hide.bs.collapse', () => {
      this.ngZone.run(() => {
        this.isFormDefinitionSelected = false;
      });
    });
    collapseFormFlowDefinition.on('show.bs.collapse', () => {
      this.ngZone.run(() => {
        this.isFormFlowDefinitionSelected = true;
      });
    });
    collapseFormFlowDefinition.on('hide.bs.collapse', () => {
      this.ngZone.run(() => {
        this.isFormFlowDefinitionSelected = false;
      });
    });
    collapseAngularState.on('show.bs.collapse', () => {
      this.ngZone.run(() => {
        this.isAngularStateSelected = true;
      });
    });
    collapseAngularState.on('hide.bs.collapse', () => {
      this.ngZone.run(() => {
        this.isAngularStateSelected = false;
      });
    });
    collapseCustomUrl.on('show.bs.collapse', () => {
      this.ngZone.run(() => {
        this.isCustomUrlSelected = true;
      });
    });
    collapseCustomUrl.on('hide.bs.collapse', () => {
      this.ngZone.run(() => {
        this.isCustomUrlSelected = false;
      });
    });
  }

  openModal(element: BpmnElement, processDefinitionKey: string) {
    this.selectedElement = element;
    this.processDefinitionKey = processDefinitionKey;
    this.selectedFormDefinition = null;
    this.selectedFormFlowDefinition = null;
    this.enteredAngularState = null;
    this.enteredCustomUrl = null;
    this.associationType = null;
    this.formLinkService
      .getFormLinkByAssociation(this.processDefinitionKey, element.id)
      .subscribe((formLink: FormAssociation) => {
        this.previousFormLink = formLink;
        const collapseFormDefinition = $('#collapseFormDefinition');
        const collapseFormFlowDefinition = $('#collapseFormFlowDefinition');
        const collapseCustomUrl = $('#collapseCustomUrl');
        const collapseAngularState = $('#collapseAngularState');
        if (!this.isListenersAdded) {
          this.addCollapseListeners(
            collapseFormDefinition,
            collapseFormFlowDefinition,
            collapseAngularState,
            collapseCustomUrl
          );
          this.isListenersAdded = true;
        }
        if (formLink !== null) {
          const className = formLink.formLink.className.split('.');
          const linkType = className[className.length - 1];
          switch (linkType) {
            case 'BpmnElementFormIdLink':
              const foundFormDefinition = this.formDefinitions.find(
                formDefinition => formDefinition.id === formLink.formLink.formId
              );
              if (foundFormDefinition !== undefined) {
                this.selectedFormDefinition = foundFormDefinition;
              }
              collapseFormDefinition.collapse('show');
              break;
            case 'BpmnElementFormFlowIdLink':
              const foundFormFlowDefinition = this.formFlowDefinitions.find(
                formFlowDefinition => formFlowDefinition.id === formLink.formLink.formFlowId
              );
              if (foundFormFlowDefinition !== undefined) {
                this.selectedFormFlowDefinition = foundFormFlowDefinition;
              }
              collapseFormFlowDefinition.collapse('show');
              break;
            case 'BpmnElementUrlLink':
              this.enteredCustomUrl = formLink.formLink.url;
              collapseCustomUrl.collapse('show');
              break;
            case 'BpmnElementAngularStateUrlLink':
              this.enteredAngularState = formLink.formLink.url;
              collapseAngularState.collapse('show');
              break;
            default:
              this.logger.fatal('Unsupported class name');
          }
        } else {
          collapseFormDefinition.collapse('hide');
          collapseCustomUrl.collapse('hide');
          collapseAngularState.collapse('hide');
        }
        this.modal.show();
      });
  }

  submit(associationType: string) {
    const currentAssociation = {
      selected: undefined,
      different: undefined,
    };
    switch (associationType) {
      case 'form-definition':
        currentAssociation.selected = this.selectedFormDefinition;
        currentAssociation.different = () =>
          this.previousFormLink.formLink.formId !== this.selectedFormDefinition.id;
        break;
      case 'form-flow':
        currentAssociation.selected = this.selectedFormFlowDefinition;
        currentAssociation.different = () =>
          this.previousFormLink.formLink.formFlowId !== this.selectedFormFlowDefinition.id;
        break;
      case 'custom-url':
        currentAssociation.selected = this.enteredCustomUrl;
        currentAssociation.different = () =>
          this.previousFormLink.formLink.url !== this.enteredCustomUrl;
        break;
      case 'angular-state':
        currentAssociation.selected = this.enteredAngularState;
        currentAssociation.different = () =>
          this.previousFormLink.formLink.url !== this.enteredAngularState;
        break;
    }
    if (this.previousFormLink === null) {
      if (currentAssociation.selected) {
        this.createFormAssociation(associationType);
      }
    } else if (currentAssociation.selected && currentAssociation.different()) {
      this.modifyFormAssociation(associationType);
    }
  }

  private modifyFormAssociation(associationType: string) {
    const modifyFormAssociationRequest: ModifyFormAssociationRequest = {
      formAssociationId: this.previousFormLink.id,
      processDefinitionKey: this.processDefinitionKey,
      formLinkRequest: {
        type: FormLinkModalComponent.convertElementType(this.selectedElement.type),
        id: this.selectedElement.id,
      },
    };
    switch (associationType) {
      case 'form-definition':
        modifyFormAssociationRequest.formLinkRequest.formId = this.selectedFormDefinition.id;
        break;
      case 'form-flow':
        modifyFormAssociationRequest.formLinkRequest.formFlowId =
          this.selectedFormFlowDefinition.id;
        break;
      case 'custom-url':
        modifyFormAssociationRequest.formLinkRequest.customUrl = this.enteredCustomUrl;
        break;
      case 'angular-state':
        modifyFormAssociationRequest.formLinkRequest.angularStateUrl = this.enteredAngularState;
        break;
      default:
        this.logger.fatal('Unknown association type');
    }

    this.formLinkService.modifyFormAssociation(modifyFormAssociationRequest).subscribe(
      () => {
        this.alertService.success(this.translateService.instant('formLink.alertRelink'));
      },
      err => {
        this.alertService.error(this.translateService.instant('formLink.alertRelinkError'));
      }
    );
  }

  private createFormAssociation(associationType: string) {
    const createFormAssociationRequest: CreateFormAssociationRequest = {
      processDefinitionKey: this.processDefinitionKey,
      formLinkRequest: {
        type: FormLinkModalComponent.convertElementType(this.selectedElement.type),
        id: this.selectedElement.id,
      },
    };
    switch (associationType) {
      case 'form-definition':
        createFormAssociationRequest.formLinkRequest.formId = this.selectedFormDefinition.id;
        break;
      case 'form-flow':
        createFormAssociationRequest.formLinkRequest.formFlowId =
          this.selectedFormFlowDefinition.id;
        break;
      case 'custom-url':
        createFormAssociationRequest.formLinkRequest.customUrl = this.enteredCustomUrl;
        break;
      case 'angular-state':
        createFormAssociationRequest.formLinkRequest.angularStateUrl = this.enteredAngularState;
        break;
      default:
        this.logger.fatal('Unknown association type');
    }
    this.formLinkService.createFormAssociation(createFormAssociationRequest).subscribe(
      () => {
        this.alertService.success(this.translateService.instant('formLink.alertLink'));
      },
      err => {
        this.alertService.error(this.translateService.instant('formLink.alertLinkError'));
      }
    );
  }

  public deleteFormAssociation() {
    this.formLinkService
      .deleteFormAssociation(this.processDefinitionKey, this.previousFormLink.id)
      .subscribe(
        () => {
          this.alertService.success(this.translateService.instant('formLink.alertUnlink'));
        },
        err => {
          this.alertService.error(this.translateService.instant('formLink.alertUnlinkError'));
        }
      );
  }

  /**
   * The searchable dropdown element requires an array of DropdownItem, this method will transform the
   * formDefinitions to this type of array. The result will also be sorted on the name variable
   */
  public mapFormDefinitionsForDropdown(formDefinitions: FormDefinition[]): DropdownItem[] {
    return (
      formDefinitions &&
      formDefinitions
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(formDefinition => ({text: formDefinition.name, id: formDefinition.id}))
    );
  }

  onFormDefinitionSelected(formDefinitionId: string) {
    this.selectedFormDefinition = this.formDefinitions.find(
      formDefinition => formDefinition.id === formDefinitionId
    );
  }

  clearSelectedFormDefinition(): void {
    this.selectedFormDefinition = null;
  }

  public mapFormFlowDefinitionsForDropdown(
    formFlowDefinitions: FormFlowDefinition[]
  ): DropdownItem[] {
    return (
      formFlowDefinitions &&
      formFlowDefinitions
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(formFlowDefinition => ({text: formFlowDefinition.name, id: formFlowDefinition.id}))
    );
  }

  onFormFlowDefinitionSelected(formFlowDefinitionId: string) {
    this.selectedFormFlowDefinition = this.formFlowDefinitions.find(
      formFlowDefinition => formFlowDefinition.id === formFlowDefinitionId
    );
  }

  clearSelectedFormFlowDefinition(): void {
    this.selectedFormFlowDefinition = null;
  }
}
