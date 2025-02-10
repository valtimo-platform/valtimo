import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {BuildingBlockApiService} from '../../services';
import {CarbonListModule, ColumnConfig} from '@valtimo/components';
import {BehaviorSubject, debounceTime, tap} from 'rxjs';
import {Router} from '@angular/router';
import {BuildingBlock} from '../../models';

@Component({
  templateUrl: './building-block-list.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CarbonListModule],
})
export class BuildingBlockList {
  public readonly buildingBlocks$ = this.buildingBlockApiService.buildingBlocks$;

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
    console.log('in here');
  }
}
