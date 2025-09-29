package com.ritense.case_.domain.header

import com.fasterxml.jackson.annotation.JsonProperty
import com.google.common.base.Objects
import com.ritense.valtimo.contract.annotation.AllOpen
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.Table
import org.hibernate.annotations.Type

@AllOpen
@Entity
@Table(name = "case_header_widget")
class CaseHeaderWidget(

    @EmbeddedId
    @JsonProperty("id")
    val id: CaseHeaderWidgetId,

    @Column(name = "case_widget_type", nullable = false, length = 256)
    val caseWidgetType: String = "fields",

    @Column(name = "title", nullable = true, length = 256)
    val title: String?,

    @Column(name = "high_contrast", nullable = false)
    val highContrast: Boolean = false,

    @Type(JsonType::class)
    @Column(name = "properties", nullable = false)
    val properties: Map<String, Any?> = emptyMap()
) {
    fun copy(
        id: CaseHeaderWidgetId = this.id,
        caseWidgetType: String = this.caseWidgetType,
        title: String? = this.title,
        highContrast: Boolean = this.highContrast,
        properties: Map<String, Any?> = this.properties
    ): CaseHeaderWidget =
        CaseHeaderWidget(
            id = id,
            caseWidgetType = caseWidgetType,
            title = title,
            highContrast = highContrast,
            properties = properties
        )

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is CaseHeaderWidget) return false

        return id == other.id &&
            caseWidgetType == other.caseWidgetType &&
            title == other.title &&
            highContrast == other.highContrast &&
            properties == other.properties
    }

    override fun hashCode(): Int =
        Objects.hashCode(id, caseWidgetType, title, highContrast, properties)

    override fun toString(): String =
        "CaseHeaderWidget(id='$id', type='$caseWidgetType', title='$title', highContrast=$highContrast)"
}