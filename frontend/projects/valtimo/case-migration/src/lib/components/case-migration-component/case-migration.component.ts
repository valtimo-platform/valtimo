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

import {Component} from '@angular/core';
import {CaseDefinition, DocumentService} from '@valtimo/document';
import {MultiInputValues} from '@valtimo/components';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  shareReplay,
  startWith,
  switchMap,
  take,
} from 'rxjs';
import {ListItem} from 'carbon-components-angular/dropdown';
import {DocumentMigrationConflictRequest, DocumentMigrationPatch, LoadedValue} from '../../models';
import {CaseMigrationService} from '../../services';
import {WatsonHealthStackedMove16} from '@carbon/icons';
import {IconService} from 'carbon-components-angular';
import {GlobalNotificationService} from '@valtimo/shared';
import {TranslateService} from '@ngx-translate/core';

@Component({
  standalone: false,
  selector: 'valtimo-case-migration',
  templateUrl: './case-migration.component.html',
})
export class CaseMigrationComponent {
  public readonly sourceCaseDefinitionKeySelected$ = new BehaviorSubject<string | null>(null);
  public readonly sourceCaseDefinitionVersionTagSelected$ = new BehaviorSubject<string | null>(
    null
  );
  public readonly targetCaseDefinitionKeySelected$ = new BehaviorSubject<string | null>(null);
  public readonly targetCaseDefinitionVersionTagSelected$ = new BehaviorSubject<string | null>(
    null
  );
  public readonly patchItems$ = new BehaviorSubject<MultiInputValues>([]);
  public readonly errors$ = new BehaviorSubject<Array<string> | null>(null);
  public readonly showConfirmationModal$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly documentService: DocumentService,
    private readonly caseMigrationService: CaseMigrationService,
    private readonly iconService: IconService,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([WatsonHealthStackedMove16]);
  }

  public readonly caseDefinitions$: Observable<Array<CaseDefinition>> = this.documentService
    .getCaseDefinitionsManagement({sort: 'name,id.versionTag'})
    .pipe(
      map(caseDefinitionsPage => caseDefinitionsPage.content),
      shareReplay(1)
    );
  public readonly sourceCaseDefinitionKeyItems$: Observable<LoadedValue<Array<ListItem>>> =
    this.caseDefinitions$.pipe(
      map(caseDefinitions => [
        ...new Map(caseDefinitions.map(item => [item.caseDefinitionKey, item])).values(),
      ]),
      map(caseDefinitions =>
        caseDefinitions.map(
          caseDefinition =>
            ({
              caseDefinitionKey: caseDefinition.caseDefinitionKey,
              content: caseDefinition.name,
              selected: false,
            }) as ListItem
        )
      ),
      map(items => ({
        value: items,
        isLoading: false,
      })),
      startWith({isLoading: true})
    );
  public readonly sourceCaseDefinitionVersionTagItems$: Observable<Array<ListItem>> = combineLatest(
    [this.sourceCaseDefinitionKeySelected$, this.caseDefinitions$]
  ).pipe(
    map(([sourceCaseDefinitionKeySelected, caseDefinitions]) =>
      caseDefinitions.filter(
        caseDefinition => caseDefinition.caseDefinitionKey === sourceCaseDefinitionKeySelected
      )
    ),
    map(caseDefinitions =>
      caseDefinitions.map(caseDefinition => caseDefinition.caseDefinitionVersionTag)
    ),
    map(versions =>
      versions.map(
        version =>
          ({
            caseDefinitionVersionTag: version,
            content: version.toString(),
            selected: false,
          }) as ListItem
      )
    )
  );
  public readonly targetCaseDefinitionKeyItems$: Observable<LoadedValue<Array<ListItem>>> =
    this.caseDefinitions$.pipe(
      map(caseDefinitions => [
        ...new Map(caseDefinitions.map(item => [item.caseDefinitionKey, item])).values(),
      ]),
      map(caseDefinitions =>
        caseDefinitions.map(
          caseDefinition =>
            ({
              caseDefinitionKey: caseDefinition.caseDefinitionKey,
              content: caseDefinition.name,
              selected: false,
            }) as ListItem
        )
      ),
      map(items => ({
        value: items,
        isLoading: false,
      })),
      startWith({isLoading: true})
    );
  public readonly targetCaseDefinitionVersionTagItems$: Observable<Array<ListItem>> = combineLatest(
    [this.targetCaseDefinitionKeySelected$, this.caseDefinitions$]
  ).pipe(
    map(([targetCaseDefinitionKeySelected, caseDefinitions]) =>
      caseDefinitions.filter(
        caseDefinition => caseDefinition.caseDefinitionKey === targetCaseDefinitionKeySelected
      )
    ),
    map(caseDefinitions =>
      caseDefinitions.map(caseDefinition => caseDefinition.caseDefinitionVersionTag)
    ),
    map(versions =>
      versions.map(
        version =>
          ({
            caseDefinitionVersionTag: version,
            content: version.toString(),
            selected: false,
          }) as ListItem
      )
    )
  );
  public readonly patches$: Observable<Array<DocumentMigrationPatch>> = this.patchItems$.pipe(
    map(patchItems =>
      patchItems.map(
        patchItem =>
          ({
            source: patchItem.key,
            target: patchItem.value,
          }) as DocumentMigrationPatch
      )
    )
  );

  mappingValueChange(patches: MultiInputValues): void {
    this.patchItems$.next(patches);
  }

  checkPatches() {
    this.errors$.next(null);
    combineLatest([
      this.sourceCaseDefinitionKeySelected$,
      this.sourceCaseDefinitionVersionTagSelected$,
      this.targetCaseDefinitionKeySelected$,
      this.targetCaseDefinitionVersionTagSelected$,
      this.patches$,
    ])
      .pipe(
        take(1),
        map(
          ([
            caseDefinitionKeySource,
            caseDefinitionVersionTagSource,
            caseDefinitionKeyTarget,
            caseDefinitionVersionTagTarget,
            patches,
          ]) =>
            ({
              documentDefinitionNameSource: caseDefinitionKeySource,
              caseDefinitionIdSource: {
                key: caseDefinitionKeySource,
                versionTag: caseDefinitionVersionTagSource,
              },
              documentDefinitionNameTarget: caseDefinitionKeyTarget,
              caseDefinitionIdTarget: {
                key: caseDefinitionKeyTarget,
                versionTag: caseDefinitionVersionTagTarget,
              },
              patches,
            }) as DocumentMigrationConflictRequest
        ),
        switchMap(request =>
          this.caseMigrationService.getConflicts(request as DocumentMigrationConflictRequest)
        )
      )
      .subscribe(response => {
        this.errors$.next(
          response.errors.concat(
            response.conflicts.filter(c => !!c.error).map(c => c.source + ': ' + c.error)
          )
        );
      });
  }

  migrate() {
    this.errors$.next(null);
    combineLatest([
      this.sourceCaseDefinitionKeySelected$,
      this.sourceCaseDefinitionVersionTagSelected$,
      this.targetCaseDefinitionKeySelected$,
      this.targetCaseDefinitionVersionTagSelected$,
      this.patches$,
    ])
      .pipe(
        take(1),
        map(
          ([
            caseDefinitionKeySource,
            caseDefinitionVersionTagSource,
            caseDefinitionKeyTarget,
            caseDefinitionVersionTagTarget,
            patches,
          ]) =>
            ({
              documentDefinitionNameSource: caseDefinitionKeySource,
              caseDefinitionIdSource: {
                key: caseDefinitionKeySource,
                versionTag: caseDefinitionVersionTagSource,
              },
              documentDefinitionNameTarget: caseDefinitionKeyTarget,
              caseDefinitionIdTarget: {
                key: caseDefinitionKeyTarget,
                versionTag: caseDefinitionVersionTagTarget,
              },
              patches,
            }) as DocumentMigrationConflictRequest
        ),
        switchMap(request =>
          this.caseMigrationService.migrate(request as DocumentMigrationConflictRequest)
        )
      )
      .subscribe({
        next: () => {
          this.errors$.next([]);
          this.globalNotificationService.showToast({
            title: this.translateService.instant('caseMigration.noErrors'),
            type: 'success',
          });
        },
        error: error => this.errors$.next([error.message]),
      });
  }

  protected readonly CARBON_THEME = 'g10';
}
