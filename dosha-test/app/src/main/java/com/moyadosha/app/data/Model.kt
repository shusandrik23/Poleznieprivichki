package com.moyadosha.app.data

enum class Dosha(val title: String, val emoji: String, val element: String) {
    VATA("Вата", "🌬️", "воздух и эфир"),
    PITTA("Питта", "🔥", "огонь и вода"),
    KAPHA("Капха", "🌿", "земля и вода"),
}

/**
 * Каждый вариант ответа даёт 2 балла: либо целиком одной доше,
 * либо поровну двум (смешанные варианты). Так 6 вариантов покрывают
 * все оттенки: В, П, К, В+П, П+К, В+К.
 */
enum class Mix(val vata: Int, val pitta: Int, val kapha: Int) {
    V(2, 0, 0), P(0, 2, 0), K(0, 0, 2),
    VP(1, 1, 0), PK(0, 1, 1), VK(1, 0, 1);

    fun points(d: Dosha) = when (d) {
        Dosha.VATA -> vata
        Dosha.PITTA -> pitta
        Dosha.KAPHA -> kapha
    }
}

data class Option(val mix: Mix, val text: String)

data class Question(val text: String, val options: List<Option>)

internal fun q(text: String, vararg options: Pair<Mix, String>) =
    Question(text, options.map { Option(it.first, it.second) })

/** Возраст, до которого показывается детская версия теста. */
const val KID_MAX_AGE = 12

fun questionsFor(age: Int): List<Question> =
    if (age <= KID_MAX_AGE) KidQuestions.all else AdultQuestions.all
