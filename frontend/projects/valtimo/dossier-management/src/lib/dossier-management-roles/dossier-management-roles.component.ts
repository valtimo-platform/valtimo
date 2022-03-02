/*
 * Copyright 2015-2022 Ritense BV, the Netherlands.
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
import {Component, Input, OnInit} from '@angular/core';
import {IDropdownSettings} from 'ng-multiselect-dropdown';
import {BehaviorSubject} from 'rxjs';
import {Authority, AuthorityService} from '@valtimo/authority';
import {DocumentService} from '@valtimo/document';
import {AlertService} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';
import {isEqual} from 'lodash';

@Component({
  selector: 'valtimo-dossier-management-roles',
  templateUrl: './dossier-management-roles.component.html',
  styleUrls: ['./dossier-management-roles.component.scss'],
})
export class DossierManagementRolesComponent implements OnInit {
  @Input() public documentDefinitionName: string;
  public dropdownSettings: IDropdownSettings = {
    singleSelection: false,
    idField: 'name',
    textField: 'name',
    selectAllText: 'Select All',
    unSelectAllText: 'UnSelect All',
    itemsShowLimit: 3,
    enableCheckAll: true,
    allowSearchFilter: true,
  };
  public roles = new BehaviorSubject<Array<Authority>>(undefined);
  public preSelectedItems = new BehaviorSubject<Array<String>>(undefined);

  constructor(
    private readonly authorityService: AuthorityService,
    private readonly documentService: DocumentService,
    private readonly alertService: AlertService,
    private readonly translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadAllRoles();
  }

  loadAllRoles(): void {
    this.authorityService.query().subscribe(result => {
      this.roles.next(result.body);
      this.loadDocumentRoles();
    });
  }

  loadDocumentRoles(): void {
    if (this.documentDefinitionName) {
      this.documentService.getDocumentRoles(this.documentDefinitionName).subscribe(
        result => {
          this.preSelectedItems.next(result);
        },
        err => {
          this.alertService.warning(
            this.translateService.instant(
              'dossierManagement.roles.messages.unsuccessfullyRetrievedRoles'
            )
          );
        }
      );
    }
  }

  onSelectedItems(data: any): void {
    const roles = this.returnArrayOfString(data);

    if (isEqual(roles, this.preSelectedItems.value)) {
      return;
    }
    this.documentService.modifyDocumentRoles(this.documentDefinitionName, roles).subscribe(
      () => {
        this.alertService.success(
          this.translateService.instant('dossierManagement.roles.messages.successfullyStored')
        );
        this.preSelectedItems.next(roles);
      },
      err => {
        this.alertService.error(
          this.translateService.instant('dossierManagement.roles.messages.unsuccessfullyStored')
        );
      }
    );
  }

  /**
   * The data could be either an array of string (i.e. ["ROLE_ADMIN", "ROLE_DEVELOPER"]
   * or an array of object with name parameters (i.e. [{"name": "ROLE_ADMIN"},{"name":"ROLE_DEVELOPER}]
   *
   * This method will always make sure an array of strings is returned
   */
  private returnArrayOfString(data): Array<String> {
    return data.map(el => {
      if (typeof el === 'string') {
        return el;
      }

      return el.name;
    });
  }
}
