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

import {DecisionService} from '../decision.service';
import {AfterViewInit, Component} from '@angular/core';
import DmnJS from 'dmn-js/dist/dmn-modeler.development.js';
import {ActivatedRoute, Router} from '@angular/router';
import {Decision, DecisionXml} from '../models';
import {migrateDiagram} from '@bpmn-io/dmn-migrate';
import {LayoutService} from '@valtimo/layout';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  filter,
  from,
  map,
  Observable,
  of,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {AlertService, PageTitleService, SelectedValue, SelectItem} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';
import {EMPTY_DECISION} from './empty-decision';

declare const $: any;

@Component({
  selector: 'valtimo-decision-modeler',
  templateUrl: './decision-modeler.component.html',
  styleUrls: ['./decision-modeler.component.scss'],
})
export class DecisionModelerComponent implements AfterViewInit {
  private CLASS_NAMES = {
    drd: 'dmn-icon-lasso-tool',
    decisionTable: 'dmn-icon-decision-table',
    literalExpression: 'dmn-icon-literal-expression',
  };
  private $container!: any;
  private $tabs!: any;
  private dmnModeler!: DmnJS;

  readonly versionSelectionDisabled$ = new BehaviorSubject<boolean>(true);

  readonly isCreating$ = new BehaviorSubject<boolean>(false);

  private readonly decisionId$: Observable<string | null> = this.route.params.pipe(
    map(params => params?.id),
    tap(decisionId => this.isCreating$.next(decisionId === 'create')),
    filter(decisionId => !!decisionId && decisionId !== 'create'),
    tap(() => this.versionSelectionDisabled$.next(true))
  );

  readonly selectionId$ = new BehaviorSubject<string>('');

  private readonly decision$: Observable<Decision> = this.decisionId$.pipe(
    switchMap(decisionId => this.decisionService.getDecisionById(decisionId)),
    tap(decision => {
      if (decision) {
        this.selectionId$.next(decision.id);
      }
    })
  );

  readonly decisionTitle$: Observable<string> = this.decision$.pipe(
    map(decision => decision?.key || ''),
    tap(decisionTitle => {
      this.pageTitleService.setCustomPageTitle(decisionTitle);
    })
  );

  readonly createdDecisionVersionSelectItems$ = new BehaviorSubject<Array<SelectItem>>([]);

  readonly decisionVersionSelectItems$: Observable<Array<SelectItem>> = combineLatest([
    this.decision$,
    this.decisionService.getDecisions(),
    this.createdDecisionVersionSelectItems$,
  ]).pipe(
    map(([currentDecision, decisions, createdDecisionVersionSelectItems]) => {
      const decisionsWithKey = decisions.filter(decision => decision.key === currentDecision.key);

      return [
        ...decisionsWithKey.map(decision => ({
          id: decision.id,
          text: decision.version.toString(),
        })),
        ...createdDecisionVersionSelectItems,
      ].sort((a, b) => Number(b.text) - Number(a.text));
    }),
    tap(() => this.versionSelectionDisabled$.next(false))
  );

  readonly decisionXml$ = this.decisionId$.pipe(
    switchMap(decisionId => this.decisionService.getDecisionXml(decisionId)),
    tap(decisionXml => {
      if (decisionXml) {
        this.loadDecisionXml(decisionXml);
      }
    })
  );

  constructor(
    private readonly decisionService: DecisionService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly alertService: AlertService,
    private readonly translateService: TranslateService,
    public readonly layoutService: LayoutService,
    private readonly pageTitleService: PageTitleService
  ) {}

  ngAfterViewInit(): void {
    this.setProperties();
    this.setTabEvents();
    this.setModelerEvents();
  }

  switchVersion(decisionId: string | SelectedValue): void {
    if (decisionId) {
      this.router.navigate(['/decision-tables/edit', decisionId]);
    }
  }

  deploy(): void {
    from(this.dmnModeler.saveXML({format: true}))
      .pipe(
        map(result => (result as any).xml),
        map(
          xml =>
            new File([xml], 'decision.dmn', {
              type: 'text/xml',
            })
        ),
        switchMap(file => this.decisionService.deployDmn(file)),
        tap(res => {
          const deployedDefinitions = res.deployedDecisionDefinitions;
          const deployedDecisionDefinition =
            deployedDefinitions[Object.keys(deployedDefinitions)[0]];
          const deployedId = deployedDecisionDefinition.id;

          this.createdDecisionVersionSelectItems$
            .pipe(take(1))
            .subscribe(createdDecisionVersionSelectItems => {
              if (deployedDecisionDefinition) {
                this.createdDecisionVersionSelectItems$.next([
                  ...createdDecisionVersionSelectItems,
                  {
                    id: deployedId,
                    text: deployedDecisionDefinition.version.toString(),
                  },
                ]);
              }

              if (deployedId) {
                setTimeout(() => {
                  this.switchVersion(deployedId);
                  this.alertService.success(
                    this.translateService.instant('decisions.deploySuccess')
                  );
                });
              }
            });
        }),
        catchError(() => {
          this.alertService.error(this.translateService.instant('decisions.deployFailure'));
          return of(null);
        })
      )
      .subscribe();
  }

  download(): void {
    from(this.dmnModeler.saveXML({format: true}))
      .pipe(
        map(result => (result as any).xml),
        map(
          xml =>
            new File([xml], 'decision.dmn', {
              type: 'text/xml',
            })
        ),
        tap(file => {
          const link = document.createElement('a');
          link.download = 'diagram.dmn';
          link.href = window.URL.createObjectURL(file);
          link.click();
          window.URL.revokeObjectURL(link.href);
          link.remove();
        })
      )
      .subscribe();
  }

  private setProperties(): void {
    const isCreating = this.isCreating$.getValue();

    this.$container = $('.editor-container');
    this.$tabs = $('.editor-tabs');
    this.dmnModeler = new DmnJS({
      container: this.$container,
      height: 500,
      width: '100%',
      keyboard: {
        bindTo: window,
      },
    });

    if (isCreating) {
      this.loadEmptyDecisionTable();
    }
  }

  private loadEmptyDecisionTable(): void {
    this.loadDecisionXml(EMPTY_DECISION);
  }

  private setTabEvents = (): void => {
    const $tabs = this.$tabs;
    const dmnModeler = this.dmnModeler;

    $tabs.delegate('.tab', 'click', async function (e) {
      // get index of view from clicked tab
      const viewIdx = parseInt(this.getAttribute('data-id'), 10);

      // get view using index
      const view = dmnModeler.getViews()[viewIdx];

      // open view
      try {
        await dmnModeler.open(view);
      } catch (err) {
        console.error('error opening tab', err);
      }
    });
  };

  private setModelerEvents = (): void => {
    const $tabs = this.$tabs;
    const CLASS_NAMES = this.CLASS_NAMES;

    this.dmnModeler.on('views.changed', function (event) {
      // get views from event
      const {views, activeView} = event;

      // clear tabs
      $tabs.empty();

      // create a new tab for each view
      views.forEach(function (v, idx) {
        const className = CLASS_NAMES[v.type];

        const tab = $(`
            <div class="tab ${v === activeView ? 'active' : ''}" data-id="${idx}">
              <span class="${className}"></span>
              ${v.element.name || v.element.id}
            </div>
          `);

        $tabs.append(tab);
      });
    });
  };

  private loadDecisionXml(decision: DecisionXml): void {
    from(this.dmnModeler.importXML(decision.dmnXml))
      .pipe(
        tap(() => {
          this.setEditor();
        }),
        catchError(() => {
          this.migrateAndLoadDecisionXml(decision);
          return of(null);
        })
      )
      .subscribe();
  }

  private migrateAndLoadDecisionXml(decision: DecisionXml): void {
    from(migrateDiagram(decision.dmnXml))
      .pipe(
        switchMap(decisionXml => this.dmnModeler.importXML(decisionXml)),
        tap(() => {
          this.setEditor();
        }),
        catchError(() => {
          this.alertService.error(this.translateService.instant('decisions.loadFailure'));
          return of(null);
        })
      )
      .subscribe();
  }

  private setEditor(): void {
    const dmnModeler = this.dmnModeler;

    const activeView = dmnModeler.getActiveView();

    // apply initial logic in DRD view
    if (activeView.type === 'drd') {
      const activeEditor = dmnModeler.getActiveViewer();

      // access active editor components
      const canvas = activeEditor.get('canvas');

      // zoom to fit full viewport
      canvas.zoom('fit-viewport');
    }
  }
}
