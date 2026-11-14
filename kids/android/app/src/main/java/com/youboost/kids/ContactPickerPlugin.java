package com.youboost.kids;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Выбор одного контакта системным окном Android (ACTION_PICK).
 * Разрешение READ_CONTACTS не нужно: приложение получает только выбранный номер, и только на этот раз.
 * Номер используется, чтобы открыть SMS или WhatsApp с приглашением, и никуда не сохраняется.
 */
@CapacitorPlugin(name = "ContactPicker")
public class ContactPickerPlugin extends Plugin {

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
        startActivityForResult(call, intent, "onPicked");
    }

    @ActivityCallback
    private void onPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject out = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            out.put("cancelled", true);
            call.resolve(out);
            return;
        }
        Uri uri = result.getData().getData();
        String[] projection = {
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME
        };
        try (Cursor c = getContext().getContentResolver().query(uri, projection, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                out.put("phone", c.getString(0));
                out.put("name", c.getString(1));
            } else {
                out.put("cancelled", true);
            }
            call.resolve(out);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
