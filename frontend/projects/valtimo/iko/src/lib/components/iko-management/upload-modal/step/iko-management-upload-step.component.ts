/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {Component, Input} from '@angular/core';
import { TEST_IDS } from '@valtimo/shared';

@Component({
  standalone: true,
  selector: 'valtimo-case-management-upload-step',
  templateUrl: './iko-management-upload-step.component.html',
  styleUrls: ['./iko-management-upload-step.component.scss'],
})
export class IkoManagementUploadStepComponent {
  readonly TEST_IDS = TEST_IDS;

  @Input() illustration!: string;
  @Input() message!: string;
  @Input() title!: string;
}
