import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy} from '@angular/core';
import {CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {CaseChangeLogsService} from '../../services';
import {Observable, combineLatest, map} from 'rxjs';
import {CaseChangeLog} from '../../models';
import {ButtonModule} from 'carbon-components-angular';

@Component({
  selector: 'valtimo-dossier-management-change-logs',
  templateUrl: './dossier-management-change-logs.component.html',
  styleUrl: './dossier-management-change-logs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, CarbonListModule, ButtonModule],
})
export class DossierManagementChangeLogsComponent implements OnDestroy {
  public readonly caseChangeLogs$: Observable<(CaseChangeLog & {fullName: string})[] | null> =
    combineLatest([
      this.caseChangeLogsService.activeLogSearch$,
      this.caseChangeLogsService.caseChangeLogs$,
    ]).pipe(
      map(([activeLogSearch, caseChangeLogs]) =>
        !!caseChangeLogs
          ? this.mapLogs(
              !!activeLogSearch
                ? caseChangeLogs.filter((log: CaseChangeLog) => log.user.id === activeLogSearch)
                : caseChangeLogs
            )
          : null
      )
    );
  public readonly CASE_CHANGE_LOGS_FIELDS: ColumnConfig[] = [
    {
      key: 'fullName',
      label: 'User name',
      viewType: ViewType.TEXT,
    },
    {
      key: 'timestamp',
      label: 'Timestamp',
      viewType: ViewType.DATE_TIME,
    },
    {
      key: 'message',
      label: 'Message',
      viewType: ViewType.TEXT,
    },
  ];

  constructor(private readonly caseChangeLogsService: CaseChangeLogsService) {}

  public ngOnDestroy(): void {
    this.onClearFilterClick();
  }

  public onClearFilterClick(): void {
    this.caseChangeLogsService.activeLogSearch$.next(null);
  }

  private mapLogs(logs: CaseChangeLog[]): (CaseChangeLog & {fullName: string})[] {
    return logs.map((changeLog: CaseChangeLog) => ({
      ...changeLog,
      fullName: `${changeLog.user.firstName} ${changeLog.user.lastName}`,
    }));
  }
}
