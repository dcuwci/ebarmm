# React Frontend Design

> **Note:** This document describes the frontend architecture. As of 2026-01-04, all core frontend CRUD pages are implemented using Material-UI (MUI) and Leaflet for GIS editing. Settings pages for User Management, Groups, Access Rights, and Audit Logs are also implemented. MFA (Multi-Factor Authentication) is supported via the MFASetupWizard component.

## 1. APPLICATION ARCHITECTURE

### 1.1 Technology Stack

**Core:**
- React 18+ (TypeScript)
- Vite (build tool)
- React Router v6 (routing)
- TanStack Query (React Query) (API state)
- Zustand (client state)

**UI Framework:**
- Material-UI (MUI) 7.x (primary component library)
- Tailwind CSS (utility styling)
- Lucide React (icons)

**GIS:**
- Leaflet + react-leaflet (map rendering)
- react-leaflet-draw + leaflet-draw (geometry editing)
- wellknown (WKT parsing)

**Forms & Validation:**
- React Hook Form
- Zod (validation schema)

---

### 1.2 Project Structure

```
frontend/
├── public/
│   └── assets/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   │   ├── public/
│   │   │   ├── Landing.tsx
│   │   │   ├── PublicPortal.tsx
│   │   │   ├── PublicMap.tsx
│   │   │   └── ProjectDetails.tsx
│   │   ├── admin/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ProjectList.tsx
│   │   │   ├── ProjectDetail.tsx
│   │   │   ├── ProjectForm.tsx
│   │   │   ├── GISEditor.tsx
│   │   │   ├── ProgressReport.tsx
│   │   │   ├── Profile.tsx
│   │   │   └── settings/
│   │   │       ├── UsersSettings.tsx
│   │   │       ├── GroupsSettings.tsx
│   │   │       ├── AccessRightsSettings.tsx
│   │   │       └── AuditLogs.tsx
│   │   └── auth/
│   │       └── Login.tsx
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Table.tsx
│   │   ├── auth/
│   │   │   └── MFASetupWizard.tsx
│   │   ├── map/
│   │   │   ├── MapView.tsx
│   │   │   ├── DrawControl.tsx
│   │   │   └── FeaturePopup.tsx
│   │   ├── project/
│   │   │   ├── ProgressTimeline.tsx
│   │   │   ├── MediaGallery.tsx
│   │   │   └── ProjectCard.tsx
│   │   ├── media/
│   │   │   ├── MediaGallery.tsx
│   │   │   └── MediaUpload.tsx
│   │   ├── progress/
│   │   │   └── ProgressTimeline.tsx
│   │   └── layout/
│   │       ├── AdminLayout.tsx
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── ProtectedRoute.tsx
│   ├── hooks/
│   │   ├── useProjects.ts
│   │   ├── useAuth.ts
│   │   ├── useGISFeatures.ts
│   │   └── useMediaUpload.ts
│   ├── api/
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── projects.ts
│   │   ├── gis.ts
│   │   └── media.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   └── mapStore.ts
│   ├── types/
│   │   ├── project.ts
│   │   ├── gis.ts
│   │   └── user.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   └── validators.ts
│   └── styles/
│       └── globals.css
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 2. ROUTING STRUCTURE

### 2.1 Public Routes (No Authentication)

```typescript
// src/routes/index.tsx
import { createBrowserRouter } from 'react-router-dom';

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      {
        index: true,
        element: <PublicPortal />
      },
      {
        path: 'map',
        element: <PublicMap />
      },
      {
        path: 'projects/:projectId',
        element: <ProjectDetails />
      }
    ]
  },

  // Auth routes
  {
    path: '/login',
    element: <Login />
  },

  // Protected admin routes
  {
    path: '/admin',
    element: <ProtectedRoute allowedRoles={['deo_user', 'regional_admin', 'super_admin']} />,
    children: [
      {
        index: true,
        element: <Dashboard />
      },
      {
        path: 'projects',
        element: <ProjectList />
      },
      {
        path: 'projects/new',
        element: <ProjectForm />
      },
      {
        path: 'projects/:projectId',
        element: <ProjectDetail />
      },
      {
        path: 'projects/:projectId/edit',
        element: <ProjectForm />
      },
      {
        path: 'projects/:projectId/gis',
        element: <GISEditor />
      },
      {
        path: 'projects/:projectId/progress',
        element: <ProgressReport />
      },
      {
        path: 'profile',
        element: <Profile />
      },
      {
        path: 'settings/users',
        element: <UsersSettings />
      },
      {
        path: 'settings/groups',
        element: <GroupsSettings />
      },
      {
        path: 'settings/access-rights',
        element: <AccessRightsSettings />
      },
      {
        path: 'settings/audit-logs',
        element: <AuditLogs />
      }
    ]
  }
]);
```

---

## 3. COMPONENT DESIGNS

### 3.1 Public Portal (`PublicPortal.tsx`)

**Purpose:** Landing page for transparency portal

**Features:**
- Statistics dashboard
- Recent projects list
- Search and filter
- Link to interactive map

**Layout:**
```typescript
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicAPI } from '@/api/public';
import ProjectCard from '@/components/project/ProjectCard';
import Stats from '@/components/dashboard/Stats';

export default function PublicPortal() {
  const { data: stats } = useQuery({
    queryKey: ['public-stats'],
    queryFn: publicAPI.getStats
  });

  const { data: projects, isLoading } = useQuery({
    queryKey: ['public-projects', { limit: 10 }],
    queryFn: () => publicAPI.getProjects({ limit: 10 })
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-blue-900 text-white py-20">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold mb-4">
            E-BARMM Transparency Portal
          </h1>
          <p className="text-xl">
            Public Works Projects in Bangsamoro Autonomous Region
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Projects"
            value={stats?.total_projects}
            icon="Briefcase"
          />
          <StatCard
            title="Total Investment"
            value={formatCurrency(stats?.total_cost)}
            icon="DollarSign"
          />
          <StatCard
            title="Avg Completion"
            value={`${stats?.avg_completion}%`}
            icon="TrendingUp"
          />
          <StatCard
            title="Ongoing Projects"
            value={stats?.by_status.ongoing}
            icon="Clock"
          />
        </div>
      </section>

      {/* Recent Projects */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold mb-8">Recent Projects</h2>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {projects?.items.map(project => (
              <ProjectCard key={project.project_id} project={project} />
            ))}
          </div>
        )}
      </section>

      {/* Map Preview */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold mb-8">Interactive Map</h2>
        <div className="h-96 bg-gray-200 rounded-lg">
          <MapPreview />
        </div>
        <div className="text-center mt-4">
          <Button asChild>
            <Link to="/map">View Full Map</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
```

---

### 3.2 Public Map (`PublicMap.tsx`)

**Purpose:** Interactive map showing all projects and GIS features

**Features:**
- Vector tile rendering (MapLibre)
- Project markers with popups
- GIS feature layers (roads, bridges, etc.)
- Filters (province, year, status)
- Legend
- Basemap switcher

**Implementation:**
```typescript
import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useQuery } from '@tanstack/react-query';
import { publicAPI } from '@/api/public';

export default function PublicMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [filters, setFilters] = useState({
    province: '',
    fundYear: null,
    status: ''
  });

  const { data: features } = useQuery({
    queryKey: ['public-gis-features', filters],
    queryFn: () => publicAPI.getGISFeatures(filters)
  });

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [124.5, 7.5], // BARMM center
      zoom: 8
    });

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Add GIS features layer
    map.current.on('load', () => {
      // Vector tiles from API
      map.current!.addSource('gis-features', {
        type: 'vector',
        tiles: ['https://api.ebarmm.gov.ph/v1/gis/tiles/{z}/{x}/{y}.mvt'],
        minzoom: 6,
        maxzoom: 14
      });

      // Road features
      map.current!.addLayer({
        id: 'roads',
        type: 'line',
        source: 'gis-features',
        'source-layer': 'gis_features',
        filter: ['==', 'feature_type', 'road'],
        paint: {
          'line-color': '#FF6B35',
          'line-width': 3
        }
      });

      // Bridge features
      map.current!.addLayer({
        id: 'bridges',
        type: 'circle',
        source: 'gis-features',
        'source-layer': 'gis_features',
        filter: ['==', 'feature_type', 'bridge'],
        paint: {
          'circle-radius': 8,
          'circle-color': '#4ECDC4'
        }
      });

      // Add project markers from GeoJSON
      if (features) {
        map.current!.addSource('projects', {
          type: 'geojson',
          data: features
        });

        map.current!.addLayer({
          id: 'project-markers',
          type: 'circle',
          source: 'projects',
          paint: {
            'circle-radius': 6,
            'circle-color': '#F7B731',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
          }
        });

        // Add popups on click
        map.current!.on('click', 'project-markers', (e) => {
          const coordinates = e.features![0].geometry.coordinates.slice();
          const properties = e.features![0].properties;

          new maplibregl.Popup()
            .setLngLat(coordinates as [number, number])
            .setHTML(`
              <div class="p-2">
                <h3 class="font-bold">${properties.project_title}</h3>
                <p class="text-sm">Progress: ${properties.current_progress}%</p>
                <a href="/projects/${properties.project_id}" class="text-blue-600">
                  View Details
                </a>
              </div>
            `)
            .addTo(map.current!);
        });

        // Change cursor on hover
        map.current!.on('mouseenter', 'project-markers', () => {
          map.current!.getCanvas().style.cursor = 'pointer';
        });
        map.current!.on('mouseleave', 'project-markers', () => {
          map.current!.getCanvas().style.cursor = '';
        });
      }
    });

    return () => {
      map.current?.remove();
    };
  }, [features]);

  return (
    <div className="relative h-screen">
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Filter Panel */}
      <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg w-80">
        <h3 className="font-bold mb-4">Filter Projects</h3>
        <div className="space-y-3">
          <select
            value={filters.province}
            onChange={(e) => setFilters({ ...filters, province: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">All Provinces</option>
            <option value="Maguindanao">Maguindanao</option>
            <option value="Lanao del Sur">Lanao del Sur</option>
            {/* More provinces */}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">All Statuses</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="planning">Planning</option>
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white p-4 rounded-lg shadow-lg">
        <h4 className="font-bold mb-2">Legend</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-orange-500"></div>
            <span>Roads</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-teal-400"></div>
            <span>Bridges</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500 border-2 border-white"></div>
            <span>Projects</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### 3.3 Admin Dashboard (`Dashboard.tsx`)

**Purpose:** Overview for authenticated users

**Features (Role-Based):**
- DEO User: Their projects summary
- Regional Admin: Regional statistics
- Super Admin: System-wide overview

**Layout:**
```typescript
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { projectsAPI } from '@/api/projects';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: projects } = useQuery({
    queryKey: ['my-projects'],
    queryFn: projectsAPI.getProjects
  });

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">
        Welcome, {user?.username}
      </h1>

      {/* Role-specific dashboard */}
      {user?.role === 'deo_user' && <DEODashboard projects={projects} />}
      {user?.role === 'regional_admin' && <RegionalAdminDashboard />}
      {user?.role === 'super_admin' && <SuperAdminDashboard />}
    </div>
  );
}

function DEODashboard({ projects }) {
  const stats = {
    total: projects?.total || 0,
    ongoing: projects?.items.filter(p => p.status === 'ongoing').length || 0,
    completed: projects?.items.filter(p => p.status === 'completed').length || 0,
    avgProgress: projects?.items.reduce((acc, p) => acc + p.current_progress, 0) / (projects?.total || 1)
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Projects" value={stats.total} />
        <StatCard title="Ongoing" value={stats.ongoing} />
        <StatCard title="Completed" value={stats.completed} />
        <StatCard title="Avg Progress" value={`${stats.avgProgress.toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectList projects={projects?.items.slice(0, 5)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Action Required</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionList projects={projects?.items.filter(needsUpdate)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

### 3.4 GIS Editor (`GISEditor.tsx`)

**Purpose:** Web-based geometry digitization

**Features:**
- Draw tools (point, line, polygon)
- Edit existing features
- Snap to existing geometries
- Measure tools
- Attribute form
- Validation against geofencing rules

**Implementation:**
```typescript
import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { gisAPI } from '@/api/gis';

export default function GISEditor() {
  const { projectId } = useParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);

  const { data: existingFeatures } = useQuery({
    queryKey: ['gis-features', projectId],
    queryFn: () => gisAPI.getFeatures({ project_id: projectId })
  });

  const createFeatureMutation = useMutation({
    mutationFn: gisAPI.createFeature,
    onSuccess: () => {
      toast.success('GIS feature saved');
      draw.current?.deleteAll();
    }
  });

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [124.5, 7.5],
      zoom: 10
    });

    // Initialize draw control
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        point: true,
        line_string: true,
        polygon: true,
        trash: true
      },
      defaultMode: 'simple_select'
    });

    map.current.addControl(draw.current, 'top-left');

    // Load existing features
    map.current.on('load', () => {
      if (existingFeatures) {
        map.current!.addSource('existing-features', {
          type: 'geojson',
          data: existingFeatures
        });

        map.current!.addLayer({
          id: 'existing-roads',
          type: 'line',
          source: 'existing-features',
          filter: ['==', 'feature_type', 'road'],
          paint: {
            'line-color': '#FF6B35',
            'line-width': 2
          }
        });
      }
    });

    // Handle feature creation
    map.current.on('draw.create', handleFeatureCreate);
    map.current.on('draw.update', handleFeatureUpdate);

    return () => {
      map.current?.remove();
    };
  }, [existingFeatures]);

  const handleFeatureCreate = (e: any) => {
    const feature = e.features[0];
    setSelectedFeature({
      geometry: feature.geometry,
      feature_type: getFeatureType(feature.geometry.type)
    });
  };

  const saveFeature = (attributes: any) => {
    createFeatureMutation.mutate({
      project_id: projectId,
      feature_type: selectedFeature.feature_type,
      geometry: selectedFeature.geometry,
      attributes: attributes
    });
  };

  return (
    <div className="h-screen flex">
      {/* Map */}
      <div ref={mapContainer} className="flex-1" />

      {/* Attribute Panel */}
      <div className="w-96 bg-white shadow-lg overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">GIS Editor</h2>

          {selectedFeature ? (
            <FeatureAttributeForm
              featureType={selectedFeature.feature_type}
              onSave={saveFeature}
              onCancel={() => setSelectedFeature(null)}
            />
          ) : (
            <div className="text-gray-500">
              <p>Use the draw tools to create a new feature.</p>
              <ul className="mt-4 space-y-2">
                <li>• Point: Facility, Bridge</li>
                <li>• Line: Road, Drainage</li>
                <li>• Polygon: Building, Area</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureAttributeForm({ featureType, onSave, onCancel }) {
  const { register, handleSubmit } = useForm();

  const onSubmit = (data) => {
    onSave(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h3 className="font-bold">Feature Type: {featureType}</h3>

      {featureType === 'road' && (
        <>
          <Input
            label="Road Name"
            {...register('road_name', { required: true })}
          />
          <Input
            label="Length (km)"
            type="number"
            step="0.01"
            {...register('length_km', { required: true })}
          />
          <Select label="Surface Type" {...register('surface_type')}>
            <option value="asphalt">Asphalt</option>
            <option value="concrete">Concrete</option>
            <option value="gravel">Gravel</option>
          </Select>
        </>
      )}

      {featureType === 'bridge' && (
        <>
          <Input label="Bridge Name" {...register('bridge_name')} />
          <Input label="Length (m)" type="number" {...register('length_m')} />
          <Input label="Width (m)" type="number" {...register('width_m')} />
        </>
      )}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">Save Feature</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
```

---

### 3.5 Progress Timeline (`ProgressTimeline.tsx`)

**Purpose:** Visualize progress history with tamper-proof verification

**Features:**
- Timeline chart
- Progress percentage trend
- Hash validation indicators
- Reporter information

**Implementation:**
```typescript
import { useQuery } from '@tanstack/react-query';
import { progressAPI } from '@/api/progress';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export default function ProgressTimeline({ projectId }: { projectId: string }) {
  const { data: progressLogs } = useQuery({
    queryKey: ['progress', projectId],
    queryFn: () => progressAPI.getProgressHistory(projectId)
  });

  const { data: verification } = useQuery({
    queryKey: ['progress-verify', projectId],
    queryFn: () => progressAPI.verifyChain(projectId)
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Progress Timeline</h2>
        {verification?.chain_valid ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle size={20} />
            <span>Chain Verified</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={20} />
            <span>Chain Broken</span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        {progressLogs?.logs.map((log, index) => (
          <div key={log.progress_id} className="flex gap-4 pb-8">
            {/* Timeline Line */}
            <div className="flex flex-col items-center">
              <div className={`w-4 h-4 rounded-full ${log.hash_valid ? 'bg-green-500' : 'bg-red-500'}`} />
              {index < progressLogs.logs.length - 1 && (
                <div className="w-0.5 h-full bg-gray-300 my-1" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {log.reported_percent}%
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(log.report_date)}
                    </div>
                  </div>
                  {!log.hash_valid && (
                    <AlertTriangle className="text-red-500" size={20} />
                  )}
                </div>

                <p className="mt-2 text-gray-700">{log.remarks}</p>

                <div className="mt-3 text-sm text-gray-500">
                  Reported by: {log.reporter_name}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 3.6 Media Upload (`MediaUpload.tsx`)

**Purpose:** Upload photos/videos/documents with GPS metadata

**Features:**
- Drag-and-drop
- GPS coordinate input
- Image preview
- Progress indicator
- Pre-signed URL flow

**Implementation:**
```typescript
import { useMutation } from '@tanstack/react-query';
import { mediaAPI } from '@/api/media';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

export default function MediaUpload({ projectId }: { projectId: string }) {
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [gpsCoords, setGpsCoords] = useState({ lat: null, lng: null });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Step 1: Get pre-signed URL
      const { upload_url, media_id, storage_key } = await mediaAPI.getUploadURL({
        project_id: projectId,
        media_type: 'photo',
        filename: file.name,
        content_type: file.type,
        latitude: gpsCoords.lat,
        longitude: gpsCoords.lng
      });

      // Step 2: Upload to S3
      await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      // Step 3: Confirm upload
      await mediaAPI.confirmUpload(media_id);

      return { media_id, storage_key };
    },
    onSuccess: () => {
      toast.success('File uploaded successfully');
    }
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png'],
      'video/*': ['.mp4', '.mov'],
      'application/pdf': ['.pdf']
    },
    onDrop: (files) => {
      files.forEach(file => uploadMutation.mutate(file));
    }
  });

  return (
    <div className="space-y-4">
      {/* GPS Coordinates */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Latitude"
          type="number"
          step="0.000001"
          value={gpsCoords.lat || ''}
          onChange={(e) => setGpsCoords({ ...gpsCoords, lat: parseFloat(e.target.value) })}
          placeholder="7.123456"
        />
        <Input
          label="Longitude"
          type="number"
          step="0.000001"
          value={gpsCoords.lng || ''}
          onChange={(e) => setGpsCoords({ ...gpsCoords, lng: parseFloat(e.target.value) })}
          placeholder="124.123456"
        />
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-4 text-gray-400" size={48} />
        {isDragActive ? (
          <p>Drop files here...</p>
        ) : (
          <p>Drag files here or click to browse</p>
        )}
      </div>

      {/* Upload Progress */}
      {uploadMutation.isLoading && (
        <div className="bg-blue-50 p-4 rounded">
          <div className="flex items-center justify-between mb-2">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 3.7 User Profile (`Profile.tsx`)

**Purpose:** User profile and account settings

**Features:**
- View/edit personal information
- Change password
- MFA setup/disable
- View active sessions

**Layout:**
```typescript
import { useAuth } from '@/hooks/useAuth';
import { useMutation, useQuery } from '@tanstack/react-query';
import { authAPI } from '@/api/auth';
import MFASetupWizard from '@/components/auth/MFASetupWizard';

export default function Profile() {
  const { user } = useAuth();
  const { data: mfaStatus } = useQuery({
    queryKey: ['mfa-status'],
    queryFn: authAPI.getMFAStatus
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Profile Settings</h1>

      {/* Personal Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm user={user} />
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordChangeForm />
        </CardContent>
      </Card>

      {/* MFA Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
        </CardHeader>
        <CardContent>
          {mfaStatus?.mfa_enabled ? (
            <MFADisableSection backupCodesRemaining={mfaStatus.backup_codes_remaining} />
          ) : (
            <MFASetupWizard />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### 3.8 MFA Setup Wizard (`MFASetupWizard.tsx`)

**Purpose:** Step-by-step MFA setup process

**Features:**
- QR code display for authenticator apps
- Manual secret key entry option
- Verification code input
- Backup codes display and download

**Implementation:**
```typescript
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '@/api/auth';

export default function MFASetupWizard() {
  const [step, setStep] = useState(0);
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);

  const setupMutation = useMutation({
    mutationFn: authAPI.setupMFA,
    onSuccess: (data) => {
      setSetupData(data);
      setStep(1);
    }
  });

  const verifyMutation = useMutation({
    mutationFn: authAPI.verifyMFASetup,
    onSuccess: () => {
      setStep(2);
    }
  });

  return (
    <Stepper activeStep={step}>
      {/* Step 0: Introduction */}
      <Step>
        <StepLabel>Get Started</StepLabel>
        <StepContent>
          <p>Secure your account with two-factor authentication.</p>
          <Button onClick={() => setupMutation.mutate()}>
            Enable 2FA
          </Button>
        </StepContent>
      </Step>

      {/* Step 1: Scan QR Code */}
      <Step>
        <StepLabel>Scan QR Code</StepLabel>
        <StepContent>
          <img src={setupData?.qr_code} alt="QR Code" />
          <p>Or enter manually: {setupData?.secret}</p>
          <TextField
            label="Enter 6-digit code"
            onSubmit={(code) => verifyMutation.mutate({ code })}
          />
        </StepContent>
      </Step>

      {/* Step 2: Save Backup Codes */}
      <Step>
        <StepLabel>Save Backup Codes</StepLabel>
        <StepContent>
          <Alert severity="warning">
            Save these backup codes in a secure location.
          </Alert>
          <BackupCodesList codes={setupData?.backup_codes} />
          <Button onClick={downloadBackupCodes}>Download</Button>
        </StepContent>
      </Step>
    </Stepper>
  );
}
```

---

### 3.9 Settings Pages

#### Users Settings (`UsersSettings.tsx`)

**Purpose:** User management interface

**Features:**
- List all users with search/filter
- Create new users
- Edit user details
- Activate/deactivate users
- Reset user passwords
- Reset user MFA

**Layout:**
```typescript
export default function UsersSettings() {
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersAPI.getUsers
  });

  return (
    <div className="p-8">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Button onClick={openCreateDialog}>Add User</Button>
      </div>

      <DataTable
        columns={userColumns}
        data={users?.items}
        searchable
        filterable
      />

      <UserFormDialog />
    </div>
  );
}
```

#### Groups Settings (`GroupsSettings.tsx`)

**Purpose:** Group/role management

**Features:**
- List all groups
- Create/edit/delete groups
- Manage group members
- View group permissions

#### Access Rights Settings (`AccessRightsSettings.tsx`)

**Purpose:** Permission management

**Features:**
- Matrix view of group permissions per resource
- Quick toggle permissions on/off
- Create new permission assignments
- Visual indication of permission inheritance

#### Audit Logs (`AuditLogs.tsx`)

**Purpose:** System audit trail viewer

**Features:**
- Filterable log viewer (by user, action, date range)
- Export logs to CSV
- Detailed log entry view
- Per-project audit log filtering

---

## 4. STATE MANAGEMENT

### 4.1 Auth Store (Zustand)

```typescript
// src/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  user_id: string;
  username: string;
  role: 'deo_user' | 'regional_admin' | 'super_admin';
  deo_id?: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (token, user) => set({ token, user, isAuthenticated: true }),
      logout: () => set({ token: null, user: null, isAuthenticated: false })
    }),
    {
      name: 'auth-storage'
    }
  )
);
```

### 4.2 API Client with Auth

```typescript
// src/api/client.ts
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://api.ebarmm.gov.ph/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for JWT
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## 5. ROLE-BASED UI

### 5.1 Protected Route Component

```typescript
// src/components/layout/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  allowedRoles: string[];
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
```

### 5.2 Conditional Rendering

```typescript
// Example: Show "Create Project" button only for authorized roles
import { useAuthStore } from '@/stores/authStore';

function ProjectList() {
  const { user } = useAuthStore();
  const canCreate = ['deo_user', 'regional_admin', 'super_admin'].includes(user?.role || '');

  return (
    <div>
      {canCreate && (
        <Button onClick={() => navigate('/admin/projects/new')}>
          Create Project
        </Button>
      )}
    </div>
  );
}
```

---

## 6. BUILD & DEPLOYMENT

### 6.1 Environment Variables

```env
# .env.production
VITE_API_BASE_URL=https://api.ebarmm.gov.ph/v1
VITE_MAPBOX_TOKEN=pk.xxx
VITE_S3_BUCKET=ebarmm-media
```

### 6.2 Build Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'map-vendor': ['maplibre-gl', '@mapbox/mapbox-gl-draw']
        }
      }
    }
  }
});
```

### 6.3 Deployment (Static Hosting)

```bash
# Build for production
npm run build

# Deploy to Nginx/Apache
cp -r dist/* /var/www/ebarmm/

# Nginx config
server {
  listen 80;
  server_name ebarmm.gov.ph;
  root /var/www/ebarmm;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api {
    proxy_pass http://localhost:8000;
  }
}
```

---

This frontend design provides a complete, production-ready architecture for the E-BARMM transparency system with role-based access, GIS capabilities, and tamper-proof progress visualization.
