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
import {FormDefinition} from '@valtimo/contract';
import {FormManagementService} from '../form-management.service';
import {Router} from '@angular/router';

@Component({
  selector: 'valtimo-form-management-list',
  templateUrl: './form-management-list.component.html',
  styleUrls: ['./form-management-list.component.scss']
})
export class FormManagementListComponent implements OnInit {

  public formDefinitions: FormDefinition[] = [];
  public formDefinitionFields: any[] = [
    {key: 'name', label: 'Name'},
    {key: 'readOnly', label: 'Read-only'}
  ];
  public pagination = {
    collectionSize: 0,
    page: 1,
    size: 10,
    maxPaginationItemSize: 5
  };
  public pageParam = 0;

  public paginationClicked(page) {
    this.pageParam = page - 1;
    this.loadFormDefinitions();
  }

  constructor(
    private formManagementService: FormManagementService,
    private router: Router
  ) {
  }

  ngOnInit() {
  }

  paginationSet() {
    this.loadFormDefinitions();
  }

  loadFormDefinitions(searchTerm?: string) {
    const params = {page: this.pageParam, size: this.pagination.size};
    if (searchTerm) {
      params['searchTerm'] = searchTerm;
    }
    this.formManagementService.queryFormDefinitions(params).subscribe((results) => {
      this.pagination.collectionSize = results.body.totalElements;
      this.formDefinitions = results.body.content;
    });
  }

  editFormDefinition(formDefinition: FormDefinition) {
    this.router.navigate(['/form-management/edit', formDefinition.id]);
  }

  searchTermEntered(searchTerm: string) {
    this.loadFormDefinitions(searchTerm);
  }

}
