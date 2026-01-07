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
import {Component, Inject, TemplateRef, ViewChild} from '@angular/core';
import {CommonModule, DOCUMENT} from '@angular/common';
import {
  BuildingBlockManagementApiService,
  BuildingBlockManagementDetailService,
} from '../../services';
import {
  ButtonModule,
  DialogModule,
  DropdownModule,
  IconModule,
  LoadingModule,
  Notification,
  TagModule,
} from 'carbon-components-angular';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {ValtimoCdsOverflowButtonDirective} from '@valtimo/components';
import {BehaviorSubject, map} from 'rxjs';
import {HttpResponse} from '@angular/common/http';
import {GlobalNotificationService} from '@valtimo/shared';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-overflow-menu',
  templateUrl: './building-block-management-overflow-menu.component.html',
  styleUrls: ['./building-block-management-overflow-menu.component.scss'],
  imports: [
    CommonModule,
    DropdownModule,
    TagModule,
    ButtonModule,
    DialogModule,
    IconModule,
    TranslatePipe,
    ValtimoCdsOverflowButtonDirective,
    LoadingModule,
  ],
})
export class BuildingBlockManagementOverflowMenuComponent {
  @ViewChild('exportingMessage')
  private readonly _exportMessageTemplateRef: TemplateRef<HTMLDivElement>;

  public readonly buildingBlockName$ =
    this.buildingBlockManagementDetailService.buildingBlockDefinition$.pipe(
      map(definition => definition.name ?? definition.key)
    );

  public readonly loadingDefinition$ = this.buildingBlockManagementDetailService.loadingDefinition$;

  private readonly _exporting$ = new BehaviorSubject<boolean>(false);
  public get exporting$() {
    return this._exporting$.asObservable();
  }

  private _currentNotification!: Notification;

  constructor(
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly notificationService: GlobalNotificationService,
    private readonly translateService: TranslateService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  public export(): void {
    this._currentNotification = this.notificationService.showNotification({
      type: 'info',
      title: '',
      showClose: false,
      template: this._exportMessageTemplateRef,
    });

    this.startExporting();

    this.buildingBlockManagementApiService
      .exportBuildingBlock(
        this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
        this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag
      )
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
          this.stopExporting();
        },
        error: () => {
          this.stopExporting();
        },
      });
  }

  private startExporting(): void {
    this._exporting$.next(true);
  }

  private stopExporting(): void {
    this._exporting$.next(false);
  }

  private downloadZip(response: HttpResponse<Blob>): void {
    const link = document.createElement('a');
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
}
