package com.moyadosha.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.moyadosha.app.data.Dosha

val Cream = Color(0xFFFBF6EE)
val Sand = Color(0xFFF3E3CC)
val Terracotta = Color(0xFF8A5A44)
val Ink = Color(0xFF3B2A22)

fun Dosha.color(): Color = when (this) {
    Dosha.VATA -> Color(0xFF7C9CC4)
    Dosha.PITTA -> Color(0xFFE0783E)
    Dosha.KAPHA -> Color(0xFF6E9E5E)
}

private val colors = lightColorScheme(
    primary = Terracotta,
    onPrimary = Color.White,
    primaryContainer = Sand,
    onPrimaryContainer = Ink,
    secondary = Color(0xFFB9825F),
    background = Cream,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    surfaceVariant = Color(0xFFF6EDE0),
    onSurfaceVariant = Color(0xFF6B5547),
    outline = Color(0xFFD9C6B0),
)

private val typography = Typography(
    headlineMedium = TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 28.sp, lineHeight = 34.sp),
    titleLarge = TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold, fontSize = 22.sp, lineHeight = 28.sp),
    titleMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 17.sp, lineHeight = 23.sp),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 23.sp),
    bodyMedium = TextStyle(fontSize = 15.sp, lineHeight = 21.sp),
)

@Composable
fun DoshaTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colors, typography = typography, content = content)
}
