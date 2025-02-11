import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ActivatedRoute, ParamMap, Params} from '@angular/router';
import {BehaviorSubject, Observable, switchMap, tap} from 'rxjs';
import {BUILDING_BLOCK_TAB, BuildingBlock} from '../../models';
import {BuildingBlockApiService, BuildingBlockService} from '../../services';
import {PageTitleService} from '@valtimo/components';
import {ButtonModule, TabsModule} from 'carbon-components-angular';
import {BUILDING_BLOCK_TABS} from '../building-block-tabs';

@Component({
  templateUrl: './building-block-details.component.html',
  styleUrl: './building-block-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, TabsModule, ButtonModule, ...BUILDING_BLOCK_TABS],
})
export class BuildingBlockDetails implements OnDestroy {
  public readonly activeTab$ = new BehaviorSubject<BUILDING_BLOCK_TAB>(
    BUILDING_BLOCK_TAB.PROCESSES
  );
  public readonly buildingBlock$: Observable<BuildingBlock | null> = this.route.params.pipe(
    switchMap((params: Params) => this.buildingBlockApiService.getBuildingBlock(params['id'])),
    tap((block: BuildingBlock | null) => {
      this.pageTitleService.setCustomPageTitle(block?.name ?? '');
    })
  );

  public readonly backButtonActive$ = this.buildingBlockService.backButtonActive$;
  public readonly BUILDING_BLOCK_TAB = BUILDING_BLOCK_TAB;

  constructor(
    private readonly buildingBlockService: BuildingBlockService,
    private readonly buildingBlockApiService: BuildingBlockApiService,
    private readonly pageTitleService: PageTitleService,
    private readonly route: ActivatedRoute
  ) {
    this.pageTitleService.disableReset();
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
  }

  public onTabSelected(tab: BUILDING_BLOCK_TAB): void {
    this.activeTab$.next(tab);
  }

  public onBackButtonClicked(): void {
    this.buildingBlockService.backButtonClick();
  }
}
