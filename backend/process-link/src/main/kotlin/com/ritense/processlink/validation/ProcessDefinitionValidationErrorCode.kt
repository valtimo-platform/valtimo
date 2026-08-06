/*
 *
 *  * Copyright 2015-2026 Ritense BV, the Netherlands.
 *  *
 *  * Licensed under EUPL, Version 1.2 (the "License");
 *  * you may not use this file except in compliance with the License.
 *  * You may obtain a copy of the License at
 *  *
 *  * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *  *
 *  * Unless required by applicable law or agreed to in writing, software
 *  * distributed under the License is distributed on an "AS IS" basis,
 *  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  * See the License for the specific language governing permissions and
 *  * limitations under the License.
 *
 */

package com.ritense.processlink.validation

enum class ProcessDefinitionValidationErrorCode {
    // Structure
    NO_START_EVENT,
    NO_END_EVENT,
    MULTIPLE_NONE_START_EVENTS,
    NO_OUTGOING_FLOW,
    NO_INCOMING_FLOW,
    UNREACHABLE_ELEMENT,
    NO_PATH_TO_END_EVENT,

    // Tasks
    SERVICE_TASK_NO_IMPLEMENTATION,
    USER_TASK_NO_FORM,
    SEND_TASK_NO_IMPLEMENTATION,
    RECEIVE_TASK_NO_MESSAGE,
    BUSINESS_RULE_TASK_NO_IMPLEMENTATION,
    CALL_ACTIVITY_NO_CALLED_ELEMENT,

    // Gateways
    SEQUENCE_FLOW_NO_CONDITION,

    // Events
    MESSAGE_EVENT_NO_MESSAGE,
    TIMER_EVENT_NO_CONFIG,
    SIGNAL_EVENT_NO_SIGNAL,
    CONDITIONAL_EVENT_NO_CONDITION,
    ERROR_EVENT_NO_ERROR,
    ESCALATION_EVENT_NO_ESCALATION,
    START_EVENT_NO_FORM,

    // Expression
    EXPRESSION_MISSING_EL_MARKERS,
    EXPRESSION_UNCLOSED_PARENTHESIS,
    EXPRESSION_UNCLOSED_BRACE,
    EXPRESSION_UNCLOSED_BRACKET,
    EXPRESSION_MISMATCHED_DELIMITER,
    EXPRESSION_INCOMPLETE,
    EXPRESSION_INVALID_SYNTAX,
    EXPRESSION_BEAN_NOT_FOUND
}
