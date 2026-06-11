package com.cerberuzz91141.mobile

import android.app.KeyguardManager
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
import java.util.Locale

class AdminExposureWidgetProvider : AppWidgetProvider() {

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

        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        val isLocked = keyguardManager.isKeyguardLocked

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_admin_exposure)

            // Setup deep link to Admin Reports
            val launchIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("exp+mobile://admin/reports")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, 50, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.exposure_progress, launchPI)

            if (dataStr.isEmpty()) {
                renderDefaultState(views, isLocked)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    val isLoggedIn = root.optBoolean("isLoggedIn", false)
                    val isOffline = root.optBoolean("isOffline", false)

                    views.setViewVisibility(R.id.offline_dot, if (isOffline) View.VISIBLE else View.GONE)

                    if (!isLoggedIn) {
                        views.setTextViewText(R.id.txt_outstanding_amount, "--")
                        views.setTextViewText(R.id.txt_efficiency_pct, "--")
                        views.setTextViewText(R.id.txt_total_cap_exposure, "Please log in.")
                        views.setProgressBar(R.id.exposure_progress, 100, 0, false)
                    } else {
                        // Gather Exposure data
                        val outstanding = root.optDouble("outstandingCapital", 0.0)
                        val efficiency = root.optDouble("collectionEfficiency", 0.0)
                        val totalCap = root.optDouble("totalExposureCap", 0.0)

                        if (isLocked) {
                            views.setTextViewText(R.id.txt_outstanding_amount, "₱*****")
                            views.setTextViewText(R.id.txt_efficiency_pct, "**%")
                            views.setTextViewText(R.id.txt_total_cap_exposure, "Total Capital Baseline Limit: ₱*****")
                            views.setProgressBar(R.id.exposure_progress, 100, 0, false)
                        } else {
                            views.setTextViewText(R.id.txt_outstanding_amount, String.format(Locale.US, "₱%,.2f", outstanding))
                            views.setTextViewText(R.id.txt_efficiency_pct, String.format(Locale.US, "%.1f%%", efficiency))
                            views.setTextViewText(R.id.txt_total_cap_exposure, String.format(Locale.US, "Total Capital Baseline Limit: ₱%,.2f", totalCap))
                            
                            val progress = Math.min(efficiency.toInt(), 100)
                            views.setProgressBar(R.id.exposure_progress, 100, progress, false)
                            
                            // Adjust efficiency color
                            if (efficiency >= 90.0) {
                                views.setTextColor(R.id.txt_efficiency_pct, 0xFF34C759.toInt()) // Green
                            } else if (efficiency >= 75.0) {
                                views.setTextColor(R.id.txt_efficiency_pct, 0xFFFFCC00.toInt()) // Yellow/Amber
                            } else {
                                views.setTextColor(R.id.txt_efficiency_pct, 0xFFFF3B30.toInt()) // Red
                            }
                        }
                    }
                } catch (e: Exception) {
                    renderDefaultState(views, isLocked)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    private fun renderDefaultState(views: RemoteViews, isLocked: Boolean) {
        views.setTextViewText(R.id.txt_outstanding_amount, if (isLocked) "₱*****" else "₱0.00")
        views.setTextViewText(R.id.txt_efficiency_pct, if (isLocked) "**%" else "0.0%")
        views.setTextViewText(R.id.txt_total_cap_exposure, if (isLocked) "Total Capital Baseline Limit: ₱*****" else "Total Capital Baseline Limit: ₱0.00")
        views.setProgressBar(R.id.exposure_progress, 100, 0, false)
    }
}
