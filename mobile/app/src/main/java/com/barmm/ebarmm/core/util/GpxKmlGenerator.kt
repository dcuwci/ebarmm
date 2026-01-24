package com.barmm.ebarmm.core.util

import android.content.Context
import com.barmm.ebarmm.data.local.database.entity.GpsTrackEntity
import com.barmm.ebarmm.data.local.database.entity.GpsWaypoint
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.qualifiers.ApplicationContext
import timber.log.Timber
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Generates GPX and KML files from GPS track data.
 * Supports both new recordings and export of imported tracks.
 */
@Singleton
class GpxKmlGenerator @Inject constructor(
    @ApplicationContext private val context: Context,
    private val gson: Gson
) {
    private val isoDateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    /**
     * Generate GPX file from track entity
     * @param track The GPS track entity
     * @return File path to generated GPX file, or null on error
     */
    fun generateGpx(track: GpsTrackEntity): String? {
        return try {
            val waypoints = parseWaypointsJson(track.waypointsJson)
            if (waypoints.isEmpty()) {
                Timber.w("Cannot generate GPX: no waypoints")
                return null
            }

            val gpxContent = buildGpxContent(track, waypoints)
            val fileName = "track_${track.trackId}.gpx"
            val file = File(getExportDir(), fileName)
            file.writeText(gpxContent)

            Timber.d("Generated GPX file: ${file.absolutePath}")
            file.absolutePath
        } catch (e: Exception) {
            Timber.e(e, "Failed to generate GPX file")
            null
        }
    }

    /**
     * Generate KML file from track entity
     * @param track The GPS track entity
     * @return File path to generated KML file, or null on error
     */
    fun generateKml(track: GpsTrackEntity): String? {
        return try {
            val waypoints = parseWaypointsJson(track.waypointsJson)
            if (waypoints.isEmpty()) {
                Timber.w("Cannot generate KML: no waypoints")
                return null
            }

            val kmlContent = buildKmlContent(track, waypoints)
            val fileName = "track_${track.trackId}.kml"
            val file = File(getExportDir(), fileName)
            file.writeText(kmlContent)

            Timber.d("Generated KML file: ${file.absolutePath}")
            file.absolutePath
        } catch (e: Exception) {
            Timber.e(e, "Failed to generate KML file")
            null
        }
    }

    /**
     * Generate both GPX and KML files
     * @param track The GPS track entity
     * @return Pair of (gpxPath, kmlPath), either may be null on error
     */
    fun generateBoth(track: GpsTrackEntity): Pair<String?, String?> {
        return Pair(generateGpx(track), generateKml(track))
    }

    private fun buildGpxContent(track: GpsTrackEntity, waypoints: List<GpsWaypoint>): String {
        val sb = StringBuilder()
        sb.appendLine("""<?xml version="1.0" encoding="UTF-8"?>""")
        sb.appendLine("""<gpx version="1.1" creator="E-BARMM Mobile App"
            |  xmlns="http://www.topografix.com/GPX/1/1"
            |  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            |  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">""".trimMargin())

        // Metadata
        sb.appendLine("  <metadata>")
        sb.appendLine("    <name>${escapeXml(track.trackName)}</name>")
        sb.appendLine("    <time>${isoDateFormat.format(Date(track.startTime))}</time>")
        sb.appendLine("  </metadata>")

        // Track
        sb.appendLine("  <trk>")
        sb.appendLine("    <name>${escapeXml(track.trackName)}</name>")
        sb.appendLine("    <trkseg>")

        for (waypoint in waypoints) {
            sb.append("      <trkpt lat=\"${waypoint.latitude}\" lon=\"${waypoint.longitude}\">")
            waypoint.altitude?.let { sb.append("<ele>$it</ele>") }
            if (waypoint.timestamp > 0) {
                sb.append("<time>${isoDateFormat.format(Date(waypoint.timestamp))}</time>")
            }
            waypoint.speed?.let { sb.append("<speed>$it</speed>") }
            sb.appendLine("</trkpt>")
        }

        sb.appendLine("    </trkseg>")
        sb.appendLine("  </trk>")
        sb.appendLine("</gpx>")

        return sb.toString()
    }

    private fun buildKmlContent(track: GpsTrackEntity, waypoints: List<GpsWaypoint>): String {
        val sb = StringBuilder()
        sb.appendLine("""<?xml version="1.0" encoding="UTF-8"?>""")
        sb.appendLine("""<kml xmlns="http://www.opengis.net/kml/2.2">""")
        sb.appendLine("  <Document>")
        sb.appendLine("    <name>${escapeXml(track.trackName)}</name>")
        sb.appendLine("    <description>GPS track recorded with E-BARMM Mobile App</description>")

        // Style for the line
        sb.appendLine("    <Style id=\"trackStyle\">")
        sb.appendLine("      <LineStyle>")
        sb.appendLine("        <color>ff0000ff</color>")
        sb.appendLine("        <width>4</width>")
        sb.appendLine("      </LineStyle>")
        sb.appendLine("    </Style>")

        // Placemark with LineString
        sb.appendLine("    <Placemark>")
        sb.appendLine("      <name>${escapeXml(track.trackName)}</name>")
        sb.appendLine("      <styleUrl>#trackStyle</styleUrl>")
        sb.appendLine("      <LineString>")
        sb.appendLine("        <tessellate>1</tessellate>")
        sb.appendLine("        <altitudeMode>clampToGround</altitudeMode>")
        sb.appendLine("        <coordinates>")

        val coordinates = waypoints.joinToString("\n          ") { it.toKmlCoordinate() }
        sb.appendLine("          $coordinates")

        sb.appendLine("        </coordinates>")
        sb.appendLine("      </LineString>")
        sb.appendLine("    </Placemark>")

        // Add start and end markers
        if (waypoints.isNotEmpty()) {
            val start = waypoints.first()
            val end = waypoints.last()

            sb.appendLine("    <Placemark>")
            sb.appendLine("      <name>Start</name>")
            sb.appendLine("      <Point>")
            sb.appendLine("        <coordinates>${start.toKmlCoordinate()}</coordinates>")
            sb.appendLine("      </Point>")
            sb.appendLine("    </Placemark>")

            if (waypoints.size > 1) {
                sb.appendLine("    <Placemark>")
                sb.appendLine("      <name>End</name>")
                sb.appendLine("      <Point>")
                sb.appendLine("        <coordinates>${end.toKmlCoordinate()}</coordinates>")
                sb.appendLine("      </Point>")
                sb.appendLine("    </Placemark>")
            }
        }

        sb.appendLine("  </Document>")
        sb.appendLine("</kml>")

        return sb.toString()
    }

    private fun parseWaypointsJson(json: String): List<GpsWaypoint> {
        return try {
            val type = object : TypeToken<List<GpsWaypoint>>() {}.type
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            Timber.e(e, "Failed to parse waypoints JSON")
            emptyList()
        }
    }

    private fun getExportDir(): File {
        val dir = File(context.filesDir, "gps_exports")
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    private fun escapeXml(text: String): String {
        return text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&apos;")
    }
}
