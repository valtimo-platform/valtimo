/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Input,
  OnChanges,
  signal,
  SimpleChanges,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {Copy16, Launch16, WarningAltFilled16} from '@carbon/icons';
import {
  AccordionModule,
  ButtonModule,
  IconModule,
  IconService,
  NotificationModule,
  StructuredListModule,
  TagModule,
} from 'carbon-components-angular';
import {EditorModel, JsonEditorComponent} from '@valtimo/components';
import {catchError, forkJoin, of} from 'rxjs';
import {
  CaseZaakdetailsInspectionDto,
  CaseZgwInspectionDto,
  ZaakdetailsObjectContentDto,
  ZaakobjectResolveResultDto,
} from './case-inspection.models';
import {ZgwCaseInspectionService} from './zgw-case-inspection.service';

type ResolveState<T> = T | 'loading';

@Component({
  standalone: true,
  selector: 'valtimo-case-inspection-zgw',
  templateUrl: './zgw-tab.component.html',
  styleUrl: './zgw-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    AccordionModule,
    ButtonModule,
    IconModule,
    NotificationModule,
    StructuredListModule,
    TagModule,
    JsonEditorComponent,
  ],
})
export class CaseInspectionZgwTabComponent implements OnChanges {
  @Input() public documentId!: string;

  public readonly $loading = signal<boolean>(true);
  public readonly $errorMessage = signal<string | null>(null);
  public readonly $zgw = signal<CaseZgwInspectionDto | null>(null);
  public readonly $zaakdetails = signal<CaseZaakdetailsInspectionDto | null>(null);
  public readonly $showZaakdetails = signal<boolean>(false);
  public readonly $resolvedObjects = signal<
    Record<string, ResolveState<ZaakobjectResolveResultDto>>
  >({});
  public readonly $zaakdetailsContent = signal<ResolveState<ZaakdetailsObjectContentDto> | null>(
    null
  );

  public readonly $rawZaakModel = computed<EditorModel | null>(() => {
    const zaak = this.$zgw()?.zaak;
    return zaak ? {value: JSON.stringify(zaak, null, 2), language: 'json'} : null;
  });

  public readonly $resolvedRecordModels = computed<Record<string, EditorModel>>(() => {
    const out: Record<string, EditorModel> = {};
    const resolved = this.$resolvedObjects();
    Object.keys(resolved).forEach(objectUrl => {
      const value = resolved[objectUrl];
      if (value !== 'loading' && value.resolved && value.record) {
        out[objectUrl] = {value: JSON.stringify(value.record, null, 2), language: 'json'};
      }
    });
    return out;
  });

  public readonly $zaakdetailsContentModel = computed<EditorModel | null>(() => {
    const content = this.$zaakdetailsContent();
    if (!content || content === 'loading') return null;
    if (!content.resolved || !content.record) return null;
    return {value: JSON.stringify(content.record, null, 2), language: 'json'};
  });

  constructor(
    private readonly zgwCaseInspectionService: ZgwCaseInspectionService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Copy16, Launch16, WarningAltFilled16]);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.documentId && this.documentId) this.load();
  }

  public onCopy(value: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(value);
    }
  }

  public onResolveZaakobject(objectUrl: string): void {
    this.$resolvedObjects.update(current => ({...current, [objectUrl]: 'loading'}));
    this.zgwCaseInspectionService
      .resolveZaakobjectContent(this.documentId, objectUrl)
      .subscribe(result => {
        this.$resolvedObjects.update(current => ({...current, [objectUrl]: result}));
      });
  }

  public onResolveZaakdetailsContent(): void {
    this.$zaakdetailsContent.set('loading');
    this.zgwCaseInspectionService
      .getZaakdetailsObjectContent(this.documentId)
      .subscribe(result => this.$zaakdetailsContent.set(result));
  }

  public objectResolveState(
    objectUrl: string
  ): ResolveState<ZaakobjectResolveResultDto> | undefined {
    return this.$resolvedObjects()[objectUrl];
  }

  private load(): void {
    this.$loading.set(true);
    this.$errorMessage.set(null);

    forkJoin({
      zgw: this.zgwCaseInspectionService.getZgwInspection(this.documentId),
      zaakdetails: this.zgwCaseInspectionService
        .getZaakdetailsInspection(this.documentId)
        .pipe(catchError(() => of<CaseZaakdetailsInspectionDto | null>(null))),
    }).subscribe({
      next: ({zgw, zaakdetails}) => {
        this.$zgw.set(zgw);
        this.$zaakdetails.set(zaakdetails);
        this.$showZaakdetails.set(
          !!zaakdetails && (!!zaakdetails.syncConfig || !!zaakdetails.zaakdetailsObject)
        );
        this.$loading.set(false);
      },
      error: err => {
        this.$errorMessage.set(err?.error?.message ?? err?.message ?? 'Failed to load ZGW data');
        this.$loading.set(false);
      },
    });
  }
}
