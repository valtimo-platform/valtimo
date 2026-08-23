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

package com.ritense.valtimo.contract.utils

/**
 * LCS (longest-common-subsequence) distance: the number of single-character insertions and
 * deletions needed to turn one string into the other, i.e. `len(a) + len(b) - 2 * LCS`.
 */
object LcsDistance {

    fun between(a: String, b: String): Int = a.length + b.length - 2 * lengthOfLongestCommonSubsequence(a, b)

    /**
     * The same comparison as [between], normalised to `0.0`(nothing in common)`..1.0`(equal) —
     * `2 * LCS / (len(a) + len(b))`. Use this to compare *different* pairs with each other, which
     * [between] cannot do: its result grows with the length of the strings, so a small change to two
     * long names scores worse than a large change to two short ones. Two empty strings are equal.
     */
    fun similarityOf(a: String, b: String): Double {
        val totalLength = a.length + b.length
        if (totalLength == 0) return 1.0
        return 2.0 * lengthOfLongestCommonSubsequence(a, b) / totalLength
    }

    private fun lengthOfLongestCommonSubsequence(a: String, b: String): Int {
        val lcs = Array(a.length + 1) { IntArray(b.length + 1) }
        for (i in 1..a.length) {
            for (j in 1..b.length) {
                lcs[i][j] = if (a[i - 1] == b[j - 1]) {
                    lcs[i - 1][j - 1] + 1
                } else {
                    maxOf(lcs[i - 1][j], lcs[i][j - 1])
                }
            }
        }
        return lcs[a.length][b.length]
    }
}
