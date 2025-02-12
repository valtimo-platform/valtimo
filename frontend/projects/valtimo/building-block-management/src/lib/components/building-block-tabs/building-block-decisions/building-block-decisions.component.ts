import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {DecisionModule} from '@valtimo/decision';
import {BehaviorSubject, map} from 'rxjs';
import {BuildingBlockService} from '../../../services';
import {ConfigService, ValtimoConfigFeatureToggles} from '@valtimo/config';

@Component({
  selector: 'valtimo-building-block-decisions',
  templateUrl: './building-block-decisions.component.html',
  styleUrl: './building-block-decisions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, DecisionModule],
})
export class BuildingBlockDecisionsComponent {
  public readonly backButtonActive$ = this.buildingBlockService.backButtonActive$;
  public readonly decisionId$ = new BehaviorSubject<string | null>(null);

  public experimentalEditing$ = this.configService.featureToggles$.pipe(
    map(
      (toggles: ValtimoConfigFeatureToggles | undefined) => toggles?.experimentalDmnEditing ?? false
    )
  );

  constructor(
    private readonly buildingBlockService: BuildingBlockService,
    private readonly configService: ConfigService
  ) {}

  public onEditDecision(decisionId: string): void {
    console.log({decisionId});
    this.decisionId$.next(decisionId);
    this.buildingBlockService.viewChanged();
  }
}
