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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {CommonModule} from '@angular/common';
import {Component} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {GlobalNotificationService} from '@valtimo/shared';
import {
  ButtonModule,
  DialogModule,
  IconModule,
  InputModule,
  LayerModule,
  ModalModule,
} from 'carbon-components-angular';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {BehaviorSubject, finalize, switchMap, take} from 'rxjs';
import {
  BuildingBlockManagementApiService,
  BuildingBlockManagementDetailService,
} from '../../services';
import {BuildingBlockManagementVersionSelectorComponent} from '../building-block-management-version-selector/building-block-management-version-selector.component';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-detail-actions',
  templateUrl: './building-block-management-detail-actions.component.html',
  styleUrls: ['./building-block-management-detail-actions.component.scss'],
  imports: [
    CommonModule,
    ButtonModule,
    ModalModule,
    InputModule,
    LayerModule,
    ReactiveFormsModule,
    IconModule,
    TranslatePipe,
    ValtimoCdsModalDirective,
    DialogModule,
    BuildingBlockManagementVersionSelectorComponent,
  ],
})
export class BuildingBlockManagementDetailActionsComponent {
  public readonly actionInProgress$ = new BehaviorSubject<boolean>(false);
  public readonly showDraftModal$ = new BehaviorSubject<boolean>(false);
  public readonly definition$ = this.buildingBlockManagementDetailService.buildingBlockDefinition$;
  public readonly isFinal$ = this.buildingBlockManagementDetailService.isFinal$;

  public readonly draftForm: FormGroup = this.fb.group({
    versionTag: this.fb.control('', Validators.required),
  });

  public get versionTag(): FormControl<string> {
    return this.draftForm.get('versionTag') as FormControl<string>;
  }

  constructor(
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly fb: FormBuilder,
    private readonly notificationService: GlobalNotificationService,
    private readonly translateService: TranslateService
  ) {}

  public finalizeDraft(): void {
    if (this.actionInProgress$.value) return;

    this.actionInProgress$.next(true);
    this.definition$
      .pipe(
        take(1),
        switchMap(definition =>
          this.buildingBlockManagementApiService.finalizeBuildingBlockDefinition(
            definition.key,
            definition.versionTag
          )
        ),
        finalize(() => this.actionInProgress$.next(false))
      )
      .subscribe({
        next: () => {
          this.notifySuccess('buildingBlockManagement.actions.finalize.success');
          this.buildingBlockManagementDetailService.reload();
          this.buildingBlockManagementDetailService.reloadVersions();
        },
        error: () => {
          this.notifyError('buildingBlockManagement.actions.finalize.error');
        },
      });
  }

  public openDraftModal(): void {
    this.showDraftModal$.next(true);
  }

  public closeDraftModal(): void {
    this.showDraftModal$.next(false);
    this.draftForm.reset();
  }

  public createDraft(): void {
    if (this.draftForm.invalid || this.actionInProgress$.value) return;

    this.actionInProgress$.next(true);
    const newVersionTag = this.versionTag.value;

    this.definition$
      .pipe(
        take(1),
        switchMap(definition =>
          this.buildingBlockManagementApiService.createDraftBuildingBlockDefinition(
            definition.key,
            definition.versionTag,
            newVersionTag
          )
        ),
        finalize(() => this.actionInProgress$.next(false))
      )
      .subscribe({
        next: draft => {
          this.notifySuccess('buildingBlockManagement.actions.draft.success');
          this.closeDraftModal();
          this.buildingBlockManagementDetailService.reloadVersions();
          this.buildingBlockManagementDetailService.navigateToVersionTag(draft.versionTag);
        },
        error: () => {
          this.notifyError('buildingBlockManagement.actions.draft.error');
        },
      });
  }

  private notifySuccess(translationKey: string): void {
    this.notificationService.showNotification({
      type: 'success',
      title: this.translateService.instant(translationKey),
      duration: 5000,
    });
  }

  private notifyError(translationKey: string): void {
    this.notificationService.showNotification({
      type: 'error',
      title: this.translateService.instant(translationKey),
      duration: 5000,
    });
  }
}
