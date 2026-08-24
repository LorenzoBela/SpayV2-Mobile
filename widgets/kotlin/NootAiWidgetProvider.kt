package com.cerberuzz91141.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

class NootAiWidgetProvider : AppWidgetProvider() {

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == Intent.ACTION_USER_PRESENT) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisAppWidgetComponentName = ComponentName(context.packageName, javaClass.name)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(thisAppWidgetComponentName)
            onUpdate(context, appWidgetManager, appWidgetIds)
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs: SharedPreferences = context.getSharedPreferences("spay_widget_prefs", Context.MODE_PRIVATE)
        val dataStr = prefs.getString("spay_widget_data", "") ?: ""

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_noot_ai)

            // Setup deep link to Copilot chat screen / App Launch
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                data = Uri.parse("exp+mobile://copilot")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            } ?: Intent(Intent.ACTION_VIEW, Uri.parse("exp+mobile://copilot")).apply {
                setPackage(context.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, appWidgetId, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, launchPI)
            views.setOnClickPendingIntent(R.id.txt_noot_message, launchPI)
            views.setOnClickPendingIntent(R.id.img_noot_avatar, launchPI)

            if (dataStr.isEmpty()) {
                views.setTextViewText(R.id.txt_noot_message, "Secure & Smart Payments. Tap to chat with Noot AI!")
                views.setViewVisibility(R.id.offline_dot, View.GONE)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    val isLoggedIn = root.optBoolean("isLoggedIn", false)
                    val isOffline = root.optBoolean("isOffline", false)

                    views.setViewVisibility(R.id.offline_dot, if (isOffline) View.VISIBLE else View.GONE)

                    if (!isLoggedIn) {
                        views.setTextViewText(R.id.txt_noot_message, "Please log in to chat with Noot AI.")
                    } else {
                        val nootPrompt = root.optString("nootPrompt", "").trim()
                        if (nootPrompt.isEmpty()) {
                            views.setTextViewText(R.id.txt_noot_message, "No active alerts. Have a great day!")
                        } else {
                            views.setTextViewText(R.id.txt_noot_message, nootPrompt)
                        }
                    }
                } catch (e: Exception) {
                    views.setTextViewText(R.id.txt_noot_message, "Secure & Smart Payments")
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
