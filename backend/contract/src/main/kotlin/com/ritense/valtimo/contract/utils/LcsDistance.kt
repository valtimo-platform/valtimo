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

    fun between(a: String, b: String): Int {
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
        return a.length + b.length - 2 * lcs[a.length][b.length]
    }
}
