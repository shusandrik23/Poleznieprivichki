package com.moyadosha.app.data

object ShareText {
    fun build(name: String, age: Int, kid: Boolean, r: DoshaResult): String = buildString {
        val who = name.trim().ifEmpty { "Я" }
        appendLine("🪷 Тест «Моя доша»")
        appendLine()
        appendLine("$who, $age ${yearsWord(age)}")
        appendLine("Тип по Аюрведе: ${r.typeName} ${r.emoji}")
        appendLine(Dosha.entries.joinToString(" · ") { "${it.title} ${r.percent.getValue(it)}%" })
        appendLine()
        appendLine(Recommendations.summary(r, kid))
        appendLine()
        appendLine(if (kid) "Главные советы:" else "Главные рекомендации:")
        val perDosha = if (r.leading.size == 1) 3 else 2
        r.leading.forEach { d ->
            Recommendations.profile(d, kid).sections.take(perDosha).forEach { s ->
                appendLine("• ${s.emoji} ${s.tips.first()}")
            }
        }
        appendLine()
        append("А какая доша у тебя? Пройди тест «Моя доша» 🌬️🔥🌿")
    }

    fun yearsWord(n: Int): String {
        val mod100 = n % 100
        val mod10 = n % 10
        return when {
            mod100 in 11..14 -> "лет"
            mod10 == 1 -> "год"
            mod10 in 2..4 -> "года"
            else -> "лет"
        }
    }
}
