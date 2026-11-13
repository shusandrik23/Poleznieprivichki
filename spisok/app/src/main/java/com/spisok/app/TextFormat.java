package com.spisok.app;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Простой текстовый формат для загрузки и сохранения списка.
 *
 * <pre>
 * # Книги
 * Название | https://ссылка | описание
 * [x] Уже прочитанная книга
 * # Подкасты
 * ...
 * # Дела
 * ...
 * </pre>
 */
public final class TextFormat {
    private static final Pattern URL = Pattern.compile("(https?://\\S+|www\\.\\S+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern WHOLE_URL = Pattern.compile("^(https?://|www\\.)\\S+$", Pattern.CASE_INSENSITIVE);
    private static final Pattern BULLET = Pattern.compile("^([-*•–—]|\\d+[.)])\\s+");
    private static final Pattern CHECKBOX = Pattern.compile("^\\[\\s*([xXхХvV✓✔+]?)\\s*]\\s*");

    private TextFormat() {}

    public static List<Entry> parse(String text, int defaultCategory) {
        List<Entry> out = new ArrayList<>();
        int category = defaultCategory;
        for (String raw : text.replace("\uFEFF", "").split("\\r?\\n|\\r")) {
            String line = raw.trim();
            if (line.isEmpty()) continue;

            int header = headerCategory(line);
            if (header >= 0) {
                category = header;
                continue;
            }
            if (line.startsWith("#")) continue; // неизвестный заголовок или комментарий

            Entry e = parseLine(line, category);
            if (e != null) out.add(e);
        }
        return out;
    }

    /** Номер списка, если строка — заголовок («# Книги», «Подкасты:»), иначе -1. */
    static int headerCategory(String line) {
        String t;
        if (line.startsWith("#")) {
            t = line.replaceFirst("^#+", "").trim();
        } else if (line.endsWith(":") && line.length() <= 40 && !URL.matcher(line).find()) {
            t = line.substring(0, line.length() - 1).trim();
        } else {
            return -1;
        }
        t = t.toLowerCase(Locale.ROOT);
        if (t.contains("книг") || t.contains("book") || t.contains("чита")) return Entry.BOOKS;
        if (t.contains("подкаст") || t.contains("podcast") || t.contains("слуша")) return Entry.PODCASTS;
        if (t.contains("дел") || t.contains("задач") || t.contains("todo") || t.contains("to do")
                || t.contains("task")) return Entry.TODO;
        return -1;
    }

    static Entry parseLine(String line, int category) {
        String s = BULLET.matcher(line).replaceFirst("");
        boolean done = false;
        Matcher cb = CHECKBOX.matcher(s);
        if (cb.find()) {
            done = !cb.group(1).isEmpty();
            s = s.substring(cb.end());
        }

        String title = null;
        String link = "";
        StringBuilder note = new StringBuilder();
        for (String part : s.split("[|\\t]")) {
            String p = part.trim();
            if (p.isEmpty()) continue;
            if (link.isEmpty() && WHOLE_URL.matcher(p).matches()) {
                link = p;
            } else if (title == null) {
                title = p;
            } else {
                if (note.length() > 0) note.append(". ");
                note.append(p);
            }
        }

        // ссылка, вписанная прямо в название: «Лекция про сон https://...»
        if (link.isEmpty() && title != null) {
            Matcher m = URL.matcher(title);
            if (m.find()) {
                link = m.group(1);
                title = (title.substring(0, m.start()) + " " + title.substring(m.end()))
                        .replaceAll("\\s+", " ")
                        .replaceAll("^[\\s:—–-]+|[\\s:—–-]+$", "");
                if (title.isEmpty()) title = null;
            }
        }
        if (title == null) {
            if (link.isEmpty()) return null;
            title = link;
        }

        Entry e = new Entry();
        e.category = category;
        e.title = title;
        e.link = link;
        e.note = note.toString();
        e.done = done;
        return e;
    }

    /** Текст для «Сохранить в файл» — его же можно загрузить обратно. */
    public static String format(List<Entry> all, String[] names) {
        StringBuilder sb = new StringBuilder();
        for (int cat = 0; cat < names.length; cat++) {
            sb.append("# ").append(names[cat]).append('\n');
            for (Entry e : all) {
                if (e.category != cat) continue;
                sb.append(e.done ? "[x] " : "[ ] ").append(clean(e.title));
                if (!e.link.isEmpty() || !e.note.isEmpty()) sb.append(" | ").append(clean(e.link));
                if (!e.note.isEmpty()) sb.append(" | ").append(clean(e.note));
                sb.append('\n');
            }
            sb.append('\n');
        }
        return sb.toString();
    }

    private static String clean(String s) {
        return s.replace('|', '/').replaceAll("\\s*[\\r\\n]+\\s*", " ").trim();
    }

    /** Достаёт первую ссылку из произвольного текста (для «Поделиться»). */
    public static String findUrl(String text) {
        if (text == null) return "";
        Matcher m = URL.matcher(text);
        return m.find() ? m.group(1) : "";
    }
}
