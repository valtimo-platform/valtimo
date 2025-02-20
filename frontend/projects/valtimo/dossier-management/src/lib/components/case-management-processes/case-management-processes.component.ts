import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {PendingChangesComponent} from '@valtimo/components';
import {ButtonModule} from 'carbon-components-angular';

@Component({
  selector: 'valtimo-case-management-processes',
  templateUrl: './case-management-processes.component.html',
  styleUrl: './case-management-processes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ButtonModule],
})
export class CaseManagementProcessesComponent extends PendingChangesComponent {
  public onActivatePendingChanges(): void {
    this.pendingChanges = true;
  }

  public onDeactivatePendingChanges(): void {
    this.pendingChanges = false;
  }
}
