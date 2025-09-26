import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {
  ProcessManagementBuilderComponent,
  ProcessManagementModule,
} from '@valtimo/process-management';
import {BehaviorSubject} from 'rxjs';

@Component({
  selector: 'valtimo-dossier-management-process-manager',
  templateUrl: './dossier-manager-process-manager.component.html',
  styleUrl: './dossier-manager-process-manager.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ProcessManagementModule, ProcessManagementBuilderComponent],
})
export class DossierManagementProcessManagerComponent {
  public readonly processKey$ = new BehaviorSubject<string | 'create' | null>(null);

  public onAddProcess(): void {
    this.processKey$.next('create');
  }

  public onEditProcess(processKey: string): void {
    this.processKey$.next(processKey);
  }
}
