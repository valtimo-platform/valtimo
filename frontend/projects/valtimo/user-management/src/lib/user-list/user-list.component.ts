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

import {Component} from '@angular/core';
import {UserManagementService} from '../user-management.service';
import {User, Page} from '@valtimo/contract';
import {Router} from '@angular/router';

@Component({
  selector: 'valtimo-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent {

  public users: Array<User> = [];
  public pagination = {
    collectionSize: 0,
    page: 1,
    size: 10,
    maxPaginationItemSize: 5
  };
  public fields: Array<any> = [{
    key: 'fullName',
    label: 'Name'
  }
    , {
      key: 'email',
      label: 'Email'
    }
    , {
      key: 'verified',
      label: 'Email verified'
    }
    , {
      key: 'status',
      label: 'Status'
    }];
  private searchTerm = '';

  constructor(
    private router: Router,
    private service: UserManagementService
  ) {
  }

  paginationSet() {
    this.pagination.page = 1;
    this.initData();
  }

  searchTermEntered(searchTerm: string) {
    this.searchTerm = searchTerm;
    this.pagination.page = 1;
    this.initData();
  }

  private initData() {
    const params = {page: this.pagination.page - 1, size: this.pagination.size};
    if (this.searchTerm !== '') {
      params['searchTerm'] = this.searchTerm;
    }
    this.service.query(params).subscribe((usersPage: Page<User>) => {
      this.pagination.collectionSize = usersPage.totalElements;
      this.users = usersPage.content;
      this.users.forEach(user => {
        user.verified = user.emailVerified ? 'Yes' : 'No';
        user.status = user.activated ? 'Activated' : 'Blocked';
      });
    });
  }

  public rowClick(data) {
    this.router.navigate([`/users/user/${encodeURI(data.id)}`]);
  }

  public paginationClicked(page) {
    this.initData();
  }

}
