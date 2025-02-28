import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {PendingChangesComponent} from '@valtimo/components';
import {ProcessManagementListComponent} from '@valtimo/process-management';
import {ButtonModule} from 'carbon-components-angular';
import {map} from 'rxjs';

@Component({
  templateUrl: './case-management-processes.component.html',
  styleUrl: './case-management-processes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ButtonModule, ProcessManagementListComponent],
})
export class CaseManagementProcessesComponent extends PendingChangesComponent {
  public readonly params$ = this.route.parent?.params.pipe(
    map(params => ({
      documentDefinitionKey: params['name'],
      versionTag: '1.0.0-test',
    }))
  );

  constructor(private readonly route: ActivatedRoute) {
    super();
  }

  public onActivatePendingChanges(): void {
    this.pendingChanges = true;
  }

  public onDeactivatePendingChanges(): void {
    this.pendingChanges = false;
  }
}
