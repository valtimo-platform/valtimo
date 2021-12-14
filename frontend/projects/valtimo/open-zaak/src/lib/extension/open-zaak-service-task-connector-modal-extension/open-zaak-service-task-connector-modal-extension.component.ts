/*
 * Copyright 2020 Dimpact.
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

import {Component, OnInit, ViewChild} from '@angular/core';
import {NgbModal, NgbModalOptions} from '@ng-bootstrap/ng-bootstrap';
import {FormManagementService} from '@valtimo/form-management';
import {
  BpmnElement,
  Operation,
  ZaakOperation,
  ServiceTaskHandlerRequest, ZaakResultType, ZaakStatusType,
  ZaakType,
  ZaakTypeLink, PreviousSelectedZaak
} from '@valtimo/contract';
import {AlertService, ModalComponent} from '@valtimo/components';
import {OpenZaakService} from '@valtimo/resource';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-open-zaak-service-task-connector-modal-extension',
  templateUrl: './open-zaak-service-task-connector-modal-extension.component.html',
  styleUrls: ['./open-zaak-service-task-connector-modal-extension.component.scss']
})
export class OpenZaakServiceTaskConnectorModalExtensionComponent implements OnInit {

  public modalOptions: NgbModalOptions;
  public selectedElement: BpmnElement | null;
  public previousSelectedZaak: PreviousSelectedZaak | null;
  public selectedZaakTypeLink: ZaakTypeLink | null;
  public selectedZaakType: ZaakType | null;
  public selectedZaakOperation: Operation | null;
  public selectedZaakStatus: ZaakStatusType | null;
  public selectedZaakResult: ZaakResultType | null;
  public selectedServiceTaskHandler: ServiceTaskHandlerRequest | null;
  public connectedZaakTypeLinks: ZaakTypeLink[] | null;
  public filteredConnectedZaakTypeLinks: ZaakTypeLink[] | null;
  public connectedServiceTasks: ServiceTaskHandlerRequest[] | null;
  public zaakTypes: ZaakType[];
  public operations: ZaakOperation[];
  public statusTypes: ZaakStatusType[];
  public resultTypes: ZaakResultType[];
  public displayForm: boolean;
  public isEditMode: boolean;
  public processDefinitionKey: string | null;

  @ViewChild('openZaakServiceTaskConnectorModal') modal: ModalComponent;

  constructor(
    private modalService: NgbModal,
    private formManagementService: FormManagementService,
    private openZaakService: OpenZaakService,
    private router: Router,
    private alertService: AlertService,
    private translateService: TranslateService
  ) {
    this.modalOptions = {};
    this.selectedElement = null;
    this.previousSelectedZaak = null;
    this.selectedZaakTypeLink = null;
    this.selectedZaakType = null;
    this.selectedZaakOperation = null;
    this.connectedServiceTasks = [];
    this.displayForm = true;
    this.isEditMode = false;
    this.processDefinitionKey = null;
    this.loadOpenZaakOperations();
  }

  ngOnInit() {
  }

  openModal(params: { element: BpmnElement, processDefinitionKey: string }) {
    this.selectedElement = params.element;
    this.processDefinitionKey = params.processDefinitionKey;

    this.openZaakService.getOpenZaakConfig().subscribe(config => {
      if (config === null) {
        this.alertService.error(this.translateService.instant('openZaak.error.configNotFound'));
      } else {
        this.getZaakTypeLinkByProcess(this.processDefinitionKey);
        this.loadZaakTypes();
      }
    });
  }

  public loadExistingServiceTaskHandlers() {
    this.connectedZaakTypeLinks.forEach((connectedZaakTypeLink: ZaakTypeLink) => {
      const foundServiceTaskHandler = connectedZaakTypeLink.serviceTaskHandlers.find(serviceTaskHandler =>
          serviceTaskHandler.processDefinitionKey === this.processDefinitionKey
          && serviceTaskHandler.serviceTaskId === this.selectedElement.id);
      if (foundServiceTaskHandler != null) {
        this.connectedServiceTasks.push(foundServiceTaskHandler);
        const existingServiceTaskHandlers = this.connectedZaakTypeLinks.filter(zaakTypeLink => {
          return zaakTypeLink.serviceTaskHandlers.some(serviceHandler => serviceHandler.processDefinitionKey === this.processDefinitionKey
              && serviceHandler.serviceTaskId === this.selectedElement.id);
        });
        this.filteredConnectedZaakTypeLinks = this.connectedZaakTypeLinks.filter(serviceTaskHandler =>
          !existingServiceTaskHandlers.includes(serviceTaskHandler));
        this.getZaakInformation(connectedZaakTypeLink.zaakTypeUrl, foundServiceTaskHandler);
      }
    });
    this.displayForm = this.connectedServiceTasks.length === 0;
  }

  public loadOpenZaakOperations() {
    this.operations = [
      {
        type: 'CREATE_ZAAK',
        label: 'Create zaak'
      },
      {
        type: 'SET_RESULTAAT',
        label: 'Set resultaat'
      },
      {
        type: 'SET_STATUS',
        label: 'Set Status'
      }
    ];
  }

  public loadZaakTypes() {
    this.openZaakService.getZaakTypes().subscribe((zaakTypes: ZaakType[]) => {
      this.zaakTypes = zaakTypes;
    });
  }

  public getZaakTypeLink(documentDefinitionName: string) {
    this.connectedZaakTypeLinks.forEach((connectedZaakTypeLink: ZaakTypeLink) => {
      if (connectedZaakTypeLink.documentDefinitionName === documentDefinitionName && connectedZaakTypeLink.zaakTypeUrl != null) {
        this.selectedZaakType = this.zaakTypes.find(zaakType => zaakType.url === connectedZaakTypeLink.zaakTypeUrl);
      }
    });
    this.selectedZaakOperation = null;
    this.selectedZaakStatus = null;
    this.selectedZaakResult = null;
  }

  public getZaakInformation(parameter, data) {
    const zaakTypeRequest = {
      zaaktype: parameter
    };
    switch (data.operation || data) {
      case Operation.SET_STATUS:
        this.openZaakService.getStatusTypes(zaakTypeRequest).subscribe((statusTypes: ZaakStatusType[]) => {
          this.statusTypes = statusTypes;
          if (data.parameter != null) {
            this.selectedZaakStatus = this.statusTypes.find((statusType: ZaakStatusType) => statusType.url === data.parameter);
          }
        });
        break;
      case Operation.SET_RESULTAAT:
        this.openZaakService.getStatusResults(zaakTypeRequest).subscribe((resultTypes: ZaakResultType[]) => {
          this.resultTypes = resultTypes;
          if (data.parameter != null) {
            this.selectedZaakResult = this.resultTypes.find((resultType: ZaakResultType) => resultType.url === data.parameter);
          }
        });
        break;
      default:
        return null;
    }
  }

  private getZaakTypeLinkByProcess(processDefinitionKey: string) {
    this.openZaakService.getZaakTypeLinkListByProcess(processDefinitionKey).subscribe((zaakTypeLinkList: ZaakTypeLink[]) => {
      this.connectedZaakTypeLinks = zaakTypeLinkList;
      this.filteredConnectedZaakTypeLinks = this.connectedZaakTypeLinks;
      this.modal.show();
      if (this.connectedZaakTypeLinks.length > 0) {
        this.loadExistingServiceTaskHandlers();
      }
    });
  }

  public submit(zaakType: ZaakType, operation) {
    let parameter;
    switch (operation) {
      case Operation.SET_STATUS:
        parameter = this.selectedZaakStatus.url;
        break;
      case Operation.SET_RESULTAAT:
        parameter = this.selectedZaakResult.url;
        break;
      default:
        parameter = this.selectedZaakTypeLink.zaakTypeUrl;
    }

    !this.isEditMode ? this.createServiceTaskHandler(parameter) : this.modifyServieTaskHandler(zaakType, parameter);
  }

  public editConnectedZaakTypeLink(zaakTypeLink: ZaakTypeLink, serviceTaskHandler) {
    this.displayForm = true;
    this.isEditMode = true;

    const existingServiceTaskHandlers = this.connectedZaakTypeLinks.filter(connectedZaakTypeLink => {
      if (zaakTypeLink.documentDefinitionName !== connectedZaakTypeLink.documentDefinitionName) {
        return connectedZaakTypeLink.serviceTaskHandlers.some(serviceHandler =>
            serviceHandler.processDefinitionKey === this.processDefinitionKey && serviceHandler.serviceTaskId === this.selectedElement.id);
      }
    });

    this.filteredConnectedZaakTypeLinks = this.connectedZaakTypeLinks.filter(connectedServiceTaskHandler =>
      !existingServiceTaskHandlers.includes(connectedServiceTaskHandler));
    this.selectedZaakTypeLink = zaakTypeLink;
    this.selectedZaakType = this.zaakTypes.find(zaakType => zaakType.url === zaakTypeLink.zaakTypeUrl);
    this.selectedZaakOperation = serviceTaskHandler['operation'];
    this.selectedServiceTaskHandler = serviceTaskHandler;
    this.previousSelectedZaak = {
      zaakTypeLink: this.selectedZaakTypeLink,
      zaakType: this.selectedZaakType,
      serviceTaskHandler: serviceTaskHandler
    };
  }

  public gotoDossierManagementScreen() {
    this.modal.hide();
    this.router.navigate(['dossier-management']);
  }

  public setFormMode(displayForm: boolean) {
    this.displayForm = displayForm;
    this.isEditMode = false;
  }

  private createServiceTaskHandler(parameter: string) {
    this.openZaakService.createServiceTaskHandler(this.selectedZaakTypeLink.id, this.createServiceTaskHandlerRequest(parameter)).subscribe(
      () => {
        this.alertService.success('Service task linked');
      }, () => {
        this.alertService.error('Failed to link Service task');
      });
  }

  private modifyServieTaskHandler(zaakType: ZaakType, parameter: string) {
    if (this.previousSelectedZaak != null && this.previousSelectedZaak.zaakType !== zaakType) {
      this.openZaakService.deleteServiceTaskHandler(this.previousSelectedZaak.zaakTypeLink.id,
          this.selectedServiceTaskHandler.processDefinitionKey, this.selectedServiceTaskHandler.serviceTaskId).subscribe();
    }
    this.openZaakService.modifyServiceTaskHandler(this.selectedZaakTypeLink.id,
      this.createServiceTaskHandlerRequest(parameter)).subscribe(() => {
      this.alertService.success('Service task link updated');
    }, () => {
      this.alertService.error('Failed to update Service task link');
    });
  }

  public deleteServiceTaskFromHandler(documentDefinitionName: string, processDefinitionKey: string, serviceTaskId: string) {
    this.connectedZaakTypeLinks.map((connectedZaakTypeLink, i) => {
      if (connectedZaakTypeLink.documentDefinitionName === documentDefinitionName) {
        this.connectedZaakTypeLinks[i].serviceTaskHandlers = connectedZaakTypeLink.serviceTaskHandlers.filter(
          serviceTaskHandler => {
            if (serviceTaskHandler.processDefinitionKey === processDefinitionKey && serviceTaskHandler.serviceTaskId === serviceTaskId) {
              this.openZaakService.deleteServiceTaskHandler(connectedZaakTypeLink.id, serviceTaskHandler.processDefinitionKey,
                  serviceTaskHandler.serviceTaskId).subscribe(() => {
                this.alertService.success('Service task unlinked');
              }, () => {
                this.alertService.error('Failed to unlink Service task');
              });
            }
            return serviceTaskHandler.processDefinitionKey !== processDefinitionKey && serviceTaskHandler.serviceTaskId !== serviceTaskId;
          }
        );
        this.filteredConnectedZaakTypeLinks = this.filteredConnectedZaakTypeLinks.concat(
          this.connectedZaakTypeLinks.filter(zaakTypeLink => zaakTypeLink.zaakTypeUrl === this.connectedZaakTypeLinks[i].zaakTypeUrl));
        const zaakTypeLinksWithConnectedServiceTask = this.connectedZaakTypeLinks.filter(
          zaakTypeLink => zaakTypeLink.serviceTaskHandlers.some(item => item.processDefinitionKey === processDefinitionKey &&
              item.serviceTaskId === serviceTaskId));

        if (zaakTypeLinksWithConnectedServiceTask.length === 0) {
          this.connectedServiceTasks = [];
          this.displayForm = true;
        }
      }
    });

  }

  private createServiceTaskHandlerRequest(parameter: string) {
    return {
      processDefinitionKey: this.processDefinitionKey,
      serviceTaskId: this.selectedElement.id,
      operation: this.selectedZaakOperation,
      parameter
    };
  }
}
