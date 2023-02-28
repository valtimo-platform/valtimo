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

import {Component, OnInit} from '@angular/core';
import {Authority} from '../models';
import {AuthorityService} from '../authority.service';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {map} from 'rxjs/operators';

@Component({
  selector: 'valtimo-authority-list',
  templateUrl: './authority-list.component.html',
  styleUrls: ['./authority-list.component.css'],
})
export class AuthorityListComponent implements OnInit {
  private authorities$ = new BehaviorSubject<Array<Authority>>([]);
  public translatedAuthorities$ = combineLatest([
    this.authorities$,
    this.translateService.stream('entitlement.hasSystemAuthority'),
    this.translateService.stream('entitlement.noSystemAuthority'),
  ]).pipe(
    map(([authorities, hasAuthorityString, noAuthorityString]) =>
      authorities.map(authority => ({
        ...authority,
        systemAuthorityDisplayString: authority.systemAuthority
          ? hasAuthorityString
          : noAuthorityString,
      }))
    )
  );

  readonly loading$ = new BehaviorSubject<boolean>(true);

  public pagination = {
    collectionSize: 0,
    page: 1,
    size: 10,
    maxPaginationItemSize: 5,
  };

  public pageParam = 0;

  public fields$: Observable<Array<{key: string; label: string}>> = combineLatest([
    this.translateService.stream('entitlement.name'),
    this.translateService.stream('entitlement.systemAuthority'),
  ]).pipe(
    map(([nameString, systemAuthorityString]) => [
      {
        key: 'name',
        label: nameString,
      },
      {
        key: 'systemAuthorityDisplayString',
        label: systemAuthorityString,
      },
    ])
  );

  constructor(
    private readonly router: Router,
    private readonly service: AuthorityService,
    private readonly translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.initData();
  }

  paginationSet() {
    this.initData();
  }

  private initData() {
    this.service.query({page: this.pageParam, size: this.pagination.size}).subscribe(results => {
      this.pagination.collectionSize = results.headers.get('x-total-count');
      this.authorities$.next(results?.body);
      this.loading$.next(false);
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
