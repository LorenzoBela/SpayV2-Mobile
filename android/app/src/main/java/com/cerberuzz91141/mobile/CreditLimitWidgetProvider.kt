package com.cerberuzz91141.mobile

import android.app.KeyguardManager
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
import java.util.Locale

class CreditLimitWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs: SharedPreferences = context.getSharedPreferences("spay_widget_prefs", Context.MODE_PRIVATE)
        val dataStr = prefs.getString("spay_widget_data", "") ?: ""

        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        val isLocked = keyguardManager.isKeyguardLocked

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_credit_limit)

            // Setup deep link to dashboard
            val launchIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("exp+mobile://dashboard")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val launchPI = PendingIntent.getActivity(
                context, 3, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.card_chip, launchPI)

            // If tapped on card numbers or name, open the app
            views.setOnClickPendingIntent(R.id.txt_card_number, launchPI)
            views.setOnClickPendingIntent(R.id.txt_cardholder_name, launchPI)
            views.setOnClickPendingIntent(R.id.txt_available_credit, launchPI)

            if (dataStr.isEmpty()) {
                renderEmptyState(views, isLocked)
            } else {
                try {
                    val root = JSONObject(dataStr)
                    val isLoggedIn = root.optBoolean("isLoggedIn", false)
                    val isOffline = root.optBoolean("isOffline", false)

                    views.setViewVisibility(R.id.offline_dot, if (isOffline) View.VISIBLE else View.GONE)

                    if (!isLoggedIn) {
                        views.setTextViewText(R.id.txt_available_credit, "₱*****")
                        views.setTextViewText(R.id.txt_baseline_limit, "Global Baseline: ₱*****")
                        views.setTextViewText(R.id.txt_cardholder_name, "PLEASE LOG IN")
                        views.setProgressBar(R.id.limit_progress, 100, 0, false)
                    } else {
                        val firstName = root.optString("firstName", "S-PAY MEMBER").uppercase(Locale.US)
                        val availableCredit = root.optDouble("availableCredit", 0.0)
                        val baselineLimit = root.optDouble("baselineLimit", 0.0)

                        views.setTextViewText(R.id.txt_cardholder_name, firstName)

                        // Calculate progress percent
                        val progressPercent = if (baselineLimit > 0) {
                            ((availableCredit / baselineLimit) * 100).toInt().coerceIn(0, 100)
                        } else {
                            0
                        }
                        views.setProgressBar(R.id.limit_progress, 100, progressPercent, false)

                        // Mask numbers if locked
                        if (isLocked) {
                            views.setTextViewText(R.id.txt_available_credit, "₱*****")
                            views.setTextViewText(R.id.txt_baseline_limit, "Global Baseline: ₱*****")
                        } else {
                            views.setTextViewText(R.id.txt_available_credit, String.format(Locale.US, "₱%,.2f", availableCredit))
                            views.setTextViewText(R.id.txt_baseline_limit, String.format(Locale.US, "Global Baseline: ₱%,.2f", baselineLimit))
                        }
                    }

                } catch (e: Exception) {
                    renderEmptyState(views, isLocked)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    private fun renderEmptyState(views: RemoteViews, isLocked: Boolean) {
        views.setTextViewText(R.id.txt_available_credit, if (isLocked) "₱*****" else "₱0.00")
        views.setTextViewText(R.id.txt_baseline_limit, if (isLocked) "Global Baseline: ₱*****" else "Global Baseline: ₱0.00")
        views.setTextViewText(R.id.txt_cardholder_name, "S-PAY MEMBER")
        views.setProgressBar(R.id.limit_progress, 100, 0, false)
        views.setViewVisibility(R.id.offline_dot, View.GONE)
    }
}
