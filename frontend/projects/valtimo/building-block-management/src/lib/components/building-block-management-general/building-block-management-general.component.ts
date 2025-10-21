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
import {MuuriDirective, MuuriItemComponent} from '@valtimo/components';
import {BuildingBlockManagementMetadataComponent} from '../building-block-management-metadata/building-block-management-metadata.component';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-general',
  templateUrl: './building-block-management-general.component.html',
  styleUrls: ['./building-block-management-general.component.scss'],
  imports: [
    CommonModule,
    MuuriDirective,
    MuuriItemComponent,
    BuildingBlockManagementMetadataComponent,
  ],
})
export class BuildingBlockManagementGeneralComponent {
  constructor(
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService
  ) {}
}
