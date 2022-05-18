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

import {Component, ViewChild} from '@angular/core';
import {BehaviorSubject, Subject} from 'rxjs';
import {ModalParams} from '../../models';
import {ModalComponent, ModalService} from '@valtimo/user-interface';
import {ProcessLinkStateService} from '../../services/process-link-state.service';
import {take} from 'rxjs/operators';

@Component({
  selector: 'valtimo-process-link',
  templateUrl: './process-link.component.html',
  styleUrls: ['./process-link.component.scss'],
  providers: [ProcessLinkStateService],
})
export class ProcessLinkComponent {
  @ViewChild('pluginModal') connectorCreateModal: ModalComponent;

  readonly returnToFirstStepSubject$ = new Subject<boolean>();
  readonly selectedPluginDefinition$ = this.processLinkStateService.selectedPluginDefinition$;

  constructor(
    private readonly modalService: ModalService,
    private readonly processLinkStateService: ProcessLinkStateService
  ) {}

  complete(): void {
    console.log('complete');
  }

  hide(): void {
    this.processLinkStateService.clear();
    this.modalService.closeModal();

    this.modalService.appearingDelayMs$.pipe(take(1)).subscribe(appearingDelay => {
      setTimeout(() => {
        this.returnToFirstStepSubject$.next(true);
      }, appearingDelay);
    });
  }

  openModal(params: ModalParams): void {
    this.modalService.openModal(this.connectorCreateModal);
  }
}
