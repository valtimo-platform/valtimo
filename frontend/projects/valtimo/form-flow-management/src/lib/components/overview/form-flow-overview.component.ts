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
import {CarbonListComponent, ColumnConfig, ViewType} from '@valtimo/components';
import {BehaviorSubject, finalize, Observable} from 'rxjs';
import {FormFlowDefinition, ListFormFlowDefinition} from '../../models';
import {FormFlowService} from '../../services/form-flow.service';

@Component({
  templateUrl: './form-flow-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormFlowOverviewComponent implements OnInit {
  @ViewChild(CarbonListComponent) carbonList: CarbonListComponent;

  public fields: ColumnConfig[] = [
    {
      viewType: ViewType.TEXT,
      key: 'key',
      label: 'formFlow.key',
    },
    {
      viewType: ViewType.TEXT,
      key: 'versions.0',
      label: 'formFlow.version',
    },
    {
      viewType: ViewType.BOOLEAN,
      key: 'readOnly',
      label: 'formFlow.readOnly',
    },
  ];

  public readonly formFlowDefinitions$: Observable<ListFormFlowDefinition[]> =
    this.formFlowService.formFlows$;
  public readonly loading$: Observable<boolean> = this.formFlowService.loading$;
  public readonly showAddModal$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly formFlowService: FormFlowService,
    private readonly router: Router
  ) {}

  public ngOnInit(): void {
    this.formFlowService.loadFormFlows();
  }

  public openAddModal(): void {
    this.showAddModal$.next(true);
  }

  public onAdd(data: FormFlowDefinition | null): void {
    this.showAddModal$.next(false);

    if (!data) {
      return;
    }

    this.formFlowService.dispatchAction(
      this.formFlowService.addFormFlow(data).pipe(
        finalize(() => {
          this.showAddModal$.next(false);
        })
      )
    );
  }

  public onRowClick(formFlow: ListFormFlowDefinition): void {
    this.router.navigate([`/form-flow-management/${formFlow.key}`]);
  }
}
