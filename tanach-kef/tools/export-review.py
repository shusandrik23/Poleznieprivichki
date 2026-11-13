#!/usr/bin/env python3
"""Exports every text of the course into a Word file for a teacher to review.

    python3 tools/export-review.py            # -> review/tanach-kef-texts.docx

Reads content/course.json (run tools/build-course.mjs first)."""
import json, re, os
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = json.load(open(os.path.join(ROOT, 'content', 'course.json'), encoding='utf-8'))
MARK = re.compile(r'\{([^|}]+)\|([^}]+)\}')
HE_FONT = 'David'
GREY = RGBColor(0x55, 0x66, 0x77)
GREEN = RGBColor(0x1B, 0x7A, 0x3C)

doc = Document()
st = doc.styles['Normal']
st.font.name = 'Arial'; st.font.size = Pt(11)
st.element.rPr.rFonts.set(qn('w:cs'), HE_FONT)
for s in doc.sections:
    s.left_margin = s.right_margin = Cm(2); s.top_margin = s.bottom_margin = Cm(1.8)


def rtl_par(p):
    pPr = p._p.get_or_add_pPr()
    bidi = OxmlElement('w:bidi'); pPr.append(bidi)
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT


def run(p, text, he=False, bold=False, size=None, color=None, italic=False):
    r = p.add_run(text)
    r.bold = bold; r.italic = italic
    if color: r.font.color.rgb = color
    rPr = r._r.get_or_add_rPr()
    if he:
        rtl = OxmlElement('w:rtl'); rPr.append(rtl)
        fonts = rPr.find(qn('w:rFonts'))
        if fonts is None:
            fonts = OxmlElement('w:rFonts'); rPr.append(fonts)
        fonts.set(qn('w:cs'), HE_FONT)
        if bold:
            rPr.append(OxmlElement('w:bCs'))
    sz = size or (14 if he else 11)
    r.font.size = Pt(sz)
    szcs = OxmlElement('w:szCs'); szcs.set(qn('w:val'), str(int(sz * 2))); rPr.append(szcs)
    return r


def he_par(text, bold=False, size=None, container=None):
    p = (container or doc).add_paragraph()
    rtl_par(p); run(p, text, he=True, bold=bold, size=size)
    return p


def ru_par(text, bold=False, color=None, italic=False, container=None, size=None):
    p = (container or doc).add_paragraph()
    run(p, text, bold=bold, color=color, italic=italic, size=size)
    return p


def cell_he(cell, text, bold=False, size=None):
    p = cell.paragraphs[0]; rtl_par(p); run(p, text, he=True, bold=bold, size=size)


def cell_ru(cell, text, bold=False, color=None):
    p = cell.paragraphs[0]; run(p, text or '', bold=bold, color=color)


def table(headers, rows, kinds):
    """kinds: 'he' or 'ru' per column"""
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Table Grid'; t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        cell_ru(t.rows[0].cells[i], h, bold=True, color=GREY)
    for r in rows:
        cells = t.add_row().cells
        for i, v in enumerate(r):
            (cell_he if kinds[i] == 'he' else cell_ru)(cells[i], v or '')
    doc.add_paragraph()
    return t


# ---------------- intro ----------------
doc.add_heading('מַסָּע בַּתַּנַ״ךְ — тексты для проверки', 0)
ru_par('Документ собран автоматически из файлов уроков. В нём все тексты приложения: вводные истории, слова, стихи с подсказками, вопросы и варианты ответов — на иврите и на русском.')
doc.add_heading('Что проверить', 1)
for line in [
    'Вводные истории, значения слов, подсказки и вопросы на современном иврите — правильность и огласовки (никуд). Их писал не специалист.',
    'Верный ли ответ отмечен знаком ✓ и нет ли второго подходящего ответа среди неверных.',
    'Русский перевод: стихов, историй, слов и вопросов. Переводы стихов — свои, простые, для детей; это не цитата из готового перевода.',
    'Соответствие программе вашей школы (государственная / государственно-религиозная).',
    'Тексты самих стихов взяты из Ленинградского кодекса: огласовки сохранены, знаки кантилляции убраны, вместо ктива подставлено кри, Имя Всевышнего записано как ה׳. Сам текст стихов перепроверять не нужно — только выбор отрывков.',
]:
    doc.add_paragraph(line, style='List Bullet')
doc.add_heading('Принятые решения (можно изменить)', 1)
for line in [
    'Имена в русском тексте пишутся так, как их слышит ребёнок в школе, а привычное русское — в скобках при первом упоминании: «Ноах (Ной)», «Йосеф (Иосиф)». Таблица имён — ниже.',
    'ה׳ и אֱלֹהִים в переводах — «Всевышний»; в выражениях вроде «Б-г Израиля» — «Б-г».',
    'Транслитерация ивритских слов в вопросах — русскими буквами, звук ה передан латинской h («hинени»), как принято в русскоязычной прессе Израиля.',
    'Иврит — основной язык приложения; русский появляется под ивритом как помощь и включается кнопкой RU.',
]:
    doc.add_paragraph(line, style='List Bullet')

doc.add_heading('Имена и названия', 1)
table(['иврит', 'как говорят в школе', 'по-русски'], C.get('names', []), ['he', 'ru', 'ru'])
doc.add_heading('Персонажи в заданиях «Кто это сказал?»', 2)
table(['иврит', 'по-русски'], [[c['name'], c.get('ru', '')] for c in C['characters'].values()], ['he', 'ru'])

# ---------------- lessons ----------------
for book in C['books']:
    doc.add_page_break()
    doc.add_heading(f"{book['subtitle']} — {book.get('ru') or ''}", 1)
    he_par(book['title'], bold=True, size=16)
    for story in book['stories']:
        if story.get('soon'):
            continue
        doc.add_heading(f"История: {story.get('ru') or ''}", 2)
        he_par(story['title'], bold=True, size=15)
        for les in story['lessons']:
            ru = les.get('ru', {})
            doc.add_heading(f"Урок «{ru.get('title', '')}»  ·  {les['id']}", 3)
            he_par(les['title'], bold=True)

            ru_par('1. Вводная история', bold=True, color=GREY)
            table(['иврит', 'русский'], [[h, (ru.get('story') or [''] * 9)[i]] for i, h in enumerate(les['story'])], ['he', 'ru'])

            ru_par('2. Слова урока', bold=True, color=GREY)
            table(['слово из Танаха', 'современный иврит', 'русский'],
                  [[w['t'], w['m'] + (f"  ({w['note']})" if w.get('note') else ''), w.get('ru', '')] for w in les['words']],
                  ['he', 'he', 'ru'])

            ru_par('3. Стихи', bold=True, color=GREY)
            for v in les['verses']:
                ru_par(v['ref'], color=GREY, size=9)
                he_par(MARK.sub(r'\1', v['text']), size=15)
                if v.get('ru'):
                    ru_par(v['ru'], italic=True)
                glosses = [(w, g[1:]) for w, g in MARK.findall(v['text']) if g.startswith('=')]
                if glosses:
                    ru_par('Подсказки к словам стиха (всплывают при нажатии):', color=GREY, size=9)
                    table(['слово', 'подсказка'], [[w, g] for w, g in glosses], ['he', 'he'])

            ru_par('4. Задания', bold=True, color=GREY)
            for t in les['tasks']:
                if t['type'] == 'match':
                    ru_par('• Найти пару: слово из Танаха — современное слово (слова урока).')
                elif t['type'] == 'order':
                    ru_par('• Собрать стих из плиток:' + (f" (лишняя плитка: {', '.join(t['extra'])})" if t.get('extra') else ''))
                    he_par(t['text'])
                elif t['type'] == 'who':
                    ch = C['characters']
                    ru_par(f"• Кто это сказал? Верно: {ch[t['answer']].get('ru', '')}. Варианты: " +
                           ', '.join(ch[o].get('ru', o) for o in t['options']))
                    he_par('„' + t['quote'] + '”')
                elif t['type'] == 'choice':
                    tr = t.get('ru', {})
                    kind = 'детектив' if t['kind'] == 'detective' else 'значение'
                    ru_par(f"• Вопрос ({kind}):")
                    he_par(t['q'], bold=True)
                    if tr.get('q'):
                        ru_par(tr['q'], italic=True)
                    rows = []
                    for i, o in enumerate(t['options']):
                        mark = '✓' if i == t['answer'] else ''
                        rows.append([mark, o, (tr.get('options') or [''] * 9)[i]])
                    table(['', 'вариант (иврит)', 'русский'], rows, ['ru', 'he', 'ru'])
                    if t.get('explain'):
                        ru_par('Пояснение после ответа:', color=GREY, size=9)
                        he_par(t['explain'])
                        if tr.get('explain'):
                            ru_par(tr['explain'], italic=True)

out_dir = os.path.join(ROOT, 'review'); os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, 'tanach-kef-texts.docx')
doc.save(out)
print('saved', out)
