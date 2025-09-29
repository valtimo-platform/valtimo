package com.ritense.case_.domain.header

import com.fasterxml.jackson.annotation.JsonCreator
import com.ritense.valtimo.contract.domain.AbstractId
import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import java.util.Objects

@Embeddable
data class CaseHeaderWidgetId(

    @Column(name = "case_definition_key", updatable = false, nullable = false, length = 256)
    val caseDefinitionKey: String,

    @Column(name = "case_definition_version_tag", updatable = false, nullable = false, length = 200)
    val caseDefinitionVersionTag: String,
) : AbstractId<CaseHeaderWidgetId>() {

    override fun hashCode(): Int = Objects.hash(caseDefinitionKey, caseDefinitionVersionTag)

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as CaseHeaderWidgetId
        return caseDefinitionKey == other.caseDefinitionKey &&
            caseDefinitionVersionTag == other.caseDefinitionVersionTag
    }

    override fun toString(): String =
        "$caseDefinitionKey:$caseDefinitionVersionTag"

    companion object {
        @JvmStatic
        @JsonCreator
        fun create(value: String): CaseHeaderWidgetId {
            val parts = value.split(':', limit = 3)
            require(parts.size == 3) {
                "Invalid CaseHeaderWidgetId, expected '<caseDefinitionKey>:<versionTag>:<key>'"
            }
            return CaseHeaderWidgetId(
                caseDefinitionKey = parts[0],
                caseDefinitionVersionTag = parts[1]
            ).newIdentity()
        }
    }
}