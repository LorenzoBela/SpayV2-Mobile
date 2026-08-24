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

            // Setup deep link to Admin Reports / App Launch
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
            views.setOnClickPendingIntent(R.id.txt_outstanding_exposure, launchPI)
            views.setOnClickPendingIntent(R.id.txt_exposure_limit, launchPI)
            views.setOnClickPendingIntent(R.id.exposure_progress, launchPI)

            if (dataStr.isEmpty()) {
                renderDefaultState(views, isLocked, launchPI)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    val isLoggedIn = root.optBoolean("isLoggedIn", false)
                    val isOffline = root.optBoolean("isOffline", false)

                    views.setViewVisibility(R.id.offline_dot, if (isOffline) View.VISIBLE else View.GONE)

                    if (!isLoggedIn) {
                        views.setTextViewText(R.id.txt_outstanding_exposure, "--")
                        views.setTextViewText(R.id.txt_exposure_limit, "Please log in.")
                        views.setProgressBar(R.id.exposure_progress, 100, 0, false)
                    } else {
                        val outstanding = root.optDouble("outstandingCapital", 0.0)
                        val totalCap = root.optDouble("totalExposureCap", 0.0)
                        val efficiency = root.optDouble("collectionEfficiency", 0.0)

                        if (isLocked) {
                            views.setTextViewText(R.id.txt_outstanding_exposure, "₱*****")
                            views.setTextViewText(R.id.txt_exposure_limit, "Exposure Cap: ₱*****")
                            views.setProgressBar(R.id.exposure_progress, 100, 0, false)
                        } else {
                            views.setTextViewText(R.id.txt_outstanding_exposure, String.format(Locale.US, "₱%,.2f", outstanding))
                            views.setTextViewText(R.id.txt_exposure_limit, String.format(Locale.US, "Exposure Cap: ₱%,.2f", totalCap))
                            
                            val progress = if (totalCap > 0) {
                                ((outstanding / totalCap) * 100).toInt().coerceIn(0, 100)
                            } else {
                                0
                            }
                            views.setProgressBar(R.id.exposure_progress, 100, progress, false)
                        }
                    }
                } catch (e: Exception) {
                    renderDefaultState(views, isLocked, launchPI)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    private fun renderDefaultState(views: RemoteViews, isLocked: Boolean, launchPI: PendingIntent) {
        views.setTextViewText(R.id.txt_outstanding_exposure, if (isLocked) "₱*****" else "₱0.00")
        views.setTextViewText(R.id.txt_exposure_limit, if (isLocked) "Exposure Cap: ₱*****" else "Exposure Cap: ₱0.00")
        views.setProgressBar(R.id.exposure_progress, 100, 0, false)
        views.setOnClickPendingIntent(R.id.widget_root, launchPI)
    }
}
