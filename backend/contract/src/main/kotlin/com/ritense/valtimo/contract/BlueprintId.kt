package com.ritense.valtimo.contract

interface BlueprintId {

    fun getTagPrefix(): String
    fun getIdKey(): String
    override fun toString(): String
}
