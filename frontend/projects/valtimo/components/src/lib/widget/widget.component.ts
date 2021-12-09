/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

/**
 * Component used to display a widget element
 */
@Component({
  selector: 'valtimo-widget',
  templateUrl: './widget.component.html',
  styleUrls: ['./widget.component.css']
})
export class WidgetComponent implements OnInit {
  @Input() type?: string;
  @Input() name?: string;
  @Input() icon?: string;
  @Input() contrast?: string;
  @Input() divider?: string;
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() collapseAble?: string;
  @Input() collapse?: string;
  @Input() additionalClasses?: string;

  public cardClassName: string;
  public contrastClass: string;
  public dividerClass: string;
  public isCollapsed: boolean;

  ngOnInit(): void {
    this.setCardClassName();
    this.setType();
    this.setAdditionalClasses();
    this.setContrast();
    this.setDivider();
    this.setCollapse();
  }

  public toggleContent(): void {
    if (this.collapseAble) {
      this.isCollapsed = !this.isCollapsed;
    }
  }

  private setCardClassName(): void {
    this.cardClassName = 'card-full-default';
  }

  private setType(): void {
    if (this.type) {
      this.cardClassName = `card-full-${this.type}`;
    }
  }

  private setAdditionalClasses(): void {
    if (this.additionalClasses) {
      this.cardClassName = `${this.cardClassName} ${this.additionalClasses}`;
    }
  }

  private setContrast(): void {
    if (this.contrast) {
      this.contrastClass = 'card-header-contrast';
    }
  }

  private setDivider(): void {
    if (this.divider) {
      this.dividerClass = 'card-header-divider';
    }
  }

  private setCollapse(): void {
    this.isCollapsed = !(this.collapseAble && this.collapse === 'hide');
  }
}
