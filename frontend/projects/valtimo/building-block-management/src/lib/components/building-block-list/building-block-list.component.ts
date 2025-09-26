import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {BuildingBlockApiService, BuildingBlock} from '@valtimo/building-block-resources';
import {CarbonListModule, ColumnConfig} from '@valtimo/components';
import {BehaviorSubject, debounceTime, delay, tap} from 'rxjs';
import {Router} from '@angular/router';

@Component({
  templateUrl: './building-block-list.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CarbonListModule],
})
export class BuildingBlockListComponent {
  public readonly buildingBlocks$ = this.buildingBlockApiService.buildingBlocks$.pipe(
    delay(500),
    tap(() => this.loading$.next(false))
  );
  public readonly loading$ = new BehaviorSubject<boolean>(true);

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'id',
      label: 'Id',
    },
    {
      key: 'name',
      label: 'Name',
    },
    {
      key: 'description',
      label: 'Description',
    },
  ];

  constructor(
    private readonly buildingBlockApiService: BuildingBlockApiService,
    private readonly router: Router
  ) {}

  public onRowClicked(block: BuildingBlock): void {
    this.router.navigate([`/building-block-management/${block.id}`]);
  }
}
