import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {BuildingBlockApiService} from '../../services';
import {CarbonListModule, ColumnConfig} from '@valtimo/components';

@Component({
  selector: 'valtimo-building-block-list',
  templateUrl: './building-block-list.component.html',
  styleUrl: './building-block-list.component.scss',
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

  constructor(private readonly buildingBlockApiService: BuildingBlockApiService) {}
}
