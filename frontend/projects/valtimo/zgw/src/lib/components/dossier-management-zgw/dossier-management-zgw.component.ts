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

import {ChangeDetectionStrategy, Component} from '@angular/core';
import {TabsModule} from 'carbon-components-angular';
import {DossierManagementZgwService} from '../../services';
import {ZgwTabEnum} from '../../models';
import {TranslateModule} from '@ngx-translate/core';
import {CommonModule} from '@angular/common';
import {DocumentenApiColumnsComponent} from '../../modules';

@Component({
  templateUrl: './dossier-management-zgw.component.html',
  styleUrls: ['./dossier-management-zgw.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, TabsModule, TranslateModule, DocumentenApiColumnsComponent],
})
export class DossierManagementZgwComponent {
  public readonly ZgwTabEnum = ZgwTabEnum;

  public readonly currentTab$ = this.dossierManagementZgwService.currentTab$;

  constructor(private readonly dossierManagementZgwService: DossierManagementZgwService) {}

  public displayTab(tab: ZgwTabEnum): void {
    this.dossierManagementZgwService.currentTab = tab;
  }
}
