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
import {CommonModule} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostBinding,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
  effect,
  signal,
} from '@angular/core';
import {FormBuilder, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {ButtonModule, IconModule, InputModule, TabsModule} from 'carbon-components-angular';

import {WidgetWizardService} from '../../../../services';
import {CdsThemeService, CurrentCarbonTheme} from '@valtimo/components';
import {BehaviorSubject, Subscription, combineLatest, debounceTime, map} from 'rxjs';

@Component({
  selector: 'valtimo-widget-wizard-content-step',
  templateUrl: './widget-wizard-content-step.component.html',
  styleUrls: ['./widget-wizard-content-step.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    InputModule,
    TabsModule,
    IconModule,
    ReactiveFormsModule,
    ButtonModule,
  ],
})
export class WidgetWizardContentStepComponent implements OnDestroy, OnInit {
  @HostBinding('class') public readonly class = 'valtimo-widget-wizard-content';
  @ViewChild('contentRenderer', {static: true, read: ViewContainerRef})
  private readonly _vcr: ViewContainerRef;
  @Output() public readonly validEvent = new EventEmitter<boolean>();

  public form = this.fb.group({
    widgetTitle: this.fb.control(this.widgetWizardService.widgetTitle(), Validators.required),
  });

  public readonly columns = signal<null[]>([null]);
  public readonly widgetWidth = this.widgetWizardService.widgetWidth();
  public readonly selectedTabIndex = -1;
  public readonly theme$ = this.cdsThemeService.currentTheme$.pipe(
    map((theme: CurrentCarbonTheme) =>
      theme === CurrentCarbonTheme.G10 ? 'white' : CurrentCarbonTheme.G90
    )
  );

  private readonly _subscriptions = new Subscription();
  private readonly _contentValid = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      combineLatest([this.form.valueChanges, this._contentValid])
        .pipe(debounceTime(100))
        .subscribe(([formValid, contentValid]) => {
          if (formValid)
            this.widgetWizardService.widgetTitle.set(this.form.get('widgetTitle')?.value ?? '');
          this.validEvent.emit(formValid && contentValid);
        })
    );
    const widgetContent = this.widgetWizardService.widgetContent();
    if (!widgetContent) return;

    this.columns.set(Object.keys(widgetContent).map(() => null));
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.form.reset();
  }

  public onAddColumnClick(): void {
    this.columns.update(value => [...value, null]);
  }

  public onColumnTabSelected(index: number): void {
    this.renderComponent(index);
  }

  public onDeleteColumnClick(index: number): void {
    this.widgetWizardService.widgetContent.update(
      (content: {[columnIndex: number]: any} | null) => {
        if (!content) return null;

        let tempIndex = index;
        while (tempIndex < this.columns().length - 1) {
          content[tempIndex] = content[tempIndex + 1];
          tempIndex++;
        }
        delete content[tempIndex];

        return content;
      }
    );

    this.columns.update((columns: null[]) => {
      const temp = columns;
      temp.splice(index, 1);

      return temp;
    });
  }

  private renderComponent(columnIndex: number): void {
    this._vcr.clear();
    const widget = this.widgetWizardService.selectedWidget();
    if (!widget) return;

    const componentInstance = this._vcr.createComponent(widget.component).instance;
    if (!componentInstance) return;

    const widgetContent = this.widgetWizardService.widgetContent();
    if (!!widgetContent) componentInstance.columnData = widgetContent[columnIndex];

    this._subscriptions.add(
      componentInstance.changeEvent.subscribe((event: {data: any; valid: boolean}) => {
        this.widgetWizardService.widgetContent.update(content => ({
          ...content,
          [columnIndex]: event.data,
        }));
        this._contentValid.next(event.valid);
      })
    );
    this.cdr.detectChanges();
  }
}
