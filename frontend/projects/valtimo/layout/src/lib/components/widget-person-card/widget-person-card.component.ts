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
  HostBinding,
  Input,
  OnDestroy,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {IconModule, IconService, SkeletonModule} from 'carbon-components-angular';
import {Calendar20, Email20, Phone20} from '@carbon/icons';
import {Subscription} from 'rxjs';
import {PersonCardWidget} from '../../models';

interface PersonCardWidgetData {
  fullName?: string;
  birthDate?: string;
  bsn?: string;
  phone?: string;
  email?: string;
  city?: string;
}

@Component({
  selector: 'valtimo-widget-person-card',
  templateUrl: './widget-person-card.component.html',
  styleUrls: ['./widget-person-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, TranslateModule, IconModule, SkeletonModule],
})
export class WidgetPersonCardComponent implements OnDestroy {
  @HostBinding('class') public readonly class = 'valtimo-widget-person-card';

  public readonly $widgetData = signal<PersonCardWidgetData | null>(null);
  public readonly $currentLang = signal(this.translateService.currentLang || 'en');

  @Input() public set widgetConfiguration(_value: PersonCardWidget) {
    // Configuration is not needed at render time — the BE resolves source paths to values
    // and exposes them via widgetData.
  }

  @Input() public set widgetData(value: PersonCardWidgetData | null) {
    this.$widgetData.set(value ?? null);
  }

  public readonly $initials = computed(() => {
    const fullName = this.$widgetData()?.fullName?.trim() ?? '';
    if (!fullName) return '';
    return fullName
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase())
      .join('');
  });

  public readonly $age = computed(() => {
    const birthDate = this.$widgetData()?.birthDate;
    if (!birthDate) return null;
    const date = new Date(birthDate);
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - date.getFullYear();
    const monthDiff = now.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) age--;
    return age;
  });

  public readonly $formattedBirthDate = computed(() => {
    const birthDate = this.$widgetData()?.birthDate;
    if (!birthDate) return null;
    const date = new Date(birthDate);
    if (isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(this.$currentLang(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  });

  public readonly $subtitle = computed(() => {
    const ageValue = this.$age();
    const city = this.$widgetData()?.city?.trim();
    const ageLabel =
      ageValue !== null
        ? this.translateService.instant('widgets.personCard.age', {age: ageValue})
        : '-';
    const cityLabel = city || '-';
    return `${ageLabel} · ${cityLabel}`;
  });

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly translateService: TranslateService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Phone20, Email20, Calendar20]);
    this._subscriptions.add(
      this.translateService.onLangChange.subscribe(event => this.$currentLang.set(event.lang))
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }
}
