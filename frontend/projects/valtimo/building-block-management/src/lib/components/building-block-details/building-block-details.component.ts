import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, OnDestroy} from '@angular/core';
import {ActivatedRoute, ParamMap, Params} from '@angular/router';
import {Observable, switchMap, tap} from 'rxjs';
import {BuildingBlock} from '../../models';
import {BuildingBlockApiService} from '../../services';
import {PageTitleService} from '@valtimo/components';
import {TabsModule} from 'carbon-components-angular';
import {BUILDING_BLOCK_TABS} from '../building-block-tabs';

@Component({
  templateUrl: './building-block-details.component.html',
  styleUrl: './building-block-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, TabsModule, ...BUILDING_BLOCK_TABS],
})
export class BuildingBlockDetails implements OnDestroy {
  public readonly buildingBlock$: Observable<BuildingBlock | null> = this.route.params.pipe(
    switchMap((params: Params) => this.buildingBlockApiService.getBuildingBlock(params['id'])),
    tap((block: BuildingBlock | null) => {
      this.pageTitleService.setCustomPageTitle(block?.name ?? '');
    })
  );

  constructor(
    private readonly buildingBlockApiService: BuildingBlockApiService,
    private readonly pageTitleService: PageTitleService,
    private readonly route: ActivatedRoute
  ) {
    this.pageTitleService.disableReset();
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
  }
}
