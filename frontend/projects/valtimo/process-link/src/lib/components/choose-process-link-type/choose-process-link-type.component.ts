/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {ProcessLinkStateService} from '../../services';
import {UNSUPPORTED_PROCESS_LINK_TYPES_IN_BUILDING_BLOCK} from '../../constants';
import { TEST_IDS } from '@valtimo/shared';

@Component({
  standalone: false,
  selector: 'valtimo-choose-process-link-type',
  templateUrl: './choose-process-link-type.component.html',
  styleUrls: ['./choose-process-link-type.component.scss'],
})
export class ChooseProcessLinkTypeComponent {
  readonly TEST_IDS = TEST_IDS;

  public readonly availableProcessLinkTypes$ =
    this.processLinkStateService.availableProcessLinkTypes$;

  constructor(private readonly processLinkStateService: ProcessLinkStateService) {}

  public getTooltipKey(processLinkTypeId: string): string {
    if (
      this.processLinkStateService.isBuildingBlockContext() &&
      UNSUPPORTED_PROCESS_LINK_TYPES_IN_BUILDING_BLOCK.includes(processLinkTypeId)
    ) {
      return 'processLinkTypeDisabledTooltip.buildingBlockUnsupported';
    }
    return 'processLinkTypeDisabledTooltip.' + processLinkTypeId;
  }

  public selectProcessLinkType(processLinkTypeId: string): void {
    this.processLinkStateService.selectProcessLinkType(processLinkTypeId);
  }
}
