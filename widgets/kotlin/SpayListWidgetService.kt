package com.cerberuzz91141.mobile

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

class SpayListWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        val listType = intent.getStringExtra("list_type") ?: "transactions"
        return SpayListRemoteViewsFactory(this.applicationContext, listType)
    }
}

class SpayListRemoteViewsFactory(
    private val context: Context,
    private val listType: String
) : RemoteViewsService.RemoteViewsFactory {

    private var itemsList = mutableListOf<JSONObject>()
    private var isLocked = false
    private var isLoggedIn = false

    override fun onCreate() {
        loadData()
    }

    override fun onDataSetChanged() {
        // Runs synchronously on background Binder thread
        loadData()
    }

    private fun loadData() {
        itemsList.clear()
        val prefs: SharedPreferences = context.getSharedPreferences("spay_widget_prefs", Context.MODE_PRIVATE)
        val dataStr = prefs.getString("spay_widget_data", "") ?: ""

        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        isLocked = keyguardManager?.isKeyguardLocked ?: false

        if (dataStr.isEmpty()) {
            isLoggedIn = false
            return
        }

        try {
            val root = JSONObject(dataStr)
            isLoggedIn = root.optBoolean("isLoggedIn", false)
            if (!isLoggedIn) return

            val arrayKey = when (listType) {
                "transactions" -> "recentTransactions"
                "upcoming" -> "upcomingInstallments"
                "inbox" -> "notifications"
                "audit" -> "adminAuditLogs"
                "reminders" -> "adminReminders"
                else -> "recentTransactions"
            }

            val jsonArray: JSONArray? = root.optJSONArray(arrayKey)
            if (jsonArray != null) {
                val count = Math.min(jsonArray.length(), 50) // Bound to 50 items (NASA Rule 2)
                for (i in 0 until count) {
                    itemsList.add(jsonArray.getJSONObject(i))
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun getCount(): Int = itemsList.size

    override fun getViewAt(position: Int): RemoteViews? {
        if (position < 0 || position >= itemsList.size) return null
        val item = itemsList[position]

        return try {
            when (listType) {
                "transactions" -> createTransactionRow(item)
                "upcoming" -> createUpcomingRow(item)
                "inbox" -> createInboxRow(item)
                "audit" -> createAuditRow(item)
                "reminders" -> createReminderRow(item)
                else -> createTransactionRow(item)
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun createTransactionRow(item: JSONObject): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.item_widget_transaction_row)
        val desc = item.optString("desc", "Repayment")
        val date = item.optString("date", "--/--")
        val amount = item.optDouble("amount", 0.0)
        val status = item.optString("status", "Verified")

        views.setTextViewText(R.id.txt_item_date, date)
        views.setTextViewText(R.id.txt_item_desc, desc)
        views.setTextViewText(R.id.txt_item_status, status)

        if (status.equals("Verified", ignoreCase = true)) {
            views.setTextColor(R.id.txt_item_status, 0xFF10B981.toInt())
        } else {
            views.setTextColor(R.id.txt_item_status, 0xFFF59E0B.toInt())
        }

        if (isLocked) {
            views.setTextViewText(R.id.txt_item_amount, "₱*****")
        } else {
            views.setTextViewText(R.id.txt_item_amount, String.format(Locale.US, "₱%,.2f", amount))
        }

        // Fill-in Intent for deep-linking item taps
        val fillInIntent = Intent()
        views.setOnClickFillInIntent(R.id.txt_item_desc, fillInIntent)
        return views
    }

    private fun createUpcomingRow(item: JSONObject): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.item_widget_upcoming_row)
        val desc = item.optString("desc", "Installment Payment")
        val dueInfo = item.optString("dueInfo", "Due soon")
        val amount = item.optDouble("amount", 0.0)
        val isOverdue = item.optBoolean("isOverdue", false)

        views.setTextViewText(R.id.txt_item_desc, desc)
        views.setTextViewText(R.id.txt_item_due_info, dueInfo)

        if (isOverdue) {
            views.setTextColor(R.id.txt_item_due_info, 0xFFEF4444.toInt())
        } else {
            views.setTextColor(R.id.txt_item_due_info, 0xFF94A3B8.toInt())
        }

        if (isLocked) {
            views.setTextViewText(R.id.txt_item_amount, "₱*****")
        } else {
            views.setTextViewText(R.id.txt_item_amount, String.format(Locale.US, "₱%,.2f", amount))
        }

        val fillInIntent = Intent()
        views.setOnClickFillInIntent(R.id.txt_item_desc, fillInIntent)
        return views
    }

    private fun createInboxRow(item: JSONObject): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.item_widget_inbox_row)
        val title = item.optString("title", "Notification")
        val body = item.optString("body", "")
        val time = item.optString("time", "")

        views.setTextViewText(R.id.txt_item_time, time)

        if (isLocked) {
            views.setTextViewText(R.id.txt_item_title, "Notification")
            views.setTextViewText(R.id.txt_item_body, "Unlock device to view message preview")
        } else {
            views.setTextViewText(R.id.txt_item_title, title)
            views.setTextViewText(R.id.txt_item_body, body)
        }

        val fillInIntent = Intent()
        views.setOnClickFillInIntent(R.id.txt_item_title, fillInIntent)
        return views
    }

    private fun createAuditRow(item: JSONObject): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.item_widget_audit_row)
        val message = item.optString("message", "Activity logged")
        val time = item.optString("time", "")

        views.setTextViewText(R.id.txt_item_time, time)
        views.setTextViewText(R.id.txt_item_message, message)

        val fillInIntent = Intent()
        views.setOnClickFillInIntent(R.id.txt_item_message, fillInIntent)
        return views
    }

    private fun createReminderRow(item: JSONObject): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.item_widget_reminder_row)
        val title = item.optString("title", "Reminder")
        val body = item.optString("body", "")
        val priority = item.optString("priority", "medium")

        views.setTextViewText(R.id.txt_item_title, title)
        views.setTextViewText(R.id.txt_item_body, body)

        when (priority.lowercase()) {
            "high" -> views.setImageViewResource(R.id.img_priority_dot, R.drawable.priority_dot_amber)
            "low" -> views.setImageViewResource(R.id.img_priority_dot, R.drawable.priority_dot_green)
            else -> views.setImageViewResource(R.id.img_priority_dot, R.drawable.priority_dot_amber)
        }

        val fillInIntent = Intent()
        views.setOnClickFillInIntent(R.id.txt_item_title, fillInIntent)
        return views
    }

    override fun getLoadingView(): RemoteViews? = null
    override fun getViewTypeCount(): Int = 5
    override fun getItemId(position: Int): Long = position.toLong()
    override fun hasStableIds(): Boolean = true
    override fun onDestroy() {
        itemsList.clear()
    }
}
