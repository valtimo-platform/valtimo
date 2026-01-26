/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {Component, signal} from '@angular/core';
import {Router} from '@angular/router';
import {ChoiceField, ChoiceFieldService, Pagination} from '@valtimo/components';
import { TEST_IDS } from '@valtimo/shared';

@Component({
  standalone: false,
  selector: 'valtimo-choice-field-list',
  templateUrl: './choice-field-list.component.html',
})
export class ChoiceFieldListComponent {
  readonly TEST_IDS = TEST_IDS;

  public choiceFields: Array<ChoiceField> = [];
  public readonly $pagination = signal<Pagination>({
    collectionSize: 0,
    page: 1,
    size: 10,
  });
  public pageParam = 0;
  public fields: Array<any> = [
    {
      key: 'id',
      label: 'ID',
    },
    {
      key: 'keyName',
      label: 'Key',
    },
    {
      key: 'title',
      label: 'Title',
    },
  ];

  constructor(
    private router: Router,
    private service: ChoiceFieldService
  ) {}

  public paginationSet(size: string): void {
    this.$pagination.update(pagination => ({
      ...pagination,
      size: +size,
    }));
    this.initData();
  }

  public rowClick(data): void {
    this.router.navigate([`/choice-fields/field/${encodeURI(data.id)}`]);
  }

  public paginationClicked(page: number): void {
    this.pageParam = page - 1;
    this.initData();
  }

  private initData(): void {
    this.service
      .queryPage({page: this.pageParam, size: this.$pagination().size})
      .subscribe(results => {
        this.$pagination.update(pagination => ({
          ...pagination,
          page: this.pageParam + 1,
          collectionSize: results.totalElements,
        }));
        this.choiceFields = results.content;
      });
  }
}
