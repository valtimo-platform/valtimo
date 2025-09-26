import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {
  ProcessManagementBuilderComponent,
  ProcessManagementModule,
} from '@valtimo/process-management';
import {BehaviorSubject} from 'rxjs';
import {BuildingBlockService} from '../../../services';

@Component({
  selector: 'valtimo-building-block-processes',
  templateUrl: './building-block-processes.component.html',
  styleUrl: './building-block-processes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ProcessManagementModule, ProcessManagementBuilderComponent],
})
export class BuildingBlockProcessesComponent {
  public readonly backButtonActive$ = this.buildingBlockService.backButtonActive$;
  public readonly processKey$ = new BehaviorSubject<string | 'create' | null>(null);

  constructor(private readonly buildingBlockService: BuildingBlockService) {}

  public onAddProcess(): void {
    this.processKey$.next('create');
    this.buildingBlockService.viewChanged();
  }

  public onEditProcess(processKey: string): void {
    this.processKey$.next(processKey);
    this.buildingBlockService.viewChanged();
  }

  public onProcessUpdated(): void {
    this.processKey$.next(null);
    this.buildingBlockService.backButtonClick();
  }
}
