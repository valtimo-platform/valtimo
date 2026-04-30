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

package com.ritense.form.repository;

import com.ritense.form.domain.FormDefinition;
import com.ritense.form.domain.FormIoFormDefinition;
import com.ritense.valtimo.contract.blueprint.BlueprintType;
import com.ritense.valtimo.contract.case_.CaseDefinitionId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.semver4j.Semver;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface FormDefinitionRepository extends JpaRepository<FormIoFormDefinition, UUID> {

    List<FormIoFormDefinition> findAllByOrderByNameAsc();

    List<FormIoFormDefinition> findAllByBlueprintIdIsNullOrderByNameAsc();

    @Deprecated(since = "13.14", forRemoval = true)
    default List<FormIoFormDefinition> findAllByCaseDefinitionIdIsNullOrderByNameAsc() {
        return findAllByBlueprintIdIsNullOrderByNameAsc();
    }

    @Query("SELECT f FROM FormIoFormDefinition f " +
           "WHERE f.blueprintId.blueprintType = :blueprintType " +
           "AND f.blueprintId.blueprintKey = :blueprintKey " +
           "AND f.blueprintId.blueprintVersionTag = :blueprintVersionTag " +
           "ORDER BY f.name ASC")
    List<FormIoFormDefinition> findAllByBlueprintIdOrderByNameAsc(
        @Param("blueprintType") BlueprintType blueprintType,
        @Param("blueprintKey") String blueprintKey,
        @Param("blueprintVersionTag") Semver blueprintVersionTag
    );

    @Deprecated(since = "13.14", forRemoval = true)
    default List<FormIoFormDefinition> findAllByCaseDefinitionIdOrderByNameAsc(CaseDefinitionId caseDefinitionId) {
        return findAllByBlueprintIdOrderByNameAsc(
            BlueprintType.CASE,
            caseDefinitionId.getKey(),
            caseDefinitionId.getVersionTag()
        );
    }

    Page<FormIoFormDefinition> findByBlueprintIdIsNull(Pageable pageable);

    @Deprecated(since = "13.14", forRemoval = true)
    default Page<FormIoFormDefinition> findByCaseDefinitionIdIsNull(Pageable pageable) {
        return findByBlueprintIdIsNull(pageable);
    }

    Optional<FormIoFormDefinition> findByNameAndBlueprintIdIsNull(String name);

    @Deprecated(since = "13.14", forRemoval = true)
    default Optional<FormIoFormDefinition> findByNameAndCaseDefinitionIdIsNull(String name) {
        return findByNameAndBlueprintIdIsNull(name);
    }

    @Query("SELECT f FROM FormIoFormDefinition f " +
           "WHERE f.id = :formDefinitionId " +
           "AND f.blueprintId.blueprintType = :blueprintType " +
           "AND f.blueprintId.blueprintKey = :blueprintKey " +
           "AND f.blueprintId.blueprintVersionTag = :blueprintVersionTag")
    Optional<FormIoFormDefinition> findByIdAndBlueprintId(
        @Param("formDefinitionId") UUID formDefinitionId,
        @Param("blueprintType") BlueprintType blueprintType,
        @Param("blueprintKey") String blueprintKey,
        @Param("blueprintVersionTag") Semver blueprintVersionTag
    );

    @Deprecated(since = "13.14", forRemoval = true)
    default Optional<FormIoFormDefinition> findByIdAndCaseDefinitionId(
        UUID formDefinitionId,
        CaseDefinitionId caseDefinitionId
    ) {
        return findByIdAndBlueprintId(
            formDefinitionId,
            BlueprintType.CASE,
            caseDefinitionId.getKey(),
            caseDefinitionId.getVersionTag()
        );
    }

    @Query("SELECT f FROM FormIoFormDefinition f " +
           "WHERE f.name = :name " +
           "AND f.blueprintId.blueprintType = :blueprintType " +
           "AND f.blueprintId.blueprintKey = :blueprintKey " +
           "AND f.blueprintId.blueprintVersionTag = :blueprintVersionTag")
    Optional<FormIoFormDefinition> findByNameAndBlueprintId(
        @Param("name") String name,
        @Param("blueprintType") BlueprintType blueprintType,
        @Param("blueprintKey") String blueprintKey,
        @Param("blueprintVersionTag") Semver blueprintVersionTag
    );

    @Deprecated(since = "13.14", forRemoval = true)
    default Optional<FormIoFormDefinition> findByNameAndCaseDefinitionId(String name, CaseDefinitionId caseDefinitionId) {
        if (caseDefinitionId == null) {
            return findByNameAndBlueprintIdIsNull(name);
        }
        return findByNameAndBlueprintId(
            name,
            BlueprintType.CASE,
            caseDefinitionId.getKey(),
            caseDefinitionId.getVersionTag()
        );
    }

    @Query("SELECT f FROM FormIoFormDefinition f " +
           "WHERE f.blueprintId.blueprintType = :blueprintType " +
           "AND f.blueprintId.blueprintKey = :blueprintKey " +
           "AND f.blueprintId.blueprintVersionTag = :blueprintVersionTag")
    List<FormIoFormDefinition> findAllByBlueprintId(
        @Param("blueprintType") BlueprintType blueprintType,
        @Param("blueprintKey") String blueprintKey,
        @Param("blueprintVersionTag") Semver blueprintVersionTag
    );

    @Deprecated(since = "13.14", forRemoval = true)
    default List<FormIoFormDefinition> findAllByCaseDefinitionId(CaseDefinitionId caseDefinitionId) {
        return findAllByBlueprintId(
            BlueprintType.CASE,
            caseDefinitionId.getKey(),
            caseDefinitionId.getVersionTag()
        );
    }

    @Modifying
    @Query("DELETE FROM FormIoFormDefinition f " +
           "WHERE f.blueprintId.blueprintType = :blueprintType " +
           "AND f.blueprintId.blueprintKey = :blueprintKey " +
           "AND f.blueprintId.blueprintVersionTag = :blueprintVersionTag")
    void deleteAllByBlueprintId(
        @Param("blueprintType") BlueprintType blueprintType,
        @Param("blueprintKey") String blueprintKey,
        @Param("blueprintVersionTag") Semver blueprintVersionTag
    );

    @Deprecated(since = "13.14", forRemoval = true)
    default void deleteAllByCaseDefinitionId(CaseDefinitionId caseDefinitionId) {
        deleteAllByBlueprintId(
            BlueprintType.CASE,
            caseDefinitionId.getKey(),
            caseDefinitionId.getVersionTag()
        );
    }

    Optional<FormIoFormDefinition> findByNameIgnoreCaseAndBlueprintIdIsNull(String name);

    @Deprecated(since = "13.14", forRemoval = true)
    default Optional<FormIoFormDefinition> findByNameIgnoreCaseAndCaseDefinitionIdIsNull(String name) {
        return findByNameIgnoreCaseAndBlueprintIdIsNull(name);
    }

    @Query("SELECT f FROM FormIoFormDefinition f WHERE upper(f.name) LIKE upper(concat('%', :name, '%'))")
    Page<FormDefinition> findAllByNameContainingIgnoreCase(@Param("name") String name, Pageable pageable);

    @Query("SELECT f FROM FormIoFormDefinition f " +
           "WHERE f.blueprintId.blueprintType = :blueprintType " +
           "AND f.blueprintId.blueprintKey = :blueprintKey " +
           "AND f.blueprintId.blueprintVersionTag = :blueprintVersionTag " +
           "AND upper(f.name) LIKE upper(concat('%', :name, '%'))")
    Page<FormDefinition> findAllByBlueprintIdAndNameContainingIgnoreCase(
        @Param("blueprintType") BlueprintType blueprintType,
        @Param("blueprintKey") String blueprintKey,
        @Param("blueprintVersionTag") Semver blueprintVersionTag,
        @Param("name") String name,
        Pageable pageable
    );

    @Deprecated(since = "13.14", forRemoval = true)
    default Page<FormDefinition> findAllByCaseDefinitionIdAndNameContainingIgnoreCase(
        CaseDefinitionId caseDefinitionId,
        String name,
        Pageable pageable
    ) {
        return findAllByBlueprintIdAndNameContainingIgnoreCase(
            BlueprintType.CASE,
            caseDefinitionId.getKey(),
            caseDefinitionId.getVersionTag(),
            name,
            pageable
        );
    }

    @Query("SELECT f FROM FormIoFormDefinition f WHERE upper(f.name) LIKE upper(concat('%', :name, '%')) AND f.blueprintId IS NULL")
    Page<FormDefinition> findAllWithoutBlueprintByNameContainingIgnoreCase(@Param("name") String name, Pageable pageable);

    @Deprecated(since = "13.14", forRemoval = true)
    default Page<FormDefinition> findAllWithoutCaseByNameContainingIgnoreCase(String name, Pageable pageable) {
        return findAllWithoutBlueprintByNameContainingIgnoreCase(name, pageable);
    }
}