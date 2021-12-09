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
import {Authority} from '@valtimo/contract';
import {AuthorityService} from '../authority.service';
import {Router} from '@angular/router';

@Component({
  selector: 'valtimo-authority-list',
  templateUrl: './authority-list.component.html',
  styleUrls: ['./authority-list.component.css']
})
export class AuthorityListComponent implements OnInit {

  public authorities: Array<Authority> = [];
  public pagination = {
    collectionSize: 0,
    page: 1,
    size: 10,
    maxPaginationItemSize: 5
  };
  public pageParam = 0;
  public fields: Array<any> = [{
      key: 'name',
      label: 'Name'
    }
    , {
      key: 'systemAuthorityDisplayString',
      label: 'System authority'
    }
    , {
      key: 'hourlyRateDisplayString',
      label: 'Hourly rate'
    }];

  constructor(
    private router: Router,
    private service: AuthorityService
  ) { }

  ngOnInit() {
  }

  paginationSet() {
    this.initData();
  }

  private initData() {
    this.service.query({page: this.pageParam, size: this.pagination.size}).subscribe(results => {
      this.pagination.collectionSize = results.headers.get('x-total-count');
      this.authorities = results.body;
      this.authorities.forEach(authority => {
        authority.hourlyRateDisplayString = authority.hourlyRate.displayString;
        authority.systemAuthorityDisplayString = authority.systemAuthority ? 'Yes' : 'No';
      });
    });
  }

  public rowClick(data) {
    this.router.navigate([`/entitlements/entitlement/${encodeURI(data.name)}`]);
  }

  public paginationClicked(page) {
    this.pageParam = page - 1;
    this.initData();
  }

}
