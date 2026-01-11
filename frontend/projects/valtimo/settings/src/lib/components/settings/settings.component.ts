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

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {PageTitleService} from '@valtimo/components';
import {MenuIncludeService} from '@valtimo/shared';
import {
  ButtonModule,
  FileUploaderModule,
  IconModule,
  NotificationModule,
  TabsModule,
  TilesModule,
  ToggleModule,
} from 'carbon-components-angular';
import {BehaviorSubject, take} from 'rxjs';
import {BetaFeatures, SettingsApiService} from '../../services';

@Component({
  selector: 'valtimo-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    FileUploaderModule,
    IconModule,
    NotificationModule,
    TabsModule,
    TilesModule,
    ToggleModule,
  ],
  providers: [SettingsApiService],
})
export class SettingsComponent implements OnInit {
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly currentLogo$ = new BehaviorSubject<string | null>(null);
  public readonly uploading$ = new BehaviorSubject<boolean>(false);
  public readonly successMessage$ = new BehaviorSubject<string | null>(null);
  public readonly errorMessage$ = new BehaviorSubject<string | null>(null);

  public readonly betaLoading$ = new BehaviorSubject<boolean>(true);
  public readonly betaFeatures$ = new BehaviorSubject<BetaFeatures>({});
  public readonly betaSaving$ = new BehaviorSubject<boolean>(false);
  public readonly betaSuccessMessage$ = new BehaviorSubject<string | null>(null);
  public readonly betaErrorMessage$ = new BehaviorSubject<string | null>(null);

  private readonly MAX_FILE_SIZE = 500 * 1024; // 500KB

  constructor(
    private readonly settingsApiService: SettingsApiService,
    private readonly pageTitleService: PageTitleService,
    private readonly menuIncludeService: MenuIncludeService
  ) {}

  public ngOnInit(): void {
    this.pageTitleService.setCustomPageTitle('Settings');
    this.loadCurrentLogo();
    this.loadBetaFeatures();
  }

  public onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    if (file.size > this.MAX_FILE_SIZE) {
      this.errorMessage$.next('File size exceeds 500KB limit');
      return;
    }

    const allowedTypes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      this.errorMessage$.next('Only PNG, SVG, and JPG files are allowed');
      return;
    }

    this.uploadFile(file);
  }

  public deleteLogo(): void {
    this.uploading$.next(true);
    this.clearMessages();

    this.settingsApiService
      .deleteLogo()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.currentLogo$.next(null);
          this.successMessage$.next('Logo deleted successfully');
          this.uploading$.next(false);
        },
        error: () => {
          this.errorMessage$.next('Failed to delete logo');
          this.uploading$.next(false);
        },
      });
  }

  private loadCurrentLogo(): void {
    this.loading$.next(true);

    this.settingsApiService
      .getLogo()
      .pipe(take(1))
      .subscribe({
        next: logo => {
          this.currentLogo$.next(logo);
          this.loading$.next(false);
        },
        error: () => {
          this.loading$.next(false);
        },
      });
  }

  private uploadFile(file: File): void {
    this.uploading$.next(true);
    this.clearMessages();

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];

      this.settingsApiService
        .uploadLogo(base64)
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.currentLogo$.next(base64);
            this.successMessage$.next('Logo uploaded successfully');
            this.uploading$.next(false);
          },
          error: () => {
            this.errorMessage$.next('Failed to upload logo');
            this.uploading$.next(false);
          },
        });
    };

    reader.onerror = () => {
      this.errorMessage$.next('Failed to read file');
      this.uploading$.next(false);
    };

    reader.readAsDataURL(file);
  }

  private clearMessages(): void {
    this.successMessage$.next(null);
    this.errorMessage$.next(null);
  }

  private loadBetaFeatures(): void {
    this.betaLoading$.next(true);

    this.settingsApiService
      .getBetaFeatures()
      .pipe(take(1))
      .subscribe({
        next: features => {
          this.betaFeatures$.next(features);
          this.betaLoading$.next(false);
        },
        error: () => {
          this.betaLoading$.next(false);
        },
      });
  }

  public onBetaFeatureToggle(featureKey: string, enabled: boolean): void {
    this.betaSaving$.next(true);
    this.clearBetaMessages();

    this.settingsApiService
      .setBetaFeature(featureKey, enabled)
      .pipe(take(1))
      .subscribe({
        next: () => {
          const currentFeatures = this.betaFeatures$.getValue();
          this.betaFeatures$.next({...currentFeatures, [featureKey]: enabled});
          this.betaSuccessMessage$.next(enabled ? 'Feature enabled' : 'Feature disabled');
          this.betaSaving$.next(false);
          this.menuIncludeService.refreshBetaFeatures();
        },
        error: () => {
          this.betaErrorMessage$.next('Failed to update feature');
          this.betaSaving$.next(false);
        },
      });
  }

  private clearBetaMessages(): void {
    this.betaSuccessMessage$.next(null);
    this.betaErrorMessage$.next(null);
  }
}
