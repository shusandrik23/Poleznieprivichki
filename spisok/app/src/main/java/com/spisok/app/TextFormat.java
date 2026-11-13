package com.spisok.app;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
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

    /** Находит (или создаёт) категорию по названию из заголовка. */
    public interface Resolver {
        /** @return id категории или -1; create — можно ли создать новую */
        int resolve(String name, boolean create);
    }

    public static List<Entry> parse(String text, int defaultCategory, Resolver resolver) {
        List<Entry> out = new ArrayList<>();
        int category = defaultCategory;
        for (String raw : text.replace("\uFEFF", "").split("\\r?\\n|\\r")) {
            String line = raw.trim();
            if (line.isEmpty()) continue;

            if (line.startsWith("#")) {
                // «# Книги» — заголовок; незнакомый заголовок создаёт новую категорию
                int id = resolver.resolve(line.replaceFirst("^#+", "").trim(), true);
                if (id >= 0) category = id;
                continue;
            }
            if (line.endsWith(":") && line.length() <= 40 && !URL.matcher(line).find()) {
                // «Подкасты:» — заголовок, только если такая категория уже есть
                int id = resolver.resolve(line.substring(0, line.length() - 1).trim(), false);
                if (id >= 0) {
                    category = id;
                    continue;
                }
            }

            Entry e = parseLine(line, category);
            if (e != null) out.add(e);
        }
        return out;
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
    public static String format(List<Entry> all, List<Category> categories) {
        StringBuilder sb = new StringBuilder();
        for (Category cat : categories) {
            sb.append("# ").append(cat.name).append('\n');
            for (Entry e : all) {
                if (e.category != cat.id) continue;
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

    /** UTF-8, а если файл сохранён старым Блокнотом — Windows-1251. */
    public static String decode(byte[] bytes) {
        String s;
        try {
            s = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes))
                    .toString();
        } catch (CharacterCodingException ex) {
            s = new String(bytes, Charset.forName("windows-1251"));
        }
        if (s.startsWith("\uFEFF")) s = s.substring(1);
        return s;
    }
}
