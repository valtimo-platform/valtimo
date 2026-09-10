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
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  EventEmitter,
  HostListener,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {AiLabel20, SendAlt16, Subtract16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {IconModule, IconService, InputModule} from 'carbon-components-angular';
import {ASSISTANT_TEST_IDS} from '../../constants';
import {AssistantChatService} from '../../services';
import {AssistantMessageComponent} from '../assistant-message/assistant-message.component';
import {AssistantSuggestionsComponent} from '../assistant-suggestions/assistant-suggestions.component';

@Component({
  standalone: true,
  selector: 'valtimo-assistant-panel',
  templateUrl: './assistant-panel.component.html',
  styleUrls: ['./assistant-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AssistantMessageComponent,
    AssistantSuggestionsComponent,
    CommonModule,
    IconModule,
    InputModule,
    ReactiveFormsModule,
    TranslateModule,
  ],
})
export class AssistantPanelComponent implements OnInit, AfterViewInit {
  @ViewChild('messageInput') private readonly _messageInput!: ElementRef<HTMLInputElement>;
  @ViewChild('messageList') private readonly _messageList!: ElementRef<HTMLElement>;

  @Output() public minimizeEvent = new EventEmitter<void>();

  public readonly formGroup: FormGroup = this.fb.group({
    message: this.fb.control(''),
  });

  protected readonly testIds = ASSISTANT_TEST_IDS;

  constructor(
    public readonly chatService: AssistantChatService,
    private readonly fb: FormBuilder,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([AiLabel20, SendAlt16, Subtract16]);
    this.openScrollEffect();
  }

  public ngOnInit(): void {
    this.chatService.openConversation();
  }

  public ngAfterViewInit(): void {
    this._messageInput?.nativeElement.focus();
  }

  @HostListener('keydown.escape')
  public onEscape(): void {
    if (this.chatService.$pendingAction()) return;

    this.minimizeEvent.emit();
  }

  public onSubmit(): void {
    this.sendMessage(this.formGroup.get('message')?.value ?? '');
  }

  public onSuggestionSelect(suggestion: string): void {
    this.sendMessage(suggestion);
  }

  private sendMessage(text: string): void {
    if (!text.trim()) return;

    this.chatService.sendMessage(text);
    this.formGroup.reset({message: ''});
  }

  private openScrollEffect(): void {
    effect(() => {
      this.chatService.$messages();
      this.chatService.$awaitingReply();

      const list = this._messageList?.nativeElement;

      if (list) requestAnimationFrame(() => (list.scrollTop = list.scrollHeight));
    });
  }
}
