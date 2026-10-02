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

package com.ritense.valtimo.operaton.task.service;

import com.ritense.valtimo.contract.annotation.ProcessBean;
import com.ritense.valtimo.contract.annotation.ProcessBeanMethod;
import org.operaton.bpm.engine.delegate.DelegateTask;

@ProcessBean(description = "Sends email notifications for tasks")
public interface NotificationService {

    @ProcessBeanMethod(description = "Sends a notification for the current task using the default template")
    void sendNotification(DelegateTask task);

    @ProcessBeanMethod(
        description = "Sends a notification for the current task using a specified template",
        example = "${notificationService.sendNotification(task, 'custom-template')}"
    )
    void sendNotification(DelegateTask task, String template);
}
