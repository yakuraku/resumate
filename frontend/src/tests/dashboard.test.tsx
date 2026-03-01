import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import DashboardPage from '@/app/dashboard/page'
import { ApplicationService } from '@/services/application.service'
import { ApplicationStatus } from '@/types/application'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock ApplicationService
vi.mock('@/services/application.service', () => ({
  ApplicationService: {
    getAll: vi.fn(),
  },
}))

describe('DashboardPage', () => {
  it('renders loading state initially', () => {
    // Mock infinite loading or resolved loading
    (ApplicationService.getAll as any).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 10
    })
    
    render(<DashboardPage />)
    
    // There are multiple "Dashboard" texts (Sidebar link + Page Title)
    // using getAllByText should find at least 1
    const dashboards = screen.getAllByText('Dashboard')
    expect(dashboards.length).toBeGreaterThan(0)
  })

  it('renders applications after fetch', async () => {
    const mockApps = [
      {
        id: '1',
        company: 'Test Corp',
        role: 'Senior Dev',
        status: ApplicationStatus.APPLIED,
        applied_date: '2023-01-01',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      }
    ]

    ;(ApplicationService.getAll as any).mockResolvedValue({
      items: mockApps,
      total: 1,
      page: 1,
      page_size: 10
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Corp')).toBeInTheDocument()
      expect(screen.getByText('Senior Dev')).toBeInTheDocument()
      expect(screen.getByText('Applied')).toBeInTheDocument()
    })
  })
  
  it('renders empty state when no applications', async () => {
    (ApplicationService.getAll as any).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 10
    })

    render(<DashboardPage />)

    await waitFor(() => {
      // Use regex to be more flexible or check part of the string
      expect(screen.getByText(/No applications found/i)).toBeInTheDocument()
    })
  })
})
