/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {ScriptService} from '../../services/script.service';
import {Script} from "../../models";

@Component({
  templateUrl: './script-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScriptOverviewComponent implements OnInit {
  @ViewChild(CarbonListComponent) carbonList: CarbonListComponent;

  public fields: ColumnConfig[] = [
    {
      viewType: ViewType.TEXT,
      key: 'key',
      label: 'script.key',
    },
  ];

  public readonly scripts$: Observable<Script[]> = this.scriptService.scripts$;
  public readonly loading$: Observable<boolean> = this.scriptService.loading$;
  public readonly skeleton$ = new BehaviorSubject<boolean>(false);
  public readonly showAddModal$ = new BehaviorSubject<boolean>(false);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly selectedRowKeys$ = new BehaviorSubject<Array<string>>([]);

  constructor(
    private readonly scriptService: ScriptService,
    private readonly router: Router
  ) {}

  public ngOnInit(): void {
    this.scriptService.loadScripts();
  }

  public openAddModal(): void {
    this.showAddModal$.next(true);
  }

  public onAdd(data: Script | null): void {
    this.showAddModal$.next(false);

    if (!data) {
      return;
    }

    this.scriptService.dispatchAction(
      this.scriptService.addScript(data).pipe(
        finalize(() => {
          this.showAddModal$.next(false);
        })
      )
    );
  }

  public showDeleteModal(): void {
    this.setSelectedScriptKeys();
    this.showDeleteModal$.next(true);
  }

  public onDelete(scripts: Array<string>): void {
    this.enableSkeleton();

    this.scriptService.dispatchAction(
      this.scriptService.deleteScripts({scripts}).pipe(
        finalize(() => {
          this.disableSkeleton();
        })
      )
    );
  }

  public onRowClick(script: Script): void {
    this.router.navigate([`/script/${script.key}`]);
  }

  private enableSkeleton(): void {
    this.skeleton$.next(true);
  }

  private disableSkeleton(): void {
    this.skeleton$.next(false);
  }

  private setSelectedScriptKeys(): void {
    this.selectedRowKeys$.next(this.carbonList.selectedItems.map((script: Script) => script.key));
  }
}
