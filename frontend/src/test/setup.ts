import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test case (e.g., clearing jsdom)
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia for components that use media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }),
})

// Mock ResizeObserver for components that use it
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

// @ts-expect-error - global ResizeObserver mock
globalThis.ResizeObserver = MockResizeObserver

// Mock IntersectionObserver for lazy loading components
class MockIntersectionObserver {
  root = null
  rootMargin = ''
  thresholds: number[] = []

  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
}

// @ts-expect-error - global IntersectionObserver mock
globalThis.IntersectionObserver = MockIntersectionObserver

// Mock import.meta.env for tests
vi.stubGlobal('import.meta', {
  env: {
    VITE_API_BASE_URL: 'http://localhost:8000/api/v1',
  },
})
