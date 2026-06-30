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
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {ChangeDetectionStrategy, Component, Input, OnDestroy} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {DocumentService} from '@valtimo/document';
import {
  ImageWidget,
  WidgetAction,
  WidgetImageComponent,
  WidgetImageData,
  WidgetImageItem,
  WidgetImageResolved,
  WidgetLayoutService,
} from '@valtimo/layout';
import {DownloadService, ResourceDto, UploadProviderService} from '@valtimo/resource';
import {ButtonModule} from 'carbon-components-angular';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  filter,
  forkJoin,
  map,
  Observable,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import {CaseTabService, CaseWidgetsApiService} from '../../../../../../services';
import {WidgetsService} from '../../widgets.service';
import {WidgetProcess} from '../widget-process/widget-process';

@Component({
  selector: 'valtimo-case-widget-image',
  templateUrl: './case-widget-image.component.html',
  styleUrls: ['./case-widget-image.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ButtonModule, CommonModule, TranslateModule, WidgetImageComponent],
})
export class CaseWidgetImageComponent extends WidgetProcess implements OnDestroy {
  private static readonly IMAGE_EXTENSIONS = [
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'avif',
    'svg',
    'bmp',
    'ico',
  ];

  private readonly _documentId$ = new BehaviorSubject<string>('');

  @Input({required: true}) public set documentId(value: string) {
    this.baseDocumentId = value;
    this._documentId$.next(value);
  }

  @Input() public set widgetConfiguration(value: ImageWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
    this.baseWidgetConfiguration = value;
  }

  @Input() public readonly widgetUuid: string;

  public readonly widgetConfiguration$ = new BehaviorSubject<ImageWidget | null>(null);

  private readonly _tabKey$: Observable<string> = this.caseTabService.activeTabKey$;
  private readonly _refresh$ = this.widgetsService.refreshWidgets$.pipe(startWith(null));

  private _objectUrls: string[] = [];

  public readonly images$: Observable<WidgetImageResolved[] | null> = combineLatest([
    this.widgetConfiguration$,
    this._tabKey$,
    this._documentId$,
    this._refresh$,
  ]).pipe(
    filter(([widget, , documentId]) => !!widget && !!documentId),
    switchMap(([widget, tabKey, documentId]) =>
      this.caseWidgetApiService.getWidgetData(documentId, tabKey, widget!.key, undefined)
    ),
    switchMap(data => this.resolveImages((data as unknown as WidgetImageData)?.images ?? [])),
    tap(() => this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid)),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 404) this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid);
      return of([]);
    })
  );

  constructor(
    protected readonly documentService: DocumentService,
    protected readonly permissionService: PermissionService,
    private readonly widgetsService: WidgetsService,
    private readonly caseTabService: CaseTabService,
    private readonly caseWidgetApiService: CaseWidgetsApiService,
    private readonly widgetLayoutService: WidgetLayoutService,
    private readonly uploadProviderService: UploadProviderService,
    private readonly downloadService: DownloadService,
    private readonly httpClient: HttpClient
  ) {
    super(documentService, permissionService);
  }

  public ngOnDestroy(): void {
    this.revokeObjectUrls();
  }

  public onProcessStartClick(process: WidgetAction): void {
    if (!process.processDefinitionKey) return;
    this.widgetsService.startProcess(process.processDefinitionKey);
  }

  public onDownload(image: WidgetImageResolved): void {
    this.downloadService.downloadFile(image.displayUrl || image.url, image.fileName, true);
  }

  public onOpenInNewTab(image: WidgetImageResolved): void {
    window.open(image.displayUrl || image.url, '_blank', 'noopener');
  }

  private resolveImages(images: WidgetImageItem[]): Observable<WidgetImageResolved[]> {
    this.revokeObjectUrls();
    if (images.length === 0) return of([]);

    return forkJoin(
      images.map(image =>
        this.uploadProviderService.getResource(image.resourceId).pipe(
          switchMap((resource: ResourceDto) =>
            this.toDisplayUrl(resource.url).pipe(
              map(
                (displayUrl: string): WidgetImageResolved => ({
                  resourceId: image.resourceId,
                  url: resource.url,
                  displayUrl,
                  fileName: image.fileName ?? resource.resource?.name ?? '',
                  mimeType: image.mimeType,
                })
              )
            )
          ),
          catchError(() => of(null))
        )
      )
    ).pipe(
      map(resolved =>
        resolved.filter(
          (item): item is WidgetImageResolved => item !== null && this.isImage(item)
        )
      )
    );
  }

  // Only browser-renderable image files are shown; other resources (e.g. a PDF) would display
  // incorrectly, so they are filtered out by extension. When nothing renderable remains the
  // "no image found" state is shown.
  private isImage(image: WidgetImageResolved): boolean {
    const extension = image.fileName?.split('.').pop()?.toLowerCase() ?? '';
    return CaseWidgetImageComponent.IMAGE_EXTENSIONS.includes(extension);
  }

  // The source url (e.g. an S3 pre-signed url) is blocked by the img-src CSP directive, so the
  // bytes are fetched through connect-src and rendered as a blob object url instead.
  private toDisplayUrl(sourceUrl: string): Observable<string> {
    return this.httpClient.get(sourceUrl, {responseType: 'blob'}).pipe(
      map(blob => {
        const objectUrl = URL.createObjectURL(blob);
        this._objectUrls.push(objectUrl);
        return objectUrl;
      }),
      catchError(() => of(sourceUrl))
    );
  }

  private revokeObjectUrls(): void {
    this._objectUrls.forEach(url => URL.revokeObjectURL(url));
    this._objectUrls = [];
  }
}
