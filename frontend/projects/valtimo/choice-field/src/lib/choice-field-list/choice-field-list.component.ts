/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChoiceField } from '@valtimo/contract';
import { ChoiceFieldService } from '../choice-field.service';

@Component({
  selector: 'valtimo-choice-field-list',
  templateUrl: './choice-field-list.component.html',
  styleUrls: ['./choice-field-list.component.css']
})
export class ChoiceFieldListComponent implements OnInit {

  public choiceFields: Array<ChoiceField> = [];
  public pagination = {
    collectionSize: 0,
    page: 1,
    size: 10,
    maxPaginationItemSize: 5
  };
  public pageParam = 0;
  public fields: Array<any> = [{
      key: 'id',
      label: 'ID'
    }
    , {
      key: 'keyName',
      label: 'Key'
    }
    , {
      key: 'title',
      label: 'Title'
    }];

  constructor(
    private router: Router,
    private service: ChoiceFieldService
  ) { }

  ngOnInit() {
  }

  paginationSet() {
    this.initData();
  }

  private initData() {
    this.service.query({page: this.pageParam, size: this.pagination.size}).subscribe(results => {
      this.pagination.collectionSize = results.headers.get('x-total-count');
      this.choiceFields = results.body;
    });
  }

  public rowClick(data) {
    this.router.navigate([`/choice-fields/field/${encodeURI(data.id)}`]);
  }

  public paginationClicked(page) {
    this.pageParam = page - 1;
    this.initData();
  }

}
