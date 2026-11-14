package com.moyadosha.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moyadosha.app.QuizViewModel
import com.moyadosha.app.Screen
import com.moyadosha.app.data.Dosha
import com.moyadosha.app.data.DoshaResult
import com.moyadosha.app.data.Lang
import com.moyadosha.app.data.TEST_LENGTHS
import com.moyadosha.app.data.ShareText
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun DoshaApp(vm: QuizViewModel, onShare: (String) -> Unit) {
    Surface(color = MaterialTheme.colorScheme.background, modifier = Modifier.fillMaxSize()) {
        Box(
            Modifier
                .fillMaxSize()
                .safeDrawingPadding(),
            contentAlignment = Alignment.TopCenter,
        ) {
            Box(Modifier.widthIn(max = 640.dp).fillMaxSize()) {
                Crossfade(targetState = vm.screen, label = "screen") { screen ->
                    when (screen) {
                        Screen.Welcome -> WelcomeScreen(vm)
                        Screen.Quiz -> QuizScreen(vm)
                        Screen.Result -> ResultScreen(vm, onShare)
                    }
                }
            }
        }
    }
}

// ---------- Приветствие: имя и возраст ----------

@Composable
private fun WelcomeScreen(vm: QuizViewModel) {
    val s = vm.strings
    val focus = LocalFocusManager.current
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .imePadding()
            .padding(horizontal = 20.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("🌬️ 🔥 🌿", fontSize = 40.sp)
        Spacer(Modifier.height(12.dp))
        Text(s.appName, style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
        Spacer(Modifier.height(8.dp))
        Text(
            s.intro,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))

        SoftCard {
            Text(s.meet, style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = vm.name,
                onValueChange = { vm.name = it.take(30) },
                label = { Text(s.name) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.Words,
                    imeAction = ImeAction.Next,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = vm.ageText,
                onValueChange = { v -> vm.ageText = v.filter { it.isDigit() }.take(3) },
                label = { Text(s.age) },
                singleLine = true,
                isError = vm.ageText.isNotEmpty() && vm.age == null,
                supportingText = if (vm.ageText.isNotEmpty() && vm.age == null) {
                    { Text(s.ageError) }
                } else null,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = {
                    focus.clearFocus()
                    if (vm.canStart) vm.start()
                }),
                modifier = Modifier.fillMaxWidth(),
            )

            AnimatedVisibility(visible = vm.age != null) {
                Column {
                    Spacer(Modifier.height(12.dp))
                    InfoNote(if (vm.isKid) s.kidNote else s.adultNote)
                }
            }

            Spacer(Modifier.height(16.dp))
            Text(s.howMany, style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TEST_LENGTHS.forEach { n ->
                    val selected = vm.length == n
                    Column(
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(
                                if (selected) MaterialTheme.colorScheme.primaryContainer
                                else MaterialTheme.colorScheme.surface
                            )
                            .border(
                                if (selected) 2.dp else 1.dp,
                                if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                                RoundedCornerShape(12.dp),
                            )
                            .clickable { vm.length = n }
                            .padding(vertical = 10.dp, horizontal = 6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text("$n", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Text(
                            s.lengthHint(n),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            Button(
                onClick = { focus.clearFocus(); vm.start() },
                enabled = vm.canStart,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(14.dp),
            ) { Text(s.start, fontSize = 17.sp) }
        }

        Spacer(Modifier.height(20.dp))
        Text(s.threeDoshas, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))
        Dosha.entries.forEach { DoshaIntro(it, vm.lang, s.doshaIntro(it)) }
    }
}

@Composable
private fun DoshaIntro(d: Dosha, lang: Lang, text: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(d.color().copy(alpha = 0.12f))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(d.emoji, fontSize = 24.sp)
        Spacer(Modifier.width(12.dp))
        Column {
            Text("${d.title(lang)} — ${d.element(lang)}", fontWeight = FontWeight.SemiBold)
            Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// ---------- Вопросы ----------

@Composable
private fun QuizScreen(vm: QuizViewModel) {
    val s = vm.strings
    val scope = rememberCoroutineScope()
    var askExit by remember { mutableStateOf(false) }
    val total = vm.questions.size

    BackHandler { if (!vm.back()) askExit = true }

    if (askExit) {
        AlertDialog(
            onDismissRequest = { askExit = false },
            title = { Text(s.quitTitle) },
            text = { Text(s.quitText) },
            confirmButton = { TextButton(onClick = { askExit = false; vm.toWelcome() }) { Text(s.quit) } },
            dismissButton = { TextButton(onClick = { askExit = false }) { Text(s.continueTest) } },
        )
    }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 4.dp, end = 16.dp, top = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { if (!vm.back()) askExit = true }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = s.back)
            }
            Text(
                s.questionOf(vm.index + 1, total),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.weight(1f),
            )
            if (vm.isKid) {
                Text(
                    s.kidBadge,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        val progress by animateFloatAsState((vm.index + 1f) / total, tween(300), label = "progress")
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).height(8.dp).clip(CircleShape),
            trackColor = MaterialTheme.colorScheme.primaryContainer,
        )

        AnimatedContent(
            targetState = vm.index,
            transitionSpec = {
                val dir = if (targetState > initialState) 1 else -1
                (slideInHorizontally { it * dir / 3 } + fadeIn()) togetherWith
                    (slideOutHorizontally { -it * dir / 3 } + fadeOut())
            },
            label = "question",
            modifier = Modifier.weight(1f),
        ) { i ->
            val question = vm.questions[i]
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 20.dp),
            ) {
                Text(question.text, style = MaterialTheme.typography.titleLarge)
                Spacer(Modifier.height(16.dp))
                question.options.forEachIndexed { optIdx, option ->
                    OptionItem(
                        letter = (if (vm.lang == Lang.RU) "АБВГДЕ" else "ABCDEF")[optIdx],
                        text = option.text,
                        selected = vm.answers[i] == optIdx,
                        onClick = {
                            vm.choose(optIdx)
                            scope.launch {
                                delay(260)
                                if (vm.index == i) vm.next()
                            }
                        },
                    )
                    Spacer(Modifier.height(10.dp))
                }
            }
        }

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            OutlinedButton(
                onClick = { if (!vm.back()) askExit = true },
                modifier = Modifier.height(50.dp),
                shape = RoundedCornerShape(14.dp),
            ) { Text(s.back) }
            Button(
                onClick = { vm.next() },
                enabled = vm.answers.getOrNull(vm.index) != null,
                modifier = Modifier.weight(1f).height(50.dp),
                shape = RoundedCornerShape(14.dp),
            ) { Text(if (vm.index == total - 1) s.seeResult else s.next) }
        }
    }
}

@Composable
private fun OptionItem(letter: Char, text: String, selected: Boolean, onClick: () -> Unit) {
    val primary = MaterialTheme.colorScheme.primary
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        ),
        border = BorderStroke(if (selected) 2.dp else 1.dp, if (selected) primary else MaterialTheme.colorScheme.outline),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(if (selected) primary else MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    letter.toString(),
                    fontWeight = FontWeight.Bold,
                    color = if (selected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.width(12.dp))
            Text(text, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

// ---------- Результат ----------

@Composable
private fun ResultScreen(vm: QuizViewModel, onShare: (String) -> Unit) {
    val r = vm.result ?: return
    val s = vm.strings
    val rec = vm.recommendations
    val lang = vm.lang
    val kid = vm.isKid
    val age = vm.age ?: 0
    BackHandler { vm.toWelcome() }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 20.dp),
    ) {
        ResultHeader(vm.name.trim(), s.yourDosha(kid), lang, r)
        Spacer(Modifier.height(16.dp))

        SoftCard {
            Text(s.proportions(kid), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(12.dp))
            Dosha.entries.sortedByDescending { r.percent.getValue(it) }.forEach { d ->
                PercentBar(d, lang, r.percent.getValue(d))
                Spacer(Modifier.height(10.dp))
            }
        }
        Spacer(Modifier.height(16.dp))

        SoftCard {
            Text(s.yourType(kid), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            Text(rec.summary(r, kid), style = MaterialTheme.typography.bodyLarge)
        }

        rec.seasonTip(r, kid)?.let {
            Spacer(Modifier.height(12.dp))
            InfoNote("🗓️ $it")
        }

        Spacer(Modifier.height(20.dp))
        Text(s.tipsTitle(kid), style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(8.dp))
        r.leading.forEachIndexed { i, d ->
            DoshaRecommendations(d, kid, vm, initiallyExpanded = i == 0)
            Spacer(Modifier.height(12.dp))
        }

        Spacer(Modifier.height(8.dp))
        Button(
            onClick = { onShare(ShareText.build(vm.name, age, kid, r, lang)) },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(14.dp),
        ) {
            Icon(Icons.Filled.Share, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(s.share, fontSize = 17.sp)
        }
        Spacer(Modifier.height(10.dp))
        OutlinedButton(
            onClick = { vm.toWelcome() },
            modifier = Modifier.fillMaxWidth().height(50.dp),
            shape = RoundedCornerShape(14.dp),
        ) {
            Icon(Icons.Filled.Refresh, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(s.retake)
        }
        Spacer(Modifier.height(16.dp))
        Text(
            rec.disclaimer,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
    }
}

@Composable
private fun ResultHeader(name: String, yourDosha: String, lang: Lang, r: DoshaResult) {
    val colors = r.leading.map { it.color() }
    val brush = if (colors.size > 1) Brush.linearGradient(colors.map { it.copy(alpha = 0.85f) })
    else Brush.linearGradient(listOf(colors[0].copy(alpha = 0.95f), colors[0].copy(alpha = 0.65f)))
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(brush)
            .padding(24.dp),
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            val who = if (name.isEmpty()) "" else "$name, "
            Text(
                who + yourDosha,
                color = Color.White,
                style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(8.dp))
            Text(r.emoji, fontSize = 44.sp)
            Spacer(Modifier.height(4.dp))
            Text(
                r.typeName(lang),
                color = Color.White,
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center,
            )
            Text(
                r.leading.joinToString(" + ") { it.element(lang) },
                color = Color.White.copy(alpha = 0.9f),
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun PercentBar(d: Dosha, lang: Lang, percent: Int) {
    val anim by animateFloatAsState(percent / 100f, tween(900), label = "bar")
    Column {
        Row(Modifier.fillMaxWidth()) {
            Text("${d.emoji} ${d.title(lang)}", fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            Text("$percent%", fontWeight = FontWeight.Bold, color = d.color())
        }
        Spacer(Modifier.height(4.dp))
        Box(
            Modifier
                .fillMaxWidth()
                .height(12.dp)
                .clip(CircleShape)
                .background(d.color().copy(alpha = 0.15f)),
        ) {
            Box(
                Modifier
                    .fillMaxWidth(anim)
                    .height(12.dp)
                    .clip(CircleShape)
                    .background(d.color()),
            )
        }
    }
}

@Composable
private fun DoshaRecommendations(d: Dosha, kid: Boolean, vm: QuizViewModel, initiallyExpanded: Boolean) {
    val s = vm.strings
    val p = vm.recommendations.profile(d, kid)
    var expanded by rememberSaveable(d) { mutableStateOf(initiallyExpanded) }
    val arrow by animateFloatAsState(if (expanded) 180f else 0f, label = "arrow")
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, d.color().copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded }
                .background(d.color().copy(alpha = 0.12f))
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(d.emoji, fontSize = 24.sp)
            Spacer(Modifier.width(10.dp))
            Text(
                s.forDosha(d),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.weight(1f),
            )
            Icon(
                Icons.Filled.KeyboardArrowDown,
                contentDescription = if (expanded) s.collapse else s.expand,
                modifier = Modifier.rotate(arrow),
            )
        }
        AnimatedVisibility(visible = expanded) {
            Column(Modifier.padding(16.dp)) {
                SubTitle(s.strengths(kid))
                Bullets(p.strengths, d.color())
                Spacer(Modifier.height(12.dp))
                SubTitle(s.imbalance(d, kid))
                Bullets(p.imbalance, d.color())
                p.sections.forEach { s ->
                    Spacer(Modifier.height(12.dp))
                    SubTitle("${s.emoji} ${s.title}")
                    Bullets(s.tips, d.color())
                }
            }
        }
    }
}

@Composable
private fun SubTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium)
    Spacer(Modifier.height(4.dp))
}

@Composable
private fun Bullets(items: List<String>, color: Color) {
    items.forEach {
        Row(Modifier.padding(vertical = 3.dp)) {
            Box(
                Modifier
                    .padding(top = 8.dp)
                    .size(7.dp)
                    .clip(CircleShape)
                    .background(color),
            )
            Spacer(Modifier.width(10.dp))
            Text(it, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

// ---------- Общие элементы ----------

@Composable
private fun SoftCard(content: @Composable () -> Unit) {
    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(18.dp)) { content() }
    }
}

@Composable
private fun InfoNote(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.bodyMedium,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(12.dp),
    )
}
