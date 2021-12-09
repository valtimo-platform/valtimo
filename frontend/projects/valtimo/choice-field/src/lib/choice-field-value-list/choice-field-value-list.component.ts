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
import {FormBuilder, FormGroup} from '@angular/forms';
import {ChoiceField, ChoiceFieldValue} from '@valtimo/contract';
import {ActivatedRoute, Router} from '@angular/router';
import {ChoiceFieldService} from '../choice-field.service';

@Component({
  selector: 'valtimo-choice-field-value-list',
  templateUrl: './choice-field-value-list.component.html',
  styleUrls: ['./choice-field-value-list.component.css']
})
export class ChoiceFieldValueListComponent implements OnInit {

  public id: string;
  public form: FormGroup;
  public choiceField: ChoiceField;
  public choiceFieldValues: Array<ChoiceFieldValue> = [];
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
      key: 'value',
      label: 'Key'
    }
    , {
      key: 'name',
      label: 'Title'
    }
    , {
      key: 'deprecatedDisplayString',
      label: 'Deprecated'
    }
    , {
      key: 'sortOrder',
      label: 'Sequence'
    }];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private service: ChoiceFieldService
  ) {
    const snapshot = this.route.snapshot.paramMap;
    this.id = snapshot.get('id');
  }

  ngOnInit() {
    this.paginationSet();
  }

  paginationSet() {
    this.initData(this.id);
  }

  private initData(id) {
    this.service.get(id).subscribe(result => {
      this.choiceField = result;
      this.service.queryValues(this.choiceField.keyName, {page: this.pageParam, size: this.pagination.size}).subscribe(values => {
        this.pagination.collectionSize = values.headers.get('x-total-count');
        this.choiceFieldValues = values.body;
        this.choiceFieldValues.forEach(choiceFieldValue => {
          choiceFieldValue.deprecatedDisplayString = choiceFieldValue.deprecated ? 'Yes' : 'No';
        });
      });
    });
  }

  public rowClick(data) {
    this.router.navigate([`/choice-fields/field/${data.choiceField.id}/value/${data.id}`]);
  }

  public paginationClicked(page) {
    this.pageParam = page - 1;
    this.initData(this.id);
  }

}
