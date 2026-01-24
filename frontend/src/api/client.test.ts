/**
 * API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { getErrorMessage } from './client'

// We test getErrorMessage function here since the axios interceptors
// are harder to unit test without integration tests

describe('getErrorMessage', () => {
  it('should extract detail from axios error response', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          detail: 'User not found',
        },
      },
    }

    // Mock axios.isAxiosError
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true)

    const message = getErrorMessage(error)
    expect(message).toBe('User not found')
  })

  it('should extract message from axios error response', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          message: 'Invalid credentials',
        },
      },
    }

    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true)

    const message = getErrorMessage(error)
    expect(message).toBe('Invalid credentials')
  })

  it('should use error.message as fallback', () => {
    const error = {
      isAxiosError: true,
      message: 'Network Error',
      response: {
        data: {},
      },
    }

    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true)

    const message = getErrorMessage(error)
    expect(message).toBe('Network Error')
  })

  it('should return default message for non-axios errors', () => {
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(false)

    const message = getErrorMessage(new Error('Something went wrong'))
    expect(message).toBe('An unexpected error occurred')
  })

  it('should return default message for null/undefined', () => {
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(false)

    expect(getErrorMessage(null)).toBe('An unexpected error occurred')
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred')
  })

  it('should prefer detail over message', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          detail: 'Specific error detail',
          message: 'Generic message',
        },
      },
    }

    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true)

    const message = getErrorMessage(error)
    expect(message).toBe('Specific error detail')
  })

  it('should handle errors without response', () => {
    const error = {
      isAxiosError: true,
      message: 'Request timeout',
    }

    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true)

    const message = getErrorMessage(error)
    expect(message).toBe('Request timeout')
  })

  it('should handle errors with empty response data', () => {
    const error = {
      isAxiosError: true,
      message: 'Server error',
      response: {
        data: null,
      },
    }

    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true)

    const message = getErrorMessage(error)
    expect(message).toBe('Server error')
  })
})
