/*
 * Copyright 2020 Dimpact.
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

import {Component, OnInit, ViewChild} from '@angular/core';
import {ModalComponent} from '@valtimo/components';
import {ActivatedRoute} from '@angular/router';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {DocumentService} from '@valtimo/document';
import {AlertService} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-email-extension',
  templateUrl: './email-extension.component.html',
  styleUrls: ['./email-extension.component.scss'],
})
export class EmailExtensionComponent implements OnInit {
  @ViewChild('modal') modal: ModalComponent;

  readonly documentId$ = new BehaviorSubject<string>('');
  readonly subject$ = new BehaviorSubject<string>('');
  readonly body$ = new BehaviorSubject<string>('');
  readonly requestData$: Observable<Array<string>> = combineLatest([
    this.documentId$,
    this.subject$,
    this.body$,
  ]);
  readonly valid$: Observable<boolean> = this.requestData$.pipe(
    map(([documentId, subject, body]) => !!(documentId && subject && body))
  );
  readonly disabled$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly documentService: DocumentService,
    private readonly alertService: AlertService,
    private readonly translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.documentId$.next(this.route.snapshot.paramMap.get('documentId') || '');
  }

  subjectChange(subject: string): void {
    this.subject$.next(subject);
  }

  bodyChange(body: string): void {
    this.body$.next(body);
  }

  buttonClick(): void {
    this.modal.show();
  }

  sendMessage(): void {
    this.disable();

    this.requestData$.pipe(take(1)).subscribe(([documentId, subject, bodyText]) => {
      this.documentService.sendMessage(documentId, {subject, bodyText}).subscribe(
        () => {
          this.alertService.success(
            this.translateService.instant('dossier.sendEmailExtension.sendSuccess')
          );
          this.enable();
          this.clear();
          this.modal.hide();
        },
        () => {
          this.enable();
        }
      );
    });
  }

  private disable(): void {
    this.disabled$.next(true);
  }

  private enable(): void {
    this.disabled$.next(false);
  }

  private clear(): void {
    this.subject$.next('');
    this.body$.next('');
  }
}
