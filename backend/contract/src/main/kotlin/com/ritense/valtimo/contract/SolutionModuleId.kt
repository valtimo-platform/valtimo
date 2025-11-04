package com.ritense.valtimo.contract

interface SolutionModuleId {

    fun getTagPrefix(): String
    fun getIdKey(): String
    override fun toString(): String
}
