/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation} from '@angular/core';
import {AbstractControl, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {ActionItem, ColumnConfig, ViewType} from '@valtimo/components';
import {BehaviorSubject, finalize, Observable} from 'rxjs';
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
  public fields: ColumnConfig[] = [
    {
      viewType: ViewType.TEXT,
      key: 'title',
      label: 'dashboardManagement.name',
    },
    {
      viewType: ViewType.TEXT,
      key: 'description',
      label: 'dashboardManagement.description',
    },
    {
      viewType: ViewType.TEXT,
      key: 'key',
      label: 'dashboardManagement.key',
    },
  ];
  public readonly actionItems: ActionItem[] = [
    {
      label: 'interface.delete',
      callback: this.deleteDashboard.bind(this),
      type: 'danger',
    },
  ];
  public form: FormGroup;

  constructor(
    private readonly dashboardManagementService: DashboardManagementService,
    private readonly fb: FormBuilder,
    private readonly router: Router
  ) {}

  public ngOnInit(): void {
    this.dashboardManagementService.loadData();
    this.form = this.fb.group({
      description: this.fb.control('', [Validators.required]),
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

  public getControlInvalid(controlKey: string): boolean {
    const control: AbstractControl | null = this.form.get(controlKey);

    if (!control) {
      return true;
    }

    return !control.valid && !control.pristine;
  }

  public openModal(): void {
    this.openModal$.next(true);
  }

  public onRowClick(item: DashboardItem): void {
    this.router.navigate([`/dashboard-management/${item.key}`]);
  }

  private deleteDashboard(dashboard: DashboardItem): void {
    this.deleteRowKey$.next(dashboard.key);
    this.showDeleteModal$.next(true);
  }
}
