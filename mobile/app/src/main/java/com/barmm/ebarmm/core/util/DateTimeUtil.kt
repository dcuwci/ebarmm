package com.barmm.ebarmm.core.util

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object DateTimeUtil {
    private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
    private val displayFormat = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.US)
    private val dateOnlyFormat = SimpleDateFormat("MMM dd, yyyy", Locale.US)

    fun parseIsoToMillis(isoString: String): Long {
        return try {
            isoFormat.parse(isoString)?.time ?: 0L
        } catch (e: Exception) {
            0L
        }
    }

    fun formatMillisToDisplay(millis: Long): String {
        return displayFormat.format(Date(millis))
    }

    fun formatMillisToDate(millis: Long): String {
        return dateOnlyFormat.format(Date(millis))
    }

    fun getCurrentMillis(): Long = System.currentTimeMillis()
}
