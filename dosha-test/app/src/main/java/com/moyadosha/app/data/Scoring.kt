package com.moyadosha.app.data

data class DoshaResult(
    /** Проценты по каждой доше, в сумме 100. */
    val percent: Map<Dosha, Int>,
    /** Ведущие доши по убыванию: одна, две (смешанный тип) или три (сбалансированный тип). */
    val leading: List<Dosha>,
) {
    fun typeName(lang: Lang): String = leading.joinToString("-") { it.title(lang) }
    val emoji: String get() = leading.joinToString("") { it.emoji }
}

object Scoring {
    /** Если разница между первой и второй дошей не больше этого порога — тип двойной. */
    private const val DUAL_GAP = 10

    /** Если все три доши укладываются в этот разброс — тип сбалансированный (трёхдошевый). */
    private const val TRI_SPREAD = 8

    fun score(answers: List<Mix>): DoshaResult {
        val raw = Dosha.entries.associateWith { d -> answers.sumOf { it.points(d) } }
        val total = raw.values.sum().coerceAtLeast(1)
        val percent = roundTo100(raw.mapValues { it.value * 100.0 / total })

        val sorted = Dosha.entries.sortedByDescending { percent.getValue(it) }
        val (first, second, third) = sorted.map { percent.getValue(it) }
        val leading = when {
            first - third <= TRI_SPREAD -> sorted
            first - second <= DUAL_GAP -> sorted.take(2)
            else -> sorted.take(1)
        }
        return DoshaResult(percent, leading)
    }

    /** Округляет проценты так, чтобы в сумме было ровно 100 (метод наибольшего остатка). */
    private fun roundTo100(values: Map<Dosha, Double>): Map<Dosha, Int> {
        val floors = values.mapValues { it.value.toInt() }.toMutableMap()
        var rest = 100 - floors.values.sum()
        values.entries.sortedByDescending { it.value - it.value.toInt() }.forEach {
            if (rest > 0) {
                floors[it.key] = floors.getValue(it.key) + 1
                rest--
            }
        }
        return floors
    }
}
