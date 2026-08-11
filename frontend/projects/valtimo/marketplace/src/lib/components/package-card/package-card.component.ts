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

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  IconModule,
  IconService,
  TagModule,
  TilesModule,
} from 'carbon-components-angular';
import {Launch16} from '@carbon/icons';
import {MARKETPLACE_TEST_IDS} from '../../constants';
import {PackageListItem, PackageTrust} from '../../models';

@Component({
  standalone: true,
  selector: 'valtimo-package-card',
  templateUrl: './package-card.component.html',
  styleUrls: ['./package-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, ButtonModule, IconModule, TagModule, TilesModule],
})
export class PackageCardComponent {
  @Input() public package!: PackageListItem;
  @Input() public pending = false;

  @Output() public detailEvent = new EventEmitter<PackageListItem>();
  @Output() public installEvent = new EventEmitter<PackageListItem>();
  @Output() public uninstallEvent = new EventEmitter<PackageListItem>();
  @Output() public updateEvent = new EventEmitter<PackageListItem>();

  public readonly PackageTrust = PackageTrust;

  protected readonly testIds = MARKETPLACE_TEST_IDS;

  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([Launch16]);
  }

  public onDetail(): void {
    this.detailEvent.emit(this.package);
  }

  public onInstall(): void {
    this.installEvent.emit(this.package);
  }

  public onUninstall(): void {
    this.uninstallEvent.emit(this.package);
  }

  public onUpdate(): void {
    this.updateEvent.emit(this.package);
  }
}
