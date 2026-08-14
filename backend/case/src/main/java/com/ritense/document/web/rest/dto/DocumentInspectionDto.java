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

package com.ritense.document.web.rest.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.ritense.document.domain.Document;
import com.ritense.document.domain.DocumentDefinition;
import com.ritense.document.domain.RelatedFile;
import com.ritense.document.domain.relation.DocumentRelation;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Inspection-only representation of a document. Always includes {@code content},
 * regardless of the global {@code valtimo.includeDocumentContentInResponse} setting,
 * because the inspection page exists specifically to surface that data.
 */
public record DocumentInspectionDto(
    Document.Id id,
    DocumentDefinition.Id definitionId,
    LocalDateTime createdOn,
    LocalDateTime modifiedOn,
    String createdBy,
    Long sequence,
    Integer version,
    String assigneeId,
    String assigneeFullName,
    String assignedTeamKey,
    String assignedTeamTitle,
    String internalStatus,
    List<CaseTagResponseDto> caseTags,
    Set<? extends DocumentRelation> relations,
    Set<? extends RelatedFile> relatedFiles,
    JsonNode content
) {
    public static DocumentInspectionDto from(Document document) {
        return new DocumentInspectionDto(
            document.id(),
            document.definitionId(),
            document.createdOn(),
            document.modifiedOn().orElse(null),
            document.createdBy(),
            document.sequence(),
            document.version(),
            document.assigneeId(),
            document.assigneeFullName(),
            document.assignedTeamKey(),
            document.assignedTeamTitle(),
            document.internalStatus(),
            document.caseTags(),
            document.relations(),
            document.relatedFiles(),
            document.content().asJson()
        );
    }
}
