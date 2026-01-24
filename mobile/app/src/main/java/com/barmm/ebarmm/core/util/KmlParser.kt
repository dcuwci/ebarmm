package com.barmm.ebarmm.core.util

import com.barmm.ebarmm.data.local.database.entity.GpsTrackEntity
import com.barmm.ebarmm.data.local.database.entity.GpsWaypoint
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import com.google.gson.Gson
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import timber.log.Timber
import java.io.File
import java.io.StringReader
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Parses legacy KML files from the old RouteShoot system.
 *
 * Legacy KML format contains GPS coordinates stored as LineString:
 * ```xml
 * <coordinates>
 *   longitude,latitude,altitude
 *   longitude,latitude,altitude
 *   ...
 * </coordinates>
 * ```
 */
@Singleton
class KmlParser @Inject constructor(
    private val gson: Gson
) {
    /**
     * Parse a KML file and return track data
     * @param kmlFile The KML file to parse
     * @param projectId The project ID to associate with the track
     * @param mediaLocalId The media (video) local ID to associate with
     * @param legacyRouteshootId Optional legacy routeshoot_id from MySQL
     * @return GpsTrackEntity ready for database insertion, or null on error
     */
    fun parseKmlFile(
        kmlFile: File,
        projectId: String,
        mediaLocalId: String,
        legacyRouteshootId: Int? = null
    ): GpsTrackEntity? {
        if (!kmlFile.exists()) {
            Timber.e("KML file not found: ${kmlFile.absolutePath}")
            return null
        }

        return try {
            val kmlContent = kmlFile.readText()
            parseKmlContent(
                kmlContent = kmlContent,
                projectId = projectId,
                mediaLocalId = mediaLocalId,
                legacyRouteshootId = legacyRouteshootId,
                originalKmlPath = kmlFile.absolutePath
            )
        } catch (e: Exception) {
            Timber.e(e, "Failed to read KML file: ${kmlFile.absolutePath}")
            null
        }
    }

    /**
     * Parse KML content string and return track data
     */
    fun parseKmlContent(
        kmlContent: String,
        projectId: String,
        mediaLocalId: String,
        legacyRouteshootId: Int? = null,
        originalKmlPath: String? = null
    ): GpsTrackEntity? {
        return try {
            val result = parseKml(kmlContent)
            if (result.waypoints.isEmpty()) {
                Timber.w("No waypoints found in KML content")
                return null
            }

            val trackId = UUID.randomUUID().toString()
            val now = System.currentTimeMillis()
            val waypointsJson = gson.toJson(result.waypoints)

            GpsTrackEntity(
                trackId = trackId,
                mediaLocalId = mediaLocalId,
                projectId = projectId,
                serverId = null,
                waypointsJson = waypointsJson,
                trackName = result.trackName ?: "Legacy Import",
                startTime = now, // Legacy doesn't have timestamps
                endTime = null,
                totalDistanceMeters = calculateTotalDistance(result.waypoints),
                waypointCount = result.waypoints.size,
                gpxFilePath = null,
                kmlFilePath = null,
                syncStatus = SyncStatus.PENDING,
                syncError = null,
                syncedAt = null,
                isLegacyImport = true,
                legacyRouteshootId = legacyRouteshootId,
                sourceFormat = GpsTrackEntity.SOURCE_FORMAT_LEGACY_KML,
                originalKmlPath = originalKmlPath,
                createdAt = now
            )
        } catch (e: Exception) {
            Timber.e(e, "Failed to parse KML content")
            null
        }
    }

    /**
     * Internal KML parsing using XmlPullParser
     */
    private fun parseKml(kmlContent: String): ParseResult {
        val waypoints = mutableListOf<GpsWaypoint>()
        var trackName: String? = null
        var inCoordinates = false
        var inName = false
        var inPlacemark = false
        var coordinatesBuilder = StringBuilder()

        try {
            val factory = XmlPullParserFactory.newInstance()
            factory.isNamespaceAware = false
            val parser = factory.newPullParser()
            parser.setInput(StringReader(kmlContent))

            var eventType = parser.eventType
            while (eventType != XmlPullParser.END_DOCUMENT) {
                when (eventType) {
                    XmlPullParser.START_TAG -> {
                        when (parser.name.lowercase()) {
                            "placemark" -> inPlacemark = true
                            "name" -> inName = true
                            "coordinates" -> {
                                inCoordinates = true
                                coordinatesBuilder = StringBuilder()
                            }
                        }
                    }
                    XmlPullParser.TEXT -> {
                        if (inName && inPlacemark && trackName == null) {
                            trackName = parser.text.trim()
                        }
                        if (inCoordinates) {
                            coordinatesBuilder.append(parser.text)
                        }
                    }
                    XmlPullParser.END_TAG -> {
                        when (parser.name.lowercase()) {
                            "placemark" -> inPlacemark = false
                            "name" -> inName = false
                            "coordinates" -> {
                                inCoordinates = false
                                // Parse the coordinates
                                val coords = coordinatesBuilder.toString().trim()
                                parseCoordinates(coords, waypoints)
                            }
                        }
                    }
                }
                eventType = parser.next()
            }
        } catch (e: Exception) {
            Timber.e(e, "Error parsing KML XML")
        }

        return ParseResult(trackName, waypoints)
    }

    /**
     * Parse coordinates string from KML
     * Format: "lon,lat,alt lon,lat,alt ..." or newline-separated
     */
    private fun parseCoordinates(coords: String, waypoints: MutableList<GpsWaypoint>) {
        // Split by whitespace (space or newline)
        val coordPairs = coords.split(Regex("\\s+"))
            .map { it.trim() }
            .filter { it.isNotEmpty() }

        for ((index, coordPair) in coordPairs.withIndex()) {
            GpsWaypoint.fromKmlCoordinate(coordPair, index)?.let { waypoint ->
                waypoints.add(waypoint)
            }
        }
    }

    /**
     * Calculate total distance from waypoints list
     */
    private fun calculateTotalDistance(waypoints: List<GpsWaypoint>): Double {
        if (waypoints.size < 2) return 0.0

        var totalDistance = 0.0
        for (i in 1 until waypoints.size) {
            val prev = waypoints[i - 1]
            val curr = waypoints[i]
            totalDistance += haversineDistance(
                prev.latitude, prev.longitude,
                curr.latitude, curr.longitude
            )
        }
        return totalDistance
    }

    /**
     * Calculate distance between two points using Haversine formula
     * @return Distance in meters
     */
    private fun haversineDistance(
        lat1: Double, lon1: Double,
        lat2: Double, lon2: Double
    ): Double {
        val earthRadiusM = 6371000.0 // Earth's radius in meters

        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)

        val a = kotlin.math.sin(dLat / 2) * kotlin.math.sin(dLat / 2) +
                kotlin.math.cos(Math.toRadians(lat1)) * kotlin.math.cos(Math.toRadians(lat2)) *
                kotlin.math.sin(dLon / 2) * kotlin.math.sin(dLon / 2)

        val c = 2 * kotlin.math.atan2(kotlin.math.sqrt(a), kotlin.math.sqrt(1 - a))

        return earthRadiusM * c
    }

    private data class ParseResult(
        val trackName: String?,
        val waypoints: List<GpsWaypoint>
    )
}
