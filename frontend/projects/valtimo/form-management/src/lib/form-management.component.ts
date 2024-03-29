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
import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {Pagination} from '@valtimo/components';
import {take} from 'rxjs';
import {Upload16} from '@carbon/icons';

import {FormDefinition} from './models';
import {FormManagementService} from './services';
import {IconService} from 'carbon-components-angular';

@Component({
  selector: 'valtimo-form-management',
  templateUrl: './form-management.component.html',
  styleUrls: ['./form-management.component.scss'],
})
export class FormManagementComponent {
  public formDefinitions: FormDefinition[] = [];
  public formDefinitionFields: any[] = [
    {key: 'name', label: 'Form name'},
    {key: 'readOnly', label: 'Read-only'},
  ];

  public pagination: Pagination = {
    collectionSize: 0,
    page: 1,
    size: 10,
  };

  constructor(
    private formManagementService: FormManagementService,
    private iconService: IconService,
    private router: Router
  ) {
    this.iconService.registerAll([Upload16]);
  }

  public paginationClicked(page: number): void {
    this.pagination.page = page;
    this.loadFormDefinitions();
  }

  public paginationSet(size: number): void {
    this.pagination.size = size;
    this.pagination.page = 1;
    this.loadFormDefinitions();
  }

  public loadFormDefinitions(searchTerm?: string): void {
    const params = {page: this.pagination.page - 1, size: this.pagination.size};
    if (searchTerm) {
      params['searchTerm'] = searchTerm;
    }

    this.formManagementService
      .queryFormDefinitions(params)
      .pipe(take(1))
      .subscribe(results => {
        this.pagination = {
          ...this.pagination,
          collectionSize: results.body.totalElements,
        };
        this.formDefinitions = results.body.content;
      });
  }

  public editFormDefinition(formDefinition: FormDefinition): void {
    this.router.navigate(['/form-management/edit', formDefinition.id]);
  }

  public searchTermEntered(searchTerm: string): void {
    this.loadFormDefinitions(searchTerm);
  }
}
