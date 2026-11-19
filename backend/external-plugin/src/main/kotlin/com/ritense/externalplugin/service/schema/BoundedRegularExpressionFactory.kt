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

package com.ritense.externalplugin.service.schema

import com.networknt.schema.regex.RegularExpression
import com.networknt.schema.regex.RegularExpressionFactory
import java.time.Duration
import java.util.regex.Pattern

/**
 * JDK regex syntax, but matching aborts once the current thread's validation budget is spent.
 * The budget spans one whole `validate`, not one match: many cheap-ish matches add up.
 */
internal object BoundedRegularExpressionFactory : RegularExpressionFactory {
    private val deadline = ThreadLocal<Long>()

    fun <T> within(budget: Duration, block: () -> T): T {
        val previous = deadline.get()
        deadline.set(System.nanoTime() + budget.toNanos())
        try {
            return block()
        } finally {
            if (previous == null) deadline.remove() else deadline.set(previous)
        }
    }

    override fun getRegularExpression(regex: String): RegularExpression {
        val pattern = Pattern.compile(regex)
        return RegularExpression { value ->
            val until = deadline.get() ?: throw IllegalStateException("Schema pattern matched outside a validation budget")
            pattern.matcher(DeadlineCharSequence(value, until)).find()
        }
    }
}

internal class SchemaBudgetExceededException : RuntimeException(null, null, false, false)

private class DeadlineCharSequence(private val text: CharSequence, private val until: Long) : CharSequence {
    private var reads = 0
    override val length: Int get() = text.length
    override fun get(index: Int): Char {
        // nanoTime on read 1, 257, 513, ...
        if ((reads++ and 0xFF) == 0 && System.nanoTime() > until) throw SchemaBudgetExceededException()
        return text[index]
    }
    override fun subSequence(startIndex: Int, endIndex: Int): CharSequence =
        DeadlineCharSequence(text.subSequence(startIndex, endIndex), until)
    override fun toString(): String = text.toString()
}
