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

package com.ritense.document.repository.impl;

import com.ritense.document.domain.impl.JsonSchemaDocument;
import com.ritense.document.repository.DocumentRepository;
import com.ritense.valtimo.contract.blueprint.BlueprintType;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.semver4j.Semver;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JsonSchemaDocumentRepository extends DocumentRepository<JsonSchemaDocument>,
    JpaSpecificationExecutor<JsonSchemaDocument> {

    Page<JsonSchemaDocument> findAllByDocumentDefinitionIdName(Pageable pageable, String definitionName);

    /** Projects only the document ids homed on one specific blueprint version, ordered stably so it can be paged. The version tag is part of the filter: selecting by definition name alone would sweep up every version and skip the plans in between. */
    @Query("SELECT d.id.id FROM JsonSchemaDocument d "
        + "WHERE d.documentDefinitionId.blueprintId.blueprintType = :blueprintType "
        + "AND d.documentDefinitionId.blueprintId.blueprintKey = :blueprintKey "
        + "AND d.documentDefinitionId.blueprintId.blueprintVersionTag = :versionTag "
        + "ORDER BY d.id.id")
    Slice<UUID> findCaseIdsByBlueprintVersion(
        @Param("blueprintType") BlueprintType blueprintType,
        @Param("blueprintKey") String blueprintKey,
        @Param("versionTag") Semver versionTag,
        Pageable pageable
    );

    @Query(" SELECT  doc " +
        "    FROM    JsonSchemaDocument doc " +
        "    WHERE   (:definitionName IS NULL OR doc.documentDefinitionId.name = :definitionName)" +
        "    AND     (:searchCriteria IS NULL OR JSON_SEARCH(LOWER(doc.content), 'all', LOWER(CONCAT('%', :searchCriteria, '%'))) IS NOT NULL)" +
        "    AND     (:sequence IS NULL OR doc.sequence = :sequence)" +
        "    AND     (:createdBy IS NULL OR doc.createdBy = :createdBy)")
    Page<JsonSchemaDocument> searchByCriteria(
        @Param("definitionName") String definitionName,
        @Param("searchCriteria") String searchCriteria,
        @Param("sequence") Long sequence,
        @Param("createdBy") String createdBy,
        Pageable pageable
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT d FROM JsonSchemaDocument d WHERE d.id.id = :id")
    Optional<JsonSchemaDocument> findByIdForUpdate(@Param("id") UUID id);

    @Modifying
    @Query("update JsonSchemaDocument d set d.assignedTeamTitle = :teamTitle where d.assignedTeamKey = :teamKey")
    void updateTeamTitle(@Param("teamKey") String teamKey, @Param("teamTitle") String teamTitle);

    @Modifying
    @Query("update JsonSchemaDocument d set d.assignedTeamKey = null, d.assignedTeamTitle = null where d.assignedTeamKey = :teamKey")
    void clearTeamAssignment(@Param("teamKey") String teamKey);
}
