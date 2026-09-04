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

import {Component, OnDestroy, OnInit} from '@angular/core';
import {CaseDefinition, DocumentService, Page} from '@valtimo/document';
import {MultiInputValues} from '@valtimo/components';
import {
  BehaviorSubject,
  combineLatest,
  EMPTY,
  expand,
  map,
  Observable,
  reduce,
  shareReplay,
  startWith,
  Subscription,
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
import {gt, valid} from 'semver';

// Spring caps the `size` request param at 2000, so larger pages have to be fetched one by one.
const MAX_PAGE_SIZE = 2000;

@Component({
  standalone: false,
  selector: 'valtimo-case-migration',
  templateUrl: './case-migration.component.html',
})
export class CaseMigrationComponent implements OnInit, OnDestroy {
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

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly documentService: DocumentService,
    private readonly caseMigrationService: CaseMigrationService,
    private readonly iconService: IconService,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([WatsonHealthStackedMove16]);
  }

  public readonly caseDefinitions$: Observable<Array<CaseDefinition>> =
    this.getAllCaseDefinitions().pipe(shareReplay(1));
  public readonly sourceCaseDefinitionKeyItems$: Observable<LoadedValue<Array<ListItem>>> =
    this.caseDefinitions$.pipe(
      map(caseDefinitions => ({
        value: this.toCaseDefinitionKeyItems(caseDefinitions),
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
    combineLatest([this.caseDefinitions$, this.targetCaseDefinitionKeySelected$]).pipe(
      map(([caseDefinitions, targetCaseDefinitionKeySelected]) => ({
        value: this.toCaseDefinitionKeyItems(caseDefinitions, targetCaseDefinitionKeySelected),
        isLoading: false,
      })),
      startWith({isLoading: true})
    );
  public readonly targetCaseDefinitionVersionTagItems$: Observable<Array<ListItem>> = combineLatest(
    [
      this.targetCaseDefinitionKeySelected$,
      this.targetCaseDefinitionVersionTagSelected$,
      this.caseDefinitions$,
    ]
  ).pipe(
    map(
      ([
        targetCaseDefinitionKeySelected,
        targetCaseDefinitionVersionTagSelected,
        caseDefinitions,
      ]) =>
        caseDefinitions
          .filter(
            caseDefinition => caseDefinition.caseDefinitionKey === targetCaseDefinitionKeySelected
          )
          .map(
            caseDefinition =>
              ({
                caseDefinitionVersionTag: caseDefinition.caseDefinitionVersionTag,
                content: caseDefinition.caseDefinitionVersionTag.toString(),
                selected:
                  caseDefinition.caseDefinitionVersionTag ===
                  targetCaseDefinitionVersionTagSelected,
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

  public ngOnInit(): void {
    // The target is prefilled to the latest version, this screen's usual case; only the user knows the source.
    this._subscriptions.add(
      this.sourceCaseDefinitionKeySelected$.subscribe(sourceCaseDefinitionKeySelected =>
        this.targetCaseDefinitionKeySelected$.next(sourceCaseDefinitionKeySelected)
      )
    );

    // Keyed off the target so a different target case replaces the tag, which it need not otherwise have.
    this._subscriptions.add(
      combineLatest([this.targetCaseDefinitionKeySelected$, this.caseDefinitions$]).subscribe(
        ([targetCaseDefinitionKeySelected, caseDefinitions]) =>
          this.targetCaseDefinitionVersionTagSelected$.next(
            this.latestVersionTagOf(caseDefinitions, targetCaseDefinitionKeySelected)
          )
      )
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

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

  /**
   * Compares tags rather than list position, so the latest version is found regardless of the order
   * the backend returns the versions of a key in.
   */
  private latestVersionTagOf(
    caseDefinitions: Array<CaseDefinition>,
    caseDefinitionKey: string | null
  ): string | null {
    return caseDefinitions
      .filter(caseDefinition => caseDefinition.caseDefinitionKey === caseDefinitionKey)
      .map(caseDefinition => caseDefinition.caseDefinitionVersionTag)
      .reduce((latest: string | null, current: string) => {
        if (latest === null) return current;
        if (!valid(current)) return latest;
        return !valid(latest) || gt(current, latest) ? current : latest;
      }, null);
  }

  private getAllCaseDefinitions(): Observable<Array<CaseDefinition>> {
    return this.getCaseDefinitionPage(0).pipe(
      expand(page =>
        page.content.length === 0 || (page.number + 1) * page.size >= page.totalElements
          ? EMPTY
          : this.getCaseDefinitionPage(page.number + 1)
      ),
      reduce(
        (caseDefinitions: Array<CaseDefinition>, page) => [...caseDefinitions, ...page.content],
        []
      )
    );
  }

  private getCaseDefinitionPage(page: number): Observable<Page<CaseDefinition>> {
    return this.documentService.getCaseDefinitionsManagement({
      sort: 'id.key,id.versionTag',
      allVersions: true,
      page,
      size: MAX_PAGE_SIZE,
    });
  }

  // Ordered on name because that is what the dropdown shows; the fetch itself is ordered on key
  // so that the versions of a case stay grouped and in version order.
  private toCaseDefinitionKeyItems(
    caseDefinitions: Array<CaseDefinition>,
    selectedCaseDefinitionKey: string | null = null
  ): Array<ListItem> {
    return [...new Map(caseDefinitions.map(item => [item.caseDefinitionKey, item])).values()]
      .map(
        caseDefinition =>
          ({
            caseDefinitionKey: caseDefinition.caseDefinitionKey,
            content: caseDefinition.name,
            selected: caseDefinition.caseDefinitionKey === selectedCaseDefinitionKey,
          }) as ListItem
      )
      .sort((left, right) => left.content.localeCompare(right.content));
  }

  protected readonly CARBON_THEME = 'g10';
}
