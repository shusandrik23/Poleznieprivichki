package com.moyadosha.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.moyadosha.app.data.DoshaResult
import com.moyadosha.app.data.KID_MAX_AGE
import com.moyadosha.app.data.Lang
import com.moyadosha.app.data.Question
import com.moyadosha.app.data.Recommendations
import com.moyadosha.app.data.Scoring
import com.moyadosha.app.data.UiStrings
import com.moyadosha.app.data.questionsFor
import kotlin.random.Random

enum class Screen { Welcome, Quiz, Result }

class QuizViewModel : ViewModel() {
    /** Язык выбирается по языку системы: русский или английский. */
    val lang: Lang = Lang.system()
    val strings = UiStrings(lang)
    val recommendations = Recommendations(lang)

    var screen by mutableStateOf(Screen.Welcome)
        private set

    var name by mutableStateOf("")
    var ageText by mutableStateOf("")
    var length by mutableIntStateOf(35)

    val age: Int? get() = ageText.trim().toIntOrNull()?.takeIf { it in 1..110 }
    val isKid: Boolean get() = (age ?: 99) <= KID_MAX_AGE
    val canStart: Boolean get() = name.isNotBlank() && age != null

    /** Вопросы с перемешанными вариантами ответа, чтобы не было угадываемого порядка. */
    var questions: List<Question> = emptyList()
        private set

    /** Индекс выбранного варианта для каждого вопроса (или null). */
    val answers = mutableStateListOf<Int?>()

    var index by mutableIntStateOf(0)
        private set

    var result: DoshaResult? by mutableStateOf(null)
        private set

    fun start() {
        val a = age ?: return
        val rnd = Random(System.nanoTime())
        questions = questionsFor(a, length, lang).map { it.copy(options = it.options.shuffled(rnd)) }
        answers.clear()
        repeat(questions.size) { answers.add(null) }
        index = 0
        result = null
        screen = Screen.Quiz
    }

    fun choose(optionIndex: Int) {
        answers[index] = optionIndex
    }

    fun next() {
        if (answers[index] == null) return
        if (index < questions.lastIndex) {
            index++
        } else {
            result = Scoring.score(questions.mapIndexed { i, q -> q.options[answers[i]!!].mix })
            screen = Screen.Result
        }
    }

    /** @return false, если назад идти некуда (первый вопрос). */
    fun back(): Boolean {
        if (index == 0) return false
        index--
        return true
    }

    fun toWelcome() {
        screen = Screen.Welcome
    }
}
