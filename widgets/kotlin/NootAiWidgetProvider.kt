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

            // Setup deep link to Copilot chat screen
            val launchIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("exp+mobile://copilot")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, 4, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.txt_noot_prompt, launchPI)

            if (dataStr.isEmpty()) {
                views.setTextViewText(R.id.txt_noot_prompt, "Secure & Smart Payments. Add me to home screen!")
                views.setViewVisibility(R.id.offline_dot, View.GONE)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    val isLoggedIn = root.optBoolean("isLoggedIn", false)
                    val isOffline = root.optBoolean("isOffline", false)

                    views.setViewVisibility(R.id.offline_dot, if (isOffline) View.VISIBLE else View.GONE)

                    if (!isLoggedIn) {
                        views.setTextViewText(R.id.txt_noot_prompt, "Please log in to chat with NootAI.")
                    } else {
                        val nootPrompt = root.optString("nootPrompt", "").trim()
                        if (nootPrompt.isEmpty()) {
                            // If empty prompt, hide widget or show friendly placeholder
                            views.setTextViewText(R.id.txt_noot_prompt, "No active alerts. Have a great day!")
                        } else {
                            views.setTextViewText(R.id.txt_noot_prompt, nootPrompt)
                        }
                    }

                } catch (e: Exception) {
                    views.setTextViewText(R.id.txt_noot_prompt, "Secure & Smart Payments")
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
