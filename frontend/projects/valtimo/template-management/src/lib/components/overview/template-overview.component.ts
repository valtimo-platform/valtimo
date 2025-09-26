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
import {CarbonListComponent, ColumnConfig, ViewType} from '@valtimo/components';
import {BehaviorSubject, finalize, Observable} from 'rxjs';
import {TemplateService} from '../../services/template.service';
import {TemplateMetadata} from "../../models";

@Component({
  templateUrl: './template-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateOverviewComponent implements OnInit {
  @ViewChild(CarbonListComponent) carbonList: CarbonListComponent;

  public fields: ColumnConfig[] = [
    {
      viewType: ViewType.TEXT,
      key: 'key',
      label: 'template.key',
    },
  ];

  public readonly templates$: Observable<TemplateMetadata[]> = this.templateService.templates$;
  public readonly loading$: Observable<boolean> = this.templateService.loading$;
  public readonly skeleton$ = new BehaviorSubject<boolean>(false);
  public readonly showAddModal$ = new BehaviorSubject<boolean>(false);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly selectedRowKeys$ = new BehaviorSubject<Array<string>>([]);

  constructor(
    private readonly templateService: TemplateService,
    private readonly router: Router
  ) {}

  public ngOnInit(): void {
    this.templateService.loadTemplateList();
  }

  public openAddModal(): void {
    this.showAddModal$.next(true);
  }

  public onAdd(data: TemplateMetadata | null): void {
    this.showAddModal$.next(false);

    if (!data) {
      return;
    }

    this.templateService.dispatchAction(
      this.templateService.addTemplate(data).pipe(
        finalize(() => {
          this.showAddModal$.next(false);
        })
      )
    );
  }

  public showDeleteModal(): void {
    this.setSelectedTemplateKeys();
    this.showDeleteModal$.next(true);
  }

  public onDelete(templates: Array<string>): void {
    this.enableSkeleton();

    this.templateService.dispatchAction(
      this.templateService.deleteTemplates({templates}).pipe(
        finalize(() => {
          this.disableSkeleton();
        })
      )
    );
  }

  public onRowClick(template: TemplateMetadata): void {
    this.router.navigate([`/template/${template.key}`]);
  }

  private enableSkeleton(): void {
    this.skeleton$.next(true);
  }

  private disableSkeleton(): void {
    this.skeleton$.next(false);
  }

  private setSelectedTemplateKeys(): void {
    this.selectedRowKeys$.next(this.carbonList.selectedItems.map((template: TemplateMetadata) => template.key));
  }
}
