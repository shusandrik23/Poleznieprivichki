package com.spisok.app;

import org.json.JSONException;
import org.json.JSONObject;

/** Один пункт списка. category — id категории; 0, 1, 2 — стандартные книги, подкасты, дела. */
public class Entry {
    public static final int BOOKS = 0;
    public static final int PODCASTS = 1;
    public static final int TODO = 2;

    public long id;
    public int category;
    public String title = "";
    public String link = "";
    public String note = "";
    public boolean done;
    public long created;

    JSONObject toJson() throws JSONException {
        JSONObject o = new JSONObject();
        o.put("id", id);
        o.put("category", category);
        o.put("title", title);
        o.put("link", link);
        o.put("note", note);
        o.put("done", done);
        o.put("created", created);
        return o;
    }

    static Entry fromJson(JSONObject o) {
        Entry e = new Entry();
        e.id = o.optLong("id");
        e.category = o.optInt("category");
        e.title = o.optString("title", "");
        e.link = o.optString("link", "");
        e.note = o.optString("note", "");
        e.done = o.optBoolean("done");
        e.created = o.optLong("created");
        return e;
    }
}
