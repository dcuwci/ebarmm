package com.barmm.ebarmm.data.local.database.entity

/**
 * Represents a single GPS waypoint captured during RouteShoot recording.
 * Used both for new recordings and imported legacy KML data.
 */
data class GpsWaypoint(
    /** Latitude in decimal degrees (WGS84) */
    val latitude: Double,

    /** Longitude in decimal degrees (WGS84) */
    val longitude: Double,

    /** Altitude in meters above sea level (optional) */
    val altitude: Double? = null,

    /** GPS accuracy in meters (0 for legacy imports) */
    val accuracy: Float = 0f,

    /** Speed in meters per second (optional) */
    val speed: Float? = null,

    /** Bearing/heading in degrees (optional) */
    val bearing: Float? = null,

    /** Timestamp when this waypoint was captured (epoch millis) */
    val timestamp: Long = 0L,

    /** Time offset from video start in milliseconds */
    val videoOffsetMs: Long = 0L
) {
    companion object {
        /**
         * Create waypoint from legacy KML coordinates string.
         * Format: "longitude,latitude,altitude" or "longitude,latitude"
         */
        fun fromKmlCoordinate(coordinate: String, index: Int = 0): GpsWaypoint? {
            val parts = coordinate.trim().split(",")
            if (parts.size < 2) return null

            val longitude = parts[0].toDoubleOrNull() ?: return null
            val latitude = parts[1].toDoubleOrNull() ?: return null
            val altitude = parts.getOrNull(2)?.toDoubleOrNull()

            return GpsWaypoint(
                latitude = latitude,
                longitude = longitude,
                altitude = altitude,
                accuracy = 0f,  // Legacy doesn't have accuracy
                timestamp = 0L, // Legacy doesn't have timestamps
                videoOffsetMs = 0L
            )
        }
    }

    /**
     * Convert to KML coordinate format: "longitude,latitude,altitude"
     */
    fun toKmlCoordinate(): String {
        return if (altitude != null) {
            "$longitude,$latitude,$altitude"
        } else {
            "$longitude,$latitude,0"
        }
    }

    /**
     * Convert to GPX trackpoint format
     */
    fun toGpxTrackpoint(indent: String = "      "): String {
        val sb = StringBuilder()
        sb.append("$indent<trkpt lat=\"$latitude\" lon=\"$longitude\">")
        altitude?.let { sb.append("<ele>$it</ele>") }
        if (timestamp > 0) {
            val isoTime = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }.format(java.util.Date(timestamp))
            sb.append("<time>$isoTime</time>")
        }
        sb.append("</trkpt>")
        return sb.toString()
    }
}
