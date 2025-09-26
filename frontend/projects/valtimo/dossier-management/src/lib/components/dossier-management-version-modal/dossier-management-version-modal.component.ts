import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {
  CARBON_CONSTANTS,
  CarbonListModule,
  ColumnConfig,
  ValtimoCdsModalDirectiveModule,
  ViewType,
} from '@valtimo/components';
import {DocumentDefinitionVersionsResult} from '@valtimo/document';
import {ModalModule, TabsModule} from 'carbon-components-angular';
import {BehaviorSubject, Observable, switchMap} from 'rxjs';

import {DocumentDefinitionVersion, DocumentDefinitionVersionType} from '../../models';
import {DossierVersionApiService} from '../../services';

@Component({
  selector: 'valtimo-dossier-management-version-modal',
  templateUrl: './dossier-management-version-modal.component.html',
  styleUrl: './dossier-management-version-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, CarbonListModule, TabsModule, ModalModule],
})
export class DossierManagementVersionModalComponent {
  @Input() open = false;

  @Output() modalClose = new EventEmitter<null | DocumentDefinitionVersion>();

  public readonly activeType$ = new BehaviorSubject<DocumentDefinitionVersionType>('final');
  public readonly versionListItems$: Observable<DocumentDefinitionVersion[]> =
    this.activeType$.pipe(
      switchMap((type: DocumentDefinitionVersionType) =>
        type === 'final'
          ? this.dossierVersionApiService.finalVersions$
          : this.dossierVersionApiService.draftVersions$
      )
    );

  public readonly VERSION_FIELDS: ColumnConfig[] = [
    {
      key: 'versionNumber',
      label: 'Version',
      viewType: ViewType.TEXT,
    },
    {
      key: 'createdBy',
      label: 'Created By',
      viewType: ViewType.TEXT,
    },
    {
      key: 'message',
      label: 'Message',
      viewType: ViewType.TEXT,
      tooltipCharLimit: 100,
    },
    {
      key: 'lastEdited',
      label: 'Last Edited',
      viewType: ViewType.DATE,
    },
  ];

  constructor(private readonly dossierVersionApiService: DossierVersionApiService) {}

  public onModalClose(version: DocumentDefinitionVersion | null = null): void {
    this.modalClose.emit(version);
    setTimeout(() => {
      this.activeType$.next('final');
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public onTabSelected(type: DocumentDefinitionVersionType): void {
    this.activeType$.next(type);
  }
}
