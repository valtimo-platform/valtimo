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

import {Component, OnDestroy, OnInit} from '@angular/core';

declare var $;

@Component({
  selector: 'valtimo-filter-sidebar',
  templateUrl: './filter-sidebar.component.html',
  styleUrls: ['./filter-sidebar.component.css']
})
export class FilterSidebarComponent implements OnInit, OnDestroy {

  public filterSidebar: string;

  constructor() {
    this.filterSidebar = localStorage.getItem('filterSidebar') || 'show';
  }

  ngOnInit() {
    if (this.filterSidebar === 'show') {
      localStorage.setItem('filterSidebar', 'show');
      $('.be-content').addClass('be-aside');
    }
    $('[data-toggle="tooltip"]').tooltip();
  }

  ngOnDestroy() {
    $('.be-content').removeClass('be-aside');
  }

  toggleFilterSidebar() {
    const beContent = $('.be-content');
    beContent.toggleClass('be-aside');
    this.filterSidebar = beContent.hasClass('be-aside') ? 'show' : 'hide';
    localStorage.setItem('filterSidebar', this.filterSidebar);
  }

}
