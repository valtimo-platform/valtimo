import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {ActivatedRoute, Params} from '@angular/router';
import {BuildingBlock, BuildingBlockApiService} from '@valtimo/building-block-resources';
import {DossierManagementModule} from '@valtimo/dossier-management';
import {map, Observable, switchMap} from 'rxjs';

@Component({
  selector: 'valtimo-building-block-cases',
  templateUrl: './building-block-cases.component.html',
  styleUrl: './building-block-cases.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, DossierManagementModule],
})
export class BuildingBlockCasesComponent {
  public filterIds$: Observable<string[]> = this.route.params.pipe(
    switchMap((params: Params) => this.buildingBlockApiService.getBuildingBlock(params['id'])),
    map((buildingBlock: BuildingBlock | null) => buildingBlock?.linkedCaseIds ?? [])
  );

  constructor(
    private readonly buildingBlockApiService: BuildingBlockApiService,
    private readonly route: ActivatedRoute
  ) {}
}
