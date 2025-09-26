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
import {DocumentDefinitionId, DocumentService} from '@valtimo/document';
import {MultiInputValues} from '@valtimo/components';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  shareReplay,
  startWith,
  switchMap,
  take,
} from 'rxjs';
import {ListItem} from 'carbon-components-angular/dropdown';
import {
  DocumentMigrationConflictRequest,
  DocumentMigrationPatch,
  LoadedValue,
} from '../../models';
import {CaseMigrationService} from '../../services';
import {WatsonHealthStackedMove16} from '@carbon/icons';
import {IconService} from 'carbon-components-angular';

@Component({
  selector: 'valtimo-case-migration',
  templateUrl: './case-migration.component.html',
})
export class CaseMigrationComponent {
  public readonly sourceDocumentDefinitionNameSelected$ = new BehaviorSubject<string | null>(null);
  public readonly sourceDocumentDefinitionVersionSelected$ = new BehaviorSubject<number | null>(
    null
  );
  public readonly targetDocumentDefinitionNameSelected$ = new BehaviorSubject<string | null>(null);
  public readonly targetDocumentDefinitionVersionSelected$ = new BehaviorSubject<number | null>(
    null
  );
  public readonly patchItems$ = new BehaviorSubject<MultiInputValues>([]);
  public readonly errors$ = new BehaviorSubject<Array<string>>([]);
  public readonly showConfirmationModal$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly documentService: DocumentService,
    private readonly caseMigrationService: CaseMigrationService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([WatsonHealthStackedMove16]);
  }

  public readonly documentDefinitionIds$: Observable<Array<DocumentDefinitionId>> =
    this.documentService.getAllDefinitions().pipe(
      map(definitions => definitions.content.map(definition => definition.id)),
      shareReplay(1)
    );
  public readonly sourceDocumentDefinitionNameItems$: Observable<LoadedValue<Array<ListItem>>> =
    this.documentDefinitionIds$.pipe(
      map(documentDefinitionIds =>
        documentDefinitionIds.map(
          documentDefinitionId =>
            ({
              documentDefinitionName: documentDefinitionId.name,
              content: documentDefinitionId.name,
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
  public readonly sourceDocumentDefinitionVersionItems$: Observable<Array<ListItem>> =
    combineLatest([this.sourceDocumentDefinitionNameSelected$, this.documentDefinitionIds$]).pipe(
      map(([sourceDocumentDefinitionNameSelected, documentDefinitionIds]) =>
        documentDefinitionIds.find(id => id.name === sourceDocumentDefinitionNameSelected)
      ),
      filter(documentDefinitionId => !!documentDefinitionId),
      map(documentDefinitionId => [...Array(documentDefinitionId.version).keys()].map(v => v + 1)),
      map(versions =>
        versions.map(
          version =>
            ({
              documentDefinitionVersion: version,
              content: version.toString(),
              selected: false,
            }) as ListItem
        )
      )
    );
  public readonly targetDocumentDefinitionNameItems$: Observable<LoadedValue<Array<ListItem>>> =
    this.documentDefinitionIds$.pipe(
      map(documentDefinitionIds =>
        documentDefinitionIds.map(
          documentDefinitionId =>
            ({
              documentDefinitionName: documentDefinitionId.name,
              content: documentDefinitionId.name,
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
  public readonly targetDocumentDefinitionVersionItems$: Observable<Array<ListItem>> =
    combineLatest([this.targetDocumentDefinitionNameSelected$, this.documentDefinitionIds$]).pipe(
      map(([targetDocumentDefinitionNameSelected, documentDefinitionIds]) =>
        documentDefinitionIds.find(id => id.name === targetDocumentDefinitionNameSelected)
      ),
      filter(documentDefinitionId => !!documentDefinitionId),
      map(documentDefinitionId => [...Array(documentDefinitionId.version).keys()].map(v => v + 1)),
      map(versions =>
        versions.map(
          version =>
            ({
              documentDefinitionVersion: version,
              content: version.toString(),
              selected: false,
            }) as ListItem
        )
      )
    );
  public readonly patches$: Observable<Array<DocumentMigrationPatch>> =
    this.patchItems$.pipe(
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
    combineLatest([
      this.sourceDocumentDefinitionNameSelected$,
      this.sourceDocumentDefinitionVersionSelected$,
      this.targetDocumentDefinitionNameSelected$,
      this.targetDocumentDefinitionVersionSelected$,
      this.patches$,
    ])
      .pipe(
        take(1),
        map(
          ([
            documentDefinitionNameSource,
            documentDefinitionVersionSource,
            documentDefinitionNameTarget,
            documentDefinitionVersionTarget,
            patches,
          ]) =>
            ({
              documentDefinitionNameSource,
              documentDefinitionVersionSource,
              documentDefinitionNameTarget,
              documentDefinitionVersionTarget,
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
    combineLatest([
      this.sourceDocumentDefinitionNameSelected$,
      this.sourceDocumentDefinitionVersionSelected$,
      this.targetDocumentDefinitionNameSelected$,
      this.targetDocumentDefinitionVersionSelected$,
      this.patches$,
    ])
      .pipe(
        take(1),
        map(
          ([
            documentDefinitionNameSource,
            documentDefinitionVersionSource,
            documentDefinitionNameTarget,
            documentDefinitionVersionTarget,
            patches,
          ]) =>
            ({
              documentDefinitionNameSource,
              documentDefinitionVersionSource,
              documentDefinitionNameTarget,
              documentDefinitionVersionTarget,
              patches,
            }) as DocumentMigrationConflictRequest
        ),
        switchMap(request =>
          this.caseMigrationService.migrate(request as DocumentMigrationConflictRequest)
        )
      )
      .subscribe();
  }

  protected readonly CARBON_THEME = 'g10';
}
