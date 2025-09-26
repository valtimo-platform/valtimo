import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {FormFlowManagementModule} from '@valtimo/form-flow-management';
import {BehaviorSubject} from 'rxjs';
import {BuildingBlockService} from '../../../services';

@Component({
  selector: 'valtimo-building-block-form-flows',
  templateUrl: './building-block-form-flows.component.html',
  styleUrl: './building-block-form-flows.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormFlowManagementModule],
})
export class BuildingBlockFormFlowsComponent {
  public readonly formFlowKey$ = new BehaviorSubject<string | null>(null);
  public readonly backButtonActive$ = this.buildingBlockService.backButtonActive$;

  constructor(private readonly buildingBlockService: BuildingBlockService) {}

  public onEditFormFlow(formFlowKey: string): void {
    this.formFlowKey$.next(formFlowKey);
    this.buildingBlockService.viewChanged();
  }

  public onFormFlowUpdate(): void {
    this.buildingBlockService.backButtonClick();
    this.formFlowKey$.next(null);
  }
}
