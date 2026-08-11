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
import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {ButtonModule, LoadingModule, TagModule} from 'carbon-components-angular';
import {MARKETPLACE_TEST_IDS} from '../../constants';
import {MarketplacePageService} from '../../services/marketplace-page.service';

/** Accepted package file extensions, mirroring what the backend will take. */
const ACCEPTED_EXTENSIONS = '.jar,.zip';

/**
 * The configured package repositories, plus the offline install path: a government
 * environment that cannot reach GitHub still has to be able to install a package.
 */
@Component({
  standalone: true,
  templateUrl: './package-stores.component.html',
  styleUrls: ['./package-stores.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'valtimo-package-stores',
  imports: [CommonModule, TranslateModule, ButtonModule, LoadingModule, TagModule],
})
export class PackageStoresComponent implements OnInit {
  public readonly ACCEPTED_EXTENSIONS = ACCEPTED_EXTENSIONS;

  public readonly loading$ = this.marketplacePageService.storesLoading$;
  public readonly stores$ = this.marketplacePageService.stores$;
  public readonly uploading$ = this.marketplacePageService.uploading$;

  protected readonly testIds = MARKETPLACE_TEST_IDS;

  constructor(private readonly marketplacePageService: MarketplacePageService) {}

  public ngOnInit(): void {
    this.marketplacePageService.loadStores();
  }

  public onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.marketplacePageService.uploadPackage(file);
    // Cleared so selecting the same file again re-triggers the change event.
    input.value = '';
  }
}
