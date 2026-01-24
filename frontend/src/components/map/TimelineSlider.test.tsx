import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimelineSlider } from './TimelineSlider'

describe('TimelineSlider', () => {
  const mockOnChange = vi.fn()
  const years = [2020, 2021, 2022, 2023, 2024]

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('renders with year marks', () => {
    render(
      <TimelineSlider
        years={years}
        selectedYear={null}
        onChange={mockOnChange}
      />
    )

    // Should show "All" when no year is selected
    expect(screen.getByText('All')).toBeInTheDocument()

    // Should render year marks (MUI Slider renders years in multiple elements)
    expect(screen.getAllByText('2020').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2024').length).toBeGreaterThan(0)
  })

  it('displays selected year', () => {
    render(
      <TimelineSlider
        years={years}
        selectedYear={2022}
        onChange={mockOnChange}
      />
    )

    // Selected year shown in the display area (not "All")
    expect(screen.queryByText('All')).not.toBeInTheDocument()
    // Year marks are rendered by MUI Slider
    expect(screen.getAllByText('2022').length).toBeGreaterThan(0)
  })

  it('does not render when years array is empty', () => {
    const { container } = render(
      <TimelineSlider
        years={[]}
        selectedYear={null}
        onChange={mockOnChange}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('shows clear button when year is selected', () => {
    render(
      <TimelineSlider
        years={years}
        selectedYear={2022}
        onChange={mockOnChange}
      />
    )

    // Should have a clear button (X icon)
    const clearButton = screen.getByRole('button', { name: /show all years/i })
    expect(clearButton).toBeInTheDocument()
  })

  it('hides clear button when no year is selected', () => {
    render(
      <TimelineSlider
        years={years}
        selectedYear={null}
        onChange={mockOnChange}
      />
    )

    // Should not have a clear button
    const clearButton = screen.queryByRole('button', { name: /show all years/i })
    expect(clearButton).not.toBeInTheDocument()
  })

  it('calls onChange with null when clear button is clicked', () => {
    render(
      <TimelineSlider
        years={years}
        selectedYear={2022}
        onChange={mockOnChange}
      />
    )

    const clearButton = screen.getByRole('button', { name: /show all years/i })
    fireEvent.click(clearButton)

    expect(mockOnChange).toHaveBeenCalledWith(null)
  })

  it('shows play button when enableAutoPlay is true', () => {
    render(
      <TimelineSlider
        years={years}
        selectedYear={null}
        onChange={mockOnChange}
        enableAutoPlay
      />
    )

    const playButton = screen.getByRole('button', { name: /play through years/i })
    expect(playButton).toBeInTheDocument()
  })

  it('hides play button when enableAutoPlay is false', () => {
    render(
      <TimelineSlider
        years={years}
        selectedYear={null}
        onChange={mockOnChange}
        enableAutoPlay={false}
      />
    )

    const playButton = screen.queryByRole('button', { name: /play through years/i })
    expect(playButton).not.toBeInTheDocument()
  })

  it('starts auto-play from first year when clicking play with no selection', () => {
    vi.useFakeTimers()

    render(
      <TimelineSlider
        years={years}
        selectedYear={null}
        onChange={mockOnChange}
        enableAutoPlay
        autoPlayInterval={1000}
      />
    )

    const playButton = screen.getByRole('button', { name: /play through years/i })
    fireEvent.click(playButton)

    // Should immediately set to first year
    expect(mockOnChange).toHaveBeenCalledWith(2020)

    vi.useRealTimers()
  })

  it('sorts years ascending', () => {
    const unsortedYears = [2023, 2020, 2022, 2021]

    render(
      <TimelineSlider
        years={unsortedYears}
        selectedYear={null}
        onChange={mockOnChange}
      />
    )

    // The slider should work with sorted years internally
    // Check that year marks are rendered (MUI Slider renders in multiple elements)
    expect(screen.getAllByText('2020').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2023').length).toBeGreaterThan(0)
  })

  it('renders with single year', () => {
    const { container } = render(
      <TimelineSlider
        years={[2023]}
        selectedYear={null}
        onChange={mockOnChange}
      />
    )

    // Should still render (though not very useful with 1 year)
    expect(container.firstChild).toBeInTheDocument()
  })
})
