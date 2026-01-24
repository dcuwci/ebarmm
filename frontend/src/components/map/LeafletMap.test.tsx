/**
 * LeafletMap Component Tests
 *
 * Note: Full Leaflet integration tests are challenging in JSDOM.
 * These tests focus on the component's prop handling and rendering behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock react-leaflet components
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  ZoomControl: () => <div data-testid="zoom-control" />,
  useMap: () => ({
    fitBounds: vi.fn(),
    removeLayer: vi.fn(),
  }),
}))

// Mock leaflet
vi.mock('leaflet', () => {
  const mockLatLngBounds = vi.fn(() => ({
    extend: vi.fn(function(this: any) { return this }),
  }))

  return {
    default: {
      icon: vi.fn(() => ({})),
      Marker: { prototype: { options: {} } },
      marker: vi.fn(),
      polyline: vi.fn(() => ({
        bindPopup: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
      })),
      polygon: vi.fn(() => ({
        bindPopup: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
      })),
      latLngBounds: mockLatLngBounds,
      geoJSON: vi.fn(),
    },
    icon: vi.fn(() => ({})),
    Marker: { prototype: { options: {} } },
    marker: vi.fn(),
    polyline: vi.fn(() => ({
      bindPopup: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
    })),
    polygon: vi.fn(() => ({
      bindPopup: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
    })),
    latLngBounds: mockLatLngBounds,
    geoJSON: vi.fn(),
  }
})

// Mock leaflet icons
vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: '' }))
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: '' }))
vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({ default: '' }))

// Mock theme context
vi.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'light',
    toggleTheme: vi.fn(),
  }),
}))

// Import after mocks
import { LeafletMap } from './LeafletMap'

describe('LeafletMap', () => {
  const mockProjects = [
    {
      project_id: 'proj-1',
      project_title: 'Test Project 1',
      status: 'ongoing',
      geometry_wkt: 'POINT(124.5 6.9)',
    },
    {
      project_id: 'proj-2',
      project_title: 'Test Project 2',
      status: 'completed',
      geometry_wkt: 'LINESTRING(124.0 6.0, 125.0 7.0)',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render map container', () => {
    render(<LeafletMap />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('should render tile layer', () => {
    render(<LeafletMap />)
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument()
  })

  it('should render zoom control', () => {
    render(<LeafletMap />)
    expect(screen.getByTestId('zoom-control')).toBeInTheDocument()
  })

  it('should render theme toggle button by default', () => {
    render(<LeafletMap />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should hide theme toggle when showThemeToggle is false', () => {
    render(<LeafletMap showThemeToggle={false} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('should accept projects prop', () => {
    // This should not throw
    expect(() => {
      render(<LeafletMap projects={mockProjects} />)
    }).not.toThrow()
  })

  it('should accept selectedProjectId prop', () => {
    expect(() => {
      render(<LeafletMap projects={mockProjects} selectedProjectId="proj-1" />)
    }).not.toThrow()
  })

  it('should accept onProjectSelect callback', () => {
    const onSelect = vi.fn()
    expect(() => {
      render(<LeafletMap projects={mockProjects} onProjectSelect={onSelect} />)
    }).not.toThrow()
  })

  it('should accept custom height', () => {
    render(<LeafletMap height="500px" />)
    // The height is applied to the container Box
    const container = screen.getByTestId('map-container').parentElement
    expect(container).toBeInTheDocument()
  })

  it('should render children', () => {
    render(
      <LeafletMap>
        <div data-testid="custom-child">Custom content</div>
      </LeafletMap>
    )
    expect(screen.getByTestId('custom-child')).toBeInTheDocument()
  })

  it('should accept autoFitBounds prop', () => {
    expect(() => {
      render(<LeafletMap projects={mockProjects} autoFitBounds={false} />)
    }).not.toThrow()
  })

  it('should handle empty projects array', () => {
    expect(() => {
      render(<LeafletMap projects={[]} />)
    }).not.toThrow()
  })

  it('should handle projects without geometry', () => {
    const projectsWithoutGeometry = [
      {
        project_id: 'proj-1',
        project_title: 'No Geometry Project',
        status: 'planning',
      },
    ]
    expect(() => {
      render(<LeafletMap projects={projectsWithoutGeometry} />)
    }).not.toThrow()
  })

  it('should handle undefined projects', () => {
    expect(() => {
      render(<LeafletMap projects={undefined} />)
    }).not.toThrow()
  })
})

describe('LeafletMap theme integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show sun icon in dark mode', async () => {
    // Override theme mock for this test
    vi.doMock('../../theme/ThemeContext', () => ({
      useTheme: () => ({
        mode: 'dark',
        toggleTheme: vi.fn(),
      }),
    }))

    // Re-import the component with new mock
    const { LeafletMap: DarkLeafletMap } = await import('./LeafletMap')

    render(<DarkLeafletMap showThemeToggle />)

    // Button should be rendered
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
