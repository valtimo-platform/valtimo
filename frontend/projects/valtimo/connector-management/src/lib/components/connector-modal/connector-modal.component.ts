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

import {AfterViewInit, Component, OnDestroy, ViewChild} from '@angular/core';
import {Observable, Subject, Subscription} from 'rxjs';
import {ConnectorType} from '@valtimo/config';
import {ConnectorManagementStateService} from '../../services/connector-management-state/connector-management-state.service';
import {take} from 'rxjs/operators';
import {VModalComponent, ModalService} from '@valtimo/components';

/**
 * @deprecated Use the new plugin framework
 */
@Component({
  selector: 'valtimo-connector-modal',
  templateUrl: './connector-modal.component.html',
  styleUrls: ['./connector-modal.component.scss'],
})
export class ConnectorModalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('connectorCreateModal') connectorCreateModal: VModalComponent;
  @ViewChild('connectorEditModal') connectorEditModal: VModalComponent;

  showSubscription!: Subscription;
  hideSubscription!: Subscription;

  readonly connectorTypeSelected$: Observable<ConnectorType> = this.stateService.selectedConnector$;
  readonly saveButtonDisabled$: Observable<boolean> = this.stateService.saveButtonDisabled$;
  readonly inputDisabled$: Observable<boolean> = this.stateService.inputDisabled$;
  readonly hideModalSaveButton$: Observable<boolean> = this.stateService.hideModalSaveButton$;
  readonly returnToFirstStepSubject$ = new Subject<boolean>();

  constructor(
    private readonly stateService: ConnectorManagementStateService,
    private readonly modalService: ModalService
  ) {}

  ngAfterViewInit(): void {
    this.openShowSubscription();
    this.openHideSubscription();
  }

  ngOnDestroy(): void {
    this.showSubscription?.unsubscribe();
    this.hideSubscription?.unsubscribe();
  }

  hide(): void {
    this.stateService.disableInput();
    this.modalService.closeModal(() => {
      this.returnToFirstStep();
      this.stateService.enableInput();
      this.stateService.clearSelectedConnector();
    });
  }

  complete(): void {
    this.stateService.save();
  }

  delete(): void {
    this.stateService.delete();
  }

  private openShowSubscription(): void {
    this.showSubscription = this.stateService.showModal$.subscribe(() => {
      this.show();
    });
  }

  private openHideSubscription(): void {
    this.hideSubscription = this.stateService.hideModal$.subscribe(() => {
      this.hide();
    });
  }

  private returnToFirstStep(): void {
    this.returnToFirstStepSubject$.next(true);
  }

  private show(): void {
    this.stateService.modalType$.pipe(take(1)).subscribe(modalType => {
      if (modalType === 'add') {
        this.modalService.openModal(this.connectorCreateModal);
      } else if (modalType === 'modify') {
        this.modalService.openModal(this.connectorEditModal);
      }
    });
  }
}
