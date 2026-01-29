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

import {CommonModule, DOCUMENT} from '@angular/common';
import {HttpResponse} from '@angular/common/http';
import {Component, Inject, TemplateRef, ViewChild} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {ValtimoCdsModalDirective, ValtimoCdsOverflowButtonDirective} from '@valtimo/components';
import {GlobalNotificationService} from '@valtimo/shared';
import {
  ButtonModule,
  DialogModule,
  IconModule,
  InputModule,
  LayerModule,
  LoadingModule,
  ModalModule,
  Notification,
} from 'carbon-components-angular';
import {BehaviorSubject, finalize, map, switchMap, take} from 'rxjs';
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
    ValtimoCdsOverflowButtonDirective,
    LoadingModule,
  ],
})
export class BuildingBlockManagementDetailActionsComponent {
  @ViewChild('exportingMessage')
  private readonly _exportMessageTemplateRef: TemplateRef<HTMLDivElement>;

  public readonly actionInProgress$ = new BehaviorSubject<boolean>(false);
  public readonly showDraftModal$ = new BehaviorSubject<boolean>(false);
  public readonly definition$ = this.buildingBlockManagementDetailService.buildingBlockDefinition$;
  public readonly isFinal$ = this.buildingBlockManagementDetailService.isFinal$;

  public readonly buildingBlockName$ =
    this.buildingBlockManagementDetailService.buildingBlockDefinition$.pipe(
      map(definition => definition.name ?? definition.key)
    );

  private readonly _exporting$ = new BehaviorSubject<boolean>(false);
  public get exporting$() {
    return this._exporting$.asObservable();
  }

  public readonly draftForm: FormGroup = this.fb.group({
    versionTag: this.fb.control('', Validators.required),
  });

  public get versionTag(): FormControl<string> {
    return this.draftForm.get('versionTag') as FormControl<string>;
  }

  private _currentNotification!: Notification;

  constructor(
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly fb: FormBuilder,
    private readonly notificationService: GlobalNotificationService,
    private readonly translateService: TranslateService,
    @Inject(DOCUMENT) private document: Document
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

  public export(): void {
    if (this.actionInProgress$.value || this._exporting$.value) return;

    this._currentNotification = this.notificationService.showNotification({
      type: 'info',
      title: '',
      showClose: false,
      template: this._exportMessageTemplateRef,
    });

    this._exporting$.next(true);

    this.buildingBlockManagementApiService
      .exportBuildingBlock(
        this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
        this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag
      )
      .pipe(finalize(() => this._exporting$.next(false)))
      .subscribe({
        next: response => {
          this.closeCurrentNotification();

          this._currentNotification = this.notificationService.showNotification({
            type: 'success',
            title: this.translateService.instant(
              'buildingBlockManagement.overflowMenu.exportSuccessTitle'
            ),
            duration: 5000,
          });

          this.downloadZip(response);
        },
        error: () => {
          this.closeCurrentNotification();
          this.notifyError('buildingBlockManagement.overflowMenu.exportErrorTitle');
        },
      });
  }

  private downloadZip(response: HttpResponse<Blob>): void {
    const link = this.document.createElement('a');
    const contentDisposition = response.headers.get('content-disposition');
    const splitContentDisposition = contentDisposition?.split('filename=') ?? [];
    const fileName = splitContentDisposition.length > 1 && splitContentDisposition[1];

    link.href = this.document.defaultView?.URL.createObjectURL(response.body) ?? '';
    link.download =
      fileName ||
      `${this.buildingBlockManagementDetailService.buildingBlockDefinitionKey}_${this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag}.valtimo.zip`;
    link.target = '_blank';
    link.click();
    link.remove();
  }

  private closeCurrentNotification(): void {
    if (this._currentNotification) {
      this.notificationService.close(this._currentNotification);
    }
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
