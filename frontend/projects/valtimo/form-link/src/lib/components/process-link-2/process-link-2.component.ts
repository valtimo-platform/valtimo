/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {ProcessLinkService, ProcessLinkState2Service, ProcessLinkStepService} from '../../services';

@Component({
  selector: 'valtimo-process-link-2',
  templateUrl: './process-link-2.component.html',
  styleUrls: ['./process-link-2.component.scss'],
  providers: [ProcessLinkState2Service, ProcessLinkStepService],
})
export class ProcessLink2Component {
  constructor(
    private readonly processLinkService: ProcessLinkService,
    private readonly processLinkState2Service: ProcessLinkState2Service
  ) {}

  openModal(params: ModalParams): void {
    const activityType = params?.element?.activityListenerType;

    if (activityType) {
      this.processLinkService.getProcessLinkCandidates(activityType).subscribe(processLinkTypes => {
        this.processLinkState2Service.setAvailableProcessLinkTypes(processLinkTypes);
        this.processLinkState2Service.setElementName(params?.element?.name);
        this.processLinkState2Service.showModal();
      });
    }
  }
}
