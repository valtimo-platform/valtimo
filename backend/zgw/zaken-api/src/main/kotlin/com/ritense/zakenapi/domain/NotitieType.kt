package com.ritense.zakenapi.domain

import com.fasterxml.jackson.annotation.JsonValue

enum class NotitieType(@JsonValue val key: String) {
    INTERN("intern"),
    EXTERN("extern")
}
