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

import {Component, OnInit, ViewChild} from '@angular/core';
import {PluginManagementStateService} from '../../services';
import {take} from 'rxjs/operators';
import {ModalComponent, ModalService} from '@valtimo/user-interface';
import {Subject, Subscription} from 'rxjs';

@Component({
  selector: 'valtimo-plugin-add-modal',
  templateUrl: './plugin-add-modal.component.html',
  styleUrls: ['./plugin-add-modal.component.scss'],
})
export class PluginAddModalComponent implements OnInit {
  @ViewChild('pluginAddModal') pluginAddModal: ModalComponent;

  readonly inputDisabled$ = this.stateService.inputDisabled$;
  readonly selectedPluginDefinition$ = this.stateService.selectedPluginDefinition$;
  readonly returnToFirstStepSubject$ = new Subject<boolean>();

  private showSubscription!: Subscription;
  private hideSubscription!: Subscription;

  constructor(
    private readonly stateService: PluginManagementStateService,
    private readonly modalService: ModalService
  ) {}

  ngOnInit(): void {
    this.openShowSubscription();
    this.openHideSubscription();
  }

  complete(): void {
    this.stateService.save();
  }

  delete(): void {
    this.stateService.delete();
  }

  hide(): void {
    this.stateService.disableInput();
    this.modalService.closeModal();

    this.modalService.appearingDelayMs$.pipe(take(1)).subscribe(appearingDelay => {
      setTimeout(() => {
        this.returnToFirstStep();
        this.stateService.enableInput();
        this.stateService.clear();
      }, appearingDelay);
    });
  }

  private openShowSubscription(): void {
    this.showSubscription = this.stateService.showModal$.subscribe(modalType => {
      if (modalType === 'add') {
        this.show();
      }
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
    this.modalService.openModal(this.pluginAddModal);
  }
}
