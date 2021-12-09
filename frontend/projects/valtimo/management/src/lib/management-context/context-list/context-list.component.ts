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

import {Component, OnInit} from '@angular/core';
import {ContextService} from '@valtimo/context';
import {Context} from '@valtimo/contract';
import {Router} from '@angular/router';

@Component({
  selector: 'valtimo-context-list',
  templateUrl: './context-list.component.html',
  styleUrls: ['./context-list.component.css']
})
export class ContextListComponent implements OnInit {
  public collection: Array<Context> = [];
  public pagination: any = {
    collectionSize: 0,
    page: 1,
    size: 10,
    maxPaginationItemSize: 5
  };
  public pageParam = 0;
  public fields: Array<any> = [
    {key: 'id', label: 'ID'},
    {key: 'name', label: 'Name'}
  ];

  constructor(
    private router: Router,
    private service: ContextService
  ) {
  }

  ngOnInit() {
  }

  paginationSet() {
    this.initData();
  }

  private initData() {
    this.service.query({page: this.pageParam, size: this.pagination.size})
      .subscribe(results => {
        this.pagination.collectionSize = results.headers.get('x-total-count');
        if (results.body) {
          this.collection = results.body;
        }
      });
  }

  public rowClick(data: any) {
    this.router.navigate([`/contexts/detail/${encodeURI(data.id)}`]);
  }

  public paginationClicked(page: number) {
    this.pageParam = page - 1;
    this.initData();
  }

}
