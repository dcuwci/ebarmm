/**
 * RouteShoot Viewer Component
 * Displays video with synchronized GPS track visualization on a map
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Slider from '@mui/material/Slider'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  X,
  MapPin,
  Route,
  Clock,
  Navigation,
  Film,
  Play,
  Pause,
} from 'lucide-react'
import { fetchProjectGpsTracks, formatDistance, formatDuration } from '../../api/gps-tracks'
import { format } from 'date-fns'
import type { GpsTrack, GpsWaypoint } from '../../types/gps-tracks'

// Import leaflet CSS
import 'leaflet/dist/leaflet.css'

interface RouteShootViewerProps {
  projectId: string
}

interface TrackPlayerProps {
  track: GpsTrack
  onClose: () => void
}

/**
 * Component to update map view when position changes
 */
function MapPositionUpdater({ position }: { position: [number, number] | null }) {
  const map = useMap()

  useEffect(() => {
    if (position) {
      map.panTo(position, { animate: true, duration: 0.3 })
    }
  }, [map, position])

  return null
}

/**
 * Track Player Dialog - Video with synchronized map
 */
function TrackPlayer({ track, onClose }: TrackPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Get waypoints array
  const waypoints: GpsWaypoint[] = track.waypoints || []

  // Calculate polyline points
  const polylinePoints: [number, number][] = waypoints.map(wp => [wp.latitude, wp.longitude])

  // Get current waypoint
  const currentWaypoint = waypoints[currentWaypointIndex]
  const currentPosition: [number, number] | null = currentWaypoint
    ? [currentWaypoint.latitude, currentWaypoint.longitude]
    : null

  // Calculate map bounds
  const bounds = polylinePoints.length > 0
    ? L.latLngBounds(polylinePoints)
    : null

  // Start/end points
  const startPoint = polylinePoints[0]
  const endPoint = polylinePoints[polylinePoints.length - 1]

  // Handle video time update
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return

    setCurrentTime(videoRef.current.currentTime)

    if (waypoints.length === 0) return

    const currentTimeMs = videoRef.current.currentTime * 1000

    // Find waypoint closest to current video time
    let closestIndex = 0
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i]
      if (wp.video_offset_ms && wp.video_offset_ms <= currentTimeMs) {
        closestIndex = i
      } else if (wp.video_offset_ms && wp.video_offset_ms > currentTimeMs) {
        break
      }
    }

    setCurrentWaypointIndex(closestIndex)
  }, [waypoints])

  // Handle duration loaded
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }, [])

  // Handle seek bar change
  const handleSeek = useCallback((_event: Event, newValue: number | number[]) => {
    if (videoRef.current && typeof newValue === 'number') {
      videoRef.current.currentTime = newValue
      setCurrentTime(newValue)
    }
  }, [])

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
    }
  }, [isPlaying])

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: { height: '90vh', maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Route size={24} />
          <Box>
            <Typography variant="h6">{track.track_name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {track.waypoint_count} waypoints &bull; {formatDistance(track.total_distance_meters)}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose}>
          <X size={24} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        <Grid container sx={{ height: '100%' }}>
          {/* Video Section */}
          <Grid item xs={12} md={6} sx={{ height: { xs: '40%', md: '100%' }, borderRight: 1, borderColor: 'divider' }}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'grey.900' }}>
              {track.video_url ? (
                <>
                  <Box
                    component="video"
                    ref={videoRef}
                    src={track.video_url}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onClick={togglePlayPause}
                    sx={{
                      width: '100%',
                      flex: 1,
                      minHeight: 0,
                      objectFit: 'contain',
                      bgcolor: 'black',
                      cursor: 'pointer'
                    }}
                  />
                  {/* Custom seek bar */}
                  <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.800', flexShrink: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <IconButton onClick={togglePlayPause} size="small" sx={{ color: 'white' }}>
                        {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                      </IconButton>
                      <Typography variant="body2" sx={{ color: 'grey.300', minWidth: 50, fontFamily: 'monospace' }}>
                        {formatTime(currentTime)}
                      </Typography>
                      <Slider
                        value={currentTime}
                        max={duration || 100}
                        onChange={handleSeek}
                        sx={{
                          flex: 1,
                          color: 'primary.main',
                          '& .MuiSlider-thumb': {
                            width: 16,
                            height: 16,
                          },
                          '& .MuiSlider-track': {
                            height: 6,
                          },
                          '& .MuiSlider-rail': {
                            height: 6,
                            bgcolor: 'grey.600',
                          },
                        }}
                      />
                      <Typography variant="body2" sx={{ color: 'grey.300', minWidth: 50, fontFamily: 'monospace' }}>
                        {formatTime(duration)}
                      </Typography>
                    </Box>
                  </Box>
                </>
              ) : (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'grey.500' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Film size={48} />
                    <Typography sx={{ mt: 2 }}>No video associated with this track</Typography>
                  </Box>
                </Box>
              )}

              {/* GPS Info Bar */}
              <Paper sx={{ p: 2, borderRadius: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MapPin size={18} />
                    {currentWaypoint ? (
                      <Typography variant="body2" fontFamily="monospace">
                        {currentWaypoint.latitude.toFixed(5)}, {currentWaypoint.longitude.toFixed(5)}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">No GPS data</Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {currentWaypoint?.altitude && (
                      <Chip
                        size="small"
                        icon={<Navigation size={14} />}
                        label={`${currentWaypoint.altitude.toFixed(1)}m`}
                      />
                    )}
                    <Chip
                      size="small"
                      label={`${currentWaypointIndex + 1} / ${waypoints.length}`}
                      color="primary"
                    />
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Grid>

          {/* Map Section */}
          <Grid item xs={12} md={6} sx={{ height: { xs: '60%', md: '100%' } }}>
            <Box sx={{ height: '100%', position: 'relative' }}>
              {polylinePoints.length > 0 ? (
                <MapContainer
                  bounds={bounds || undefined}
                  boundsOptions={{ padding: [30, 30], maxZoom: 16 }}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom
                  maxZoom={22}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    maxZoom={19}
                    maxNativeZoom={19}
                  />

                  {/* Track polyline */}
                  <Polyline
                    positions={polylinePoints}
                    pathOptions={{ color: '#2196F3', weight: 4, opacity: 0.8 }}
                  />

                  {/* Start marker (green) */}
                  {startPoint && (
                    <CircleMarker
                      center={startPoint}
                      radius={8}
                      pathOptions={{ fillColor: '#4CAF50', fillOpacity: 1, color: 'white', weight: 2 }}
                    />
                  )}

                  {/* End marker (red) */}
                  {endPoint && polylinePoints.length > 1 && (
                    <CircleMarker
                      center={endPoint}
                      radius={8}
                      pathOptions={{ fillColor: '#F44336', fillOpacity: 1, color: 'white', weight: 2 }}
                    />
                  )}

                  {/* Current position marker (orange, larger) */}
                  {currentPosition && (
                    <CircleMarker
                      center={currentPosition}
                      radius={12}
                      pathOptions={{ fillColor: '#FF9800', fillOpacity: 1, color: 'white', weight: 3 }}
                    />
                  )}

                  <MapPositionUpdater position={isPlaying ? currentPosition : null} />
                </MapContainer>
              ) : (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.100' }}>
                  <Typography color="text.secondary">No GPS waypoints available</Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Main RouteShoot Viewer Component - Shows list of tracks
 */
export default function RouteShootViewer({ projectId }: RouteShootViewerProps) {
  const [selectedTrack, setSelectedTrack] = useState<GpsTrack | null>(null)

  // Fetch GPS tracks
  const { data: tracks, isLoading, error } = useQuery({
    queryKey: ['gpsTracks', projectId],
    queryFn: () => fetchProjectGpsTracks(projectId),
  })

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading GPS tracks. Please try again.
      </Alert>
    )
  }

  if (!tracks?.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
        <Route size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
        <Typography>No RouteShoot recordings yet.</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Record GPS tracks with video using the mobile app.
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      <List>
        {tracks.map((track, index) => (
          <Box key={track.track_id}>
            {index > 0 && <Divider />}
            <ListItem disablePadding>
              <ListItemButton onClick={() => setSelectedTrack(track)}>
                <ListItemIcon>
                  <Route size={24} />
                </ListItemIcon>
                <ListItemText
                  primary={track.track_name}
                  secondary={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <MapPin size={14} />
                        {track.waypoint_count} waypoints
                      </Box>
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Navigation size={14} />
                        {formatDistance(track.total_distance_meters)}
                      </Box>
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Clock size={14} />
                        {formatDuration(track.start_time, track.end_time)}
                      </Box>
                    </Box>
                  }
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {track.video_url && (
                    <Chip size="small" icon={<Film size={14} />} label="Video" />
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {format(new Date(track.created_at), 'MMM dd, yyyy')}
                  </Typography>
                </Box>
              </ListItemButton>
            </ListItem>
          </Box>
        ))}
      </List>

      {/* Track Player Dialog */}
      {selectedTrack && (
        <TrackPlayer
          track={selectedTrack}
          onClose={() => setSelectedTrack(null)}
        />
      )}
    </Box>
  )
}
