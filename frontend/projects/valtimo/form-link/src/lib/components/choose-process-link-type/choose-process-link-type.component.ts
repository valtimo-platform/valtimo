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
import {ProcessLinkState2Service} from '../../services';

@Component({
  selector: 'valtimo-choose-process-link-type',
  templateUrl: './choose-process-link-type.component.html',
  styleUrls: ['./choose-process-link-type.component.scss'],
})
export class ChooseProcessLinkTypeComponent {
  public readonly availableProcessLinkTypes$ =
    this.processLinkState2Service.availableProcessLinkTypes$;

  constructor(private readonly processLinkState2Service: ProcessLinkState2Service) {}

  selectProcessLinkType(processLinkTypeId: string): void {
    this.processLinkState2Service.selectProcessLinkType(processLinkTypeId);
  }
}
