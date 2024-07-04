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
import {ChangeDetectionStrategy, Component, OnInit, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {CARBON_CONSTANTS, CarbonListComponent, ColumnConfig, ViewType} from '@valtimo/components';
import {BehaviorSubject, delay, finalize, Observable, Subject, tap} from 'rxjs';
import {ExportRoleOutput, Role} from '../../models';
import {AccessControlExportService} from '../../services/access-control-export.service';
import {AccessControlService} from '../../services/access-control.service';

@Component({
  templateUrl: './access-control-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessControlOverviewComponent implements OnInit {
  @ViewChild(CarbonListComponent) carbonList: CarbonListComponent;

  public fields: ColumnConfig[] = [
    {
      viewType: ViewType.TEXT,
      key: 'roleKey',
      label: 'accessControl.roles.key',
    },
  ];

  public readonly roles$: Observable<Role[]> = this.accessControlService.roles$;
  public readonly loading$: Observable<boolean> = this.accessControlService.loading$;
  public readonly skeleton$ = new BehaviorSubject<boolean>(false);
  public readonly showAddModal$ = new BehaviorSubject<boolean>(false);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly showExportModal$ = new BehaviorSubject<boolean>(false);
  public readonly selectedRowKeys$ = new BehaviorSubject<Array<string>>([]);
  public readonly resetExportType$ = new Subject<null>();
  public readonly exportDisabled$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly accessControlService: AccessControlService,
    private readonly accessControlExportService: AccessControlExportService,
    private readonly router: Router
  ) {}

  public ngOnInit(): void {
    this.accessControlService.loadRoles();
  }

  public openAddModal(): void {
    this.showAddModal$.next(true);
  }

  public onAdd(data: Role | null): void {
    this.showAddModal$.next(false);

    if (!data) {
      return;
    }

    this.accessControlService.dispatchAction(
      this.accessControlService.addRole(data).pipe(
        finalize(() => {
          this.showAddModal$.next(false);
        })
      )
    );
  }

  public showDeleteModal(): void {
    this.setSelectedRoleKeys();
    this.showDeleteModal$.next(true);
  }

  public showExportModal(): void {
    this.setSelectedRoleKeys();
    this.showExportModal$.next(true);
  }

  public closeExportModal(): void {
    this.showExportModal$.next(false);
  }

  public onDelete(roles: Array<string>): void {
    this.enableSkeleton();

    this.accessControlService.dispatchAction(
      this.accessControlService.deleteRoles({roles}).pipe(
        finalize(() => {
          this.disableSkeleton();
        })
      )
    );
  }

  public onExport(event: ExportRoleOutput): void {
    this.exportDisabled$.next(true);

    this.accessControlExportService
      .exportRoles(event)
      .pipe(
        tap(() => {
          this.resetExportType$.next(null);
        }),
        delay(CARBON_CONSTANTS.modalAnimationMs),
        tap(() => {
          this.exportDisabled$.next(false);
        })
      )
      .subscribe();
  }

  public onRowClick(role: Role): void {
    this.router.navigate([`/access-control/${role.roleKey}`]);
  }

  private enableSkeleton(): void {
    this.skeleton$.next(true);
  }

  private disableSkeleton(): void {
    this.skeleton$.next(false);
  }

  private setSelectedRoleKeys(): void {
    this.selectedRowKeys$.next(this.carbonList.selectedItems.map((role: Role) => role.roleKey));
  }
}
