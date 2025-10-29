package com.ritense.notificatiesapi.domain

import com.fasterxml.jackson.annotation.JsonInclude

@JsonInclude(JsonInclude.Include.NON_NULL)
data class NotificatiesApiException(
    val type: String,
    val code: String,
    val title: String,
    val status: Int,
    val detail: String,
    val instance: String,
    val invalidParams: List<InvalidParam>?
): RuntimeException(invalidParams?.joinToString() ?: "Unknown, check the Notificaties API.") {
    data class InvalidParam(
        val name: String,
        val code: String,
        val reason: String
    )
}