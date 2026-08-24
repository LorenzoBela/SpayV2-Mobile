package com.cerberuzz91141.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.util.Locale

class AdminCountdownWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        updateWidget(context, appWidgetManager, appWidgetIds)
    }

    fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs: SharedPreferences = context.getSharedPreferences("spay_widget_prefs", Context.MODE_PRIVATE)
        val dataStr = prefs.getString("spay_widget_data", "") ?: ""

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_admin_countdown)

            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                data = Uri.parse("exp+mobile://admin")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            } ?: Intent(Intent.ACTION_VIEW, Uri.parse("exp+mobile://admin")).apply {
                setPackage(context.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, appWidgetId, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, launchPI)

            if (dataStr.isEmpty()) {
                views.setTextViewText(R.id.txt_days, "00")
                views.setTextViewText(R.id.txt_hours, "00")
                views.setTextViewText(R.id.txt_minutes, "00")
                views.setTextViewText(R.id.txt_seconds, "00")
                views.setTextViewText(R.id.txt_pending_receipts, "0")
                views.setTextViewText(R.id.txt_overdue_accounts, "0")
                views.setViewVisibility(R.id.chronometer, View.GONE)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    val targetTimestamp = root.optLong("adminTargetTimestamp", 0L)
                    val pendingReceipts = root.optInt("pendingReceiptsCount", 0)
                    val overdueAccounts = root.optInt("overdueAccountsCount", 0)

                    views.setTextViewText(R.id.txt_pending_receipts, pendingReceipts.toString())
                    views.setTextViewText(R.id.txt_overdue_accounts, overdueAccounts.toString())

                    val now = System.currentTimeMillis()
                    if (targetTimestamp > 0L && targetTimestamp > now) {
                        val diffMs = targetTimestamp - now
                        val days = (diffMs / (1000 * 60 * 60 * 24)).toInt()
                        val hours = ((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)).toInt()
                        val minutes = ((diffMs % (1000 * 60 * 60)) / (1000 * 60)).toInt()
                        val seconds = ((diffMs % (1000 * 60)) / 1000).toInt()

                        views.setTextViewText(R.id.txt_days, String.format(Locale.US, "%02d", days))
                        views.setTextViewText(R.id.txt_hours, String.format(Locale.US, "%02d", hours))
                        views.setTextViewText(R.id.txt_minutes, String.format(Locale.US, "%02d", minutes))
                        views.setTextViewText(R.id.txt_seconds, String.format(Locale.US, "%02d", seconds))

                        val baseTime = SystemClock.elapsedRealtime() + diffMs
                        views.setChronometer(R.id.chronometer, baseTime, null, true)
                        views.setViewVisibility(R.id.chronometer, View.VISIBLE)
                    } else {
                        views.setTextViewText(R.id.txt_days, "00")
                        views.setTextViewText(R.id.txt_hours, "00")
                        views.setTextViewText(R.id.txt_minutes, "00")
                        views.setTextViewText(R.id.txt_seconds, "00")
                        views.setViewVisibility(R.id.chronometer, View.GONE)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
