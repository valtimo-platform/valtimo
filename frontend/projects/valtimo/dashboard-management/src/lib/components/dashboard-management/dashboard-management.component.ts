import {ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation} from '@angular/core';
import {AbstractControl, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {CarbonTableConfig, ColumnType, createCarbonTableConfig} from '@valtimo/components';
import {BehaviorSubject, delay, finalize, Observable, of, startWith} from 'rxjs';
import {DashboardItem} from '../../models';
import {DashboardManagementService} from '../../services/dashboard-management.service';

@Component({
  templateUrl: './dashboard-management.component.html',
  styleUrls: ['./dashboard-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class DashboardManagementComponent implements OnInit {
  public readonly deleteRowKey$: BehaviorSubject<string> = new BehaviorSubject('');
  public readonly openModal$: BehaviorSubject<boolean> = new BehaviorSubject(false);
  public readonly showDeleteModal$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  public readonly tableData$: Observable<{items: DashboardItem[] | null; loading: boolean}> =
    this.dashboardManagementService.dashboards$;
  public tableConfig: CarbonTableConfig = createCarbonTableConfig({
    fields: [
      {
        columnType: ColumnType.TEXT,
        fieldName: 'title',
        translationKey: 'dashboardManagement.name',
      },
      {
        columnType: ColumnType.TEXT,
        fieldName: 'description',
        translationKey: 'dashboardManagement.description',
      },
      {
        columnType: ColumnType.TEXT,
        fieldName: 'key',
        translationKey: 'dashboardManagement.key',
      },
      {
        actions: [
          {
            actionName: 'Delete',
            callback: this.deleteDashboard.bind(this),
            type: 'danger',
          },
        ],
        className: 'valtimo-dashboard-management__actions',
        columnType: ColumnType.ACTION,
        translationKey: '',
        fieldName: '',
        sortable: false,
      },
    ],
  });
  public form: FormGroup;

  constructor(
    private readonly dashboardManagementService: DashboardManagementService,
    private readonly fb: FormBuilder
  ) {}

  public ngOnInit(): void {
    this.dashboardManagementService.loadData();
    this.form = this.fb.group({
      description: this.fb.control(''),
      title: this.fb.control('', [Validators.required]),
    });
  }

  public closeModal(): void {
    this.openModal$.next(false);
    this.form.reset();
  }

  public createDashboard(): void {
    const control: AbstractControl | null = this.form.get('title');
    if (!control || !control.valid) {
      return;
    }

    const newDashboard: DashboardItem = this.form.getRawValue();
    this.dashboardManagementService.dispatchAction(
      this.dashboardManagementService.createDashboard(newDashboard).pipe(
        finalize(() => {
          this.closeModal();
        })
      )
    );
  }

  public onConfirmEvent(dashboardKey: string): void {
    this.dashboardManagementService.dispatchAction(
      this.dashboardManagementService.deleteDashboard(dashboardKey).pipe(
        finalize(() => {
          this.closeModal();
        })
      )
    );
  }

  public openModal(): void {
    this.openModal$.next(true);
  }

  private deleteDashboard(dashboard: DashboardItem): void {
    this.deleteRowKey$.next(dashboard.key);
    this.showDeleteModal$.next(true);
  }
}
