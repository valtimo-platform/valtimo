import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {BehaviorSubject, Observable, combineLatest, filter, map, switchMap, take, tap} from 'rxjs';
import {BuildingBlock, BuildingBlockApiService} from '@valtimo/building-block-resources';
import {ActionItem, CarbonListModule, ColumnConfig} from '@valtimo/components';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  ListItem,
  ModalModule,
} from 'carbon-components-angular';

@Component({
  selector: 'valtimo-dossier-management-building-blocks',
  templateUrl: './dossier-management-building-blocks.component.html',
  styleUrl: './dossier-management-building-blocks.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, CarbonListModule, ButtonModule, IconModule, ModalModule, DropdownModule],
})
export class DossierManagementBuildingBlocksComponent {
  private readonly _documentDefinitionName$ = new BehaviorSubject<string | null>(null);
  @Input() public set documentDefinitionName(value: string) {
    this._documentDefinitionName$.next(value);
  }

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly buildingBlocks$ = combineLatest([
    this._documentDefinitionName$,
    this.buildingBlockApiService.buildingBlocks$,
  ]).pipe(
    tap(() => this.loading$.next(true)),
    map(([documentDefinitionName, buildingBlocks]) =>
      !documentDefinitionName
        ? []
        : buildingBlocks.filter((block: BuildingBlock) =>
            block.linkedCaseIds.includes(documentDefinitionName)
          )
    ),
    tap(() => this.loading$.next(false))
  );
  public readonly linkModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly availableBuildingBlocksItems$: Observable<ListItem[]> = combineLatest([
    this._documentDefinitionName$,
    this.buildingBlockApiService.buildingBlocks$,
  ]).pipe(
    map(([documentDefinitionName, buildingBlocks]) =>
      !documentDefinitionName
        ? []
        : buildingBlocks.reduce(
            (acc, curr) => [
              ...acc,
              ...(!curr.linkedCaseIds.includes(documentDefinitionName)
                ? [{content: curr.name, id: curr.id, selected: false}]
                : []),
            ],
            [] as ListItem[]
          )
    )
  );
  public readonly selectedBlock$ = new BehaviorSubject<ListItem | null>(null);

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'name',
      label: 'Name',
    },
    {
      key: 'description',
      label: 'Description',
    },
  ];
  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'Unlink',
      callback: this.onUnlinkClick.bind(this),
      type: 'danger',
    },
  ];

  constructor(private readonly buildingBlockApiService: BuildingBlockApiService) {}

  public onLinkClick(): void {
    this.linkModalOpen$.next(true);
  }

  public onConfirmLinkModal(): void {
    combineLatest([this._documentDefinitionName$, this.selectedBlock$])
      .pipe(take(1))
      .subscribe(([documentDefinitionName, block]) => {
        this.buildingBlockApiService.linkBlockToCase(documentDefinitionName ?? '', block?.id);
      });
    this.onCloseLinkModal();
  }

  public onCloseLinkModal(): void {
    this.linkModalOpen$.next(false);
  }

  public onBlockSelected(event: {item: ListItem}): void {
    this.selectedBlock$.next(event.item);
  }

  public onUnlinkClick(buildingBlock: BuildingBlock): void {
    this.buildingBlockApiService.unlinkBlockFromCase(
      this._documentDefinitionName$.getValue() ?? '',
      buildingBlock.id
    );
  }
}
