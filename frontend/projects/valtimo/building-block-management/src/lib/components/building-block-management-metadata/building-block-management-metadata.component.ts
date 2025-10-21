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
import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {BuildingBlockManagementDetailService} from '../../services';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-metadata',
  templateUrl: './building-block-management-metadata.component.html',
  styleUrls: ['./building-block-management-metadata.component.scss'],
  imports: [CommonModule, TranslatePipe],
  providers: [BuildingBlockManagementDetailService],
})
export class BuildingBlockManagementMetadataComponent {
  constructor(
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService
  ) {}
}
