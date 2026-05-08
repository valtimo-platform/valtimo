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

import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslatePipe} from '@ngx-translate/core';
import {FormBuilder, FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  AdminSettingsService,
  ConfirmationModalModule,
  RenderInBodyComponent,
} from '@valtimo/components';
import {
  ButtonModule,
  FileUploaderModule,
  IconModule,
  IconService,
  LayerModule,
  LoadingModule,
} from 'carbon-components-angular';
import {BehaviorSubject, map, Subscription, switchMap, tap} from 'rxjs';
import {TrashCan16, Upload16} from '@carbon/icons';
import {AdminSettingsManagementApiService} from '../../services';

@Component({
  standalone: true,
  selector: 'valtimo-admin-settings-logo',
  templateUrl: './admin-settings-logo.component.html',
  styleUrls: ['./admin-settings-logo.component.scss'],
  imports: [
    CommonModule,
    TranslatePipe,
    ReactiveFormsModule,
    LayerModule,
    ButtonModule,
    FileUploaderModule,
    LoadingModule,
    IconModule,
    ConfirmationModalModule,
    RenderInBodyComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsLogoComponent implements OnInit, OnDestroy {
  @Input() public logoType!: string;
  @Input() public titleTranslationKey!: string;

  public get previewTheme(): string {
    return this.logoType === 'LOGO_DARK_MODE' ? 'g90' : 'g10';
  }

  public readonly ACCEPTED_FILES: string[] = ['png', 'svg'];

  public readonly formGroup = this._formBuilder.group({
    file: this._formBuilder.control(new Set<any>(), [Validators.required]),
  });

  public get file(): FormControl<Set<any>> {
    return this.formGroup.get('file') as FormControl<Set<File>>;
  }

  public readonly loading$ = new BehaviorSubject<boolean>(true);

  private readonly _refresh$ = new BehaviorSubject<null>(null);

  public readonly logo$ = this._refresh$.pipe(
    switchMap(() => this._adminSettingsManagementApiService.getLogos()),
    map(logos => (this.logoType === 'LOGO' ? logos.logo : logos.logoDarkMode) ?? null),
    tap(() => this.loading$.next(false))
  );

  public readonly showDeleteConfirmationModal$ = new BehaviorSubject<boolean>(false);

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly _adminSettingsManagementApiService: AdminSettingsManagementApiService,
    private readonly _adminSettingsService: AdminSettingsService,
    private readonly _formBuilder: FormBuilder,
    private readonly _iconService: IconService
  ) {
    this._iconService.registerAll([Upload16, TrashCan16]);
  }

  public ngOnInit(): void {
    this._subscriptions.add(this.logo$.subscribe());
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public async onSave(): Promise<void> {
    const file = Array.from(this.file.value)[0]?.file;
    const imageBase64 = await this._fileToBase64(file);

    this.formGroup.disable();

    this._adminSettingsManagementApiService.uploadLogo(this.logoType, {imageBase64}).subscribe({
      next: () => {
        this.loading$.next(true);
        this._refresh$.next(null);
        this._adminSettingsService.refreshLogos();
        this.formGroup.enable();
      },
      error: () => {
        this.formGroup.enable();
      },
    });
  }

  public getImageSrc(imageBase64: string): string {
    const mimeType = this._isSvg(imageBase64) ? 'image/svg+xml' : 'image/png';
    return `data:${mimeType};base64,${imageBase64}`;
  }

  public onDeleteButtonClick(): void {
    this.showDeleteConfirmationModal$.next(true);
  }

  public onDelete(): void {
    this._adminSettingsManagementApiService.deleteLogo(this.logoType).subscribe(() => {
      this.loading$.next(true);
      this._refresh$.next(null);
      this._adminSettingsService.refreshLogos();
    });
  }

  private _isSvg(base64: string): boolean {
    try {
      const decoded = atob(base64.substring(0, 64));
      const trimmed = decoded.trimStart();
      return trimmed.startsWith('<?xml') || trimmed.startsWith('<svg');
    } catch {
      return false;
    }
  }

  private async _fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const pureBase64 = result.split(',')[1];
        resolve(pureBase64);
      };
      reader.onerror = error => reject(error);
    });
  }
}
