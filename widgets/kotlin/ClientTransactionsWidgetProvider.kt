package com.cerberuzz91141.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

class ClientTransactionsWidgetProvider : AppWidgetProvider() {

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == Intent.ACTION_USER_PRESENT) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val ids = appWidgetManager.getAppWidgetIds(android.content.ComponentName(context, javaClass))
            onUpdate(context, appWidgetManager, ids)
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        updateWidget(context, appWidgetManager, appWidgetIds)
    }

    fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs: SharedPreferences = context.getSharedPreferences("spay_widget_prefs", Context.MODE_PRIVATE)
        val dataStr = prefs.getString("spay_widget_data", "") ?: ""

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_client_transactions)

            // Setup Collection Adapter
            val serviceIntent = Intent(context, SpayListWidgetService::class.java).apply {
                putExtra("list_type", "transactions")
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
            }
            views.setRemoteAdapter(R.id.widget_list_view, serviceIntent)
            views.setEmptyView(R.id.widget_list_view, R.id.txt_empty_state)

            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                data = Uri.parse("exp+mobile://transactions")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            } ?: Intent(Intent.ACTION_VIEW, Uri.parse("exp+mobile://transactions")).apply {
                setPackage(context.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, appWidgetId, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, launchPI)
            views.setOnClickPendingIntent(R.id.txt_empty_state, launchPI)

            // Pending Intent Template for Item Clicks
            val clickIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("exp+mobile://transactions")
                setPackage(context.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val clickPI = PendingIntent.getActivity(
                context, appWidgetId + 1000, clickIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )
            views.setPendingIntentTemplate(R.id.widget_list_view, clickPI)

            if (dataStr.isNotEmpty()) {
                try {
                    val root = JSONObject(dataStr)
                    val isOffline = root.optBoolean("isOffline", false)
                    views.setViewVisibility(R.id.offline_dot, if (isOffline) View.VISIBLE else View.GONE)
                } catch (e: Exception) {
                    views.setViewVisibility(R.id.offline_dot, View.GONE)
                }
            } else {
                views.setViewVisibility(R.id.offline_dot, View.GONE)
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
            appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_list_view)
        }
    }
}
