package com.ritense.zakenapi.domain

import com.fasterxml.jackson.annotation.JsonValue

enum class NotitieStatus(@JsonValue val key: String) {
    CONCEPT("concept"),
    DEFINITIEF("definitief")
}
