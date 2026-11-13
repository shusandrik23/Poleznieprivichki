package com.spisok.app;

import org.json.JSONException;
import org.json.JSONObject;

/** Категория (вкладка): Книги, Подкасты, Дела или любая своя. */
public class Category {
    public int id;
    public String name;

    public Category(int id, String name) {
        this.id = id;
        this.name = name;
    }

    JSONObject toJson() throws JSONException {
        JSONObject o = new JSONObject();
        o.put("id", id);
        o.put("name", name);
        return o;
    }
}
