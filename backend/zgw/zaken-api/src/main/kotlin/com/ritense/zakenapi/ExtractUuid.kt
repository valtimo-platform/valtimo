package com.ritense.zakenapi

import java.net.URI
import java.util.UUID

object ExtractUuid {

    fun extractUuidFromUri(uri: URI): UUID? {
        return try {
            val lastSegment = uri.path
                ?.substringAfterLast("/")
                ?.takeIf { it.isNotBlank() }

            lastSegment?.let { UUID.fromString(it) }
        } catch (e: Exception) {
            null
        }
    }

}