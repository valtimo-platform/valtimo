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

import {Component} from '@angular/core';
import {ModalParams} from '../../models';
import {
  ProcessLinkButtonService,
  ProcessLinkService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '../../services';
import {of, switchMap, tap} from 'rxjs';
import {ModalService} from '@valtimo/components';

@Component({
  selector: 'valtimo-process-link',
  templateUrl: './process-link.component.html',
  styleUrls: ['./process-link.component.scss'],
  providers: [ProcessLinkStateService, ProcessLinkStepService, ProcessLinkButtonService],
})
export class ProcessLinkComponent {
  constructor(
    private readonly processLinkService: ProcessLinkService,
    private readonly stateService: ProcessLinkStateService,
    private readonly modalService: ModalService
  ) {}

  openModal(params: ModalParams): void {
    const activityType = params?.element?.activityListenerType;

    this.modalService.setModalData(params);

    if (activityType) {
      this.processLinkService
        .getProcessLink({
          activityId: params.element.id,
          processDefinitionId: params.processDefinitionId,
        })
        .pipe(
          switchMap(processLinks => {
            if (processLinks.length > 0) {
              return of({processLink: processLinks[0]});
            }

            return this.processLinkService.getProcessLinkCandidates(activityType);
          }),
          tap(res => {
            const result = res as any;
            const processLink = result.processLink;

            this.stateService.setModalParams(params);
            this.stateService.setElementName(params?.element?.name);

            if (processLink) {
              this.stateService.selectProcessLink(processLink);
            } else {
              this.stateService.setAvailableProcessLinkTypes(result);
            }

            if (result?.length > 0 || processLink) {
              this.stateService.showModal();
            }
          })
        )
        .subscribe();
    }
  }
}
