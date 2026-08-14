import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as Nanostores from 'nanostores'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProjectDialog } from './project-dialog'

afterEach(cleanup)

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      common: { cancel: 'Cancel', save: 'Save' },
      sidebar: {
        projects: {
          addFolder: 'Add folder',
          create: 'Create',
          createDesc: 'Create a new project',
          createFailed: 'Failed to create project',
          createTitle: 'New project',
          foldersLabel: 'Folders',
          ideaGenerate: 'Generate',
          ideaGenerating: 'Generating…',
          ideaLabel: 'Idea',
          ideaPlaceholder: 'What are you building?',
          ideaShuffle: 'Shuffle ideas',
          namePlaceholder: 'Project name',
          noFolders: 'No folders yet',
          primaryBadge: 'Primary',
          removeFolder: 'Remove folder'
        }
      }
    }
  })
}))

// $projectDialog is a real nanostore atom in the app; recreate it here so
// useStore behaves identically without pulling in the rest of the projects
// store (backend calls, project list, etc.) which is irrelevant to the Tip fix.
// vi.mock factories are hoisted above the rest of the file, so the atom must
// be created inside vi.hoisted to exist by the time the factory runs.
const { $projectDialog } = vi.hoisted(() => {
  const { atom } = require('nanostores') as typeof Nanostores

  return {
    $projectDialog: atom<{ mode: 'create' | 'rename' | 'add-folder'; name?: string; projectId?: string } | null>({
      mode: 'create'
    })
  }
})

const { generateProjectIdea } = vi.hoisted(() => ({
  generateProjectIdea: vi.fn()
}))

vi.mock('@/store/projects', () => ({
  $projectDialog,
  addProjectFolder: vi.fn(),
  closeProjectDialog: vi.fn(),
  createProject: vi.fn(),
  generateProjectIdea,
  pickProjectFolder: vi.fn(async () => '/Users/test/my-folder'),
  renameProject: vi.fn()
}))

vi.mock('@/store/notifications', () => ({
  notifyError: vi.fn()
}))

vi.mock('@/lib/project-idea-templates', () => ({
  randomIdeaTemplates: () => [{ emoji: '🚀', idea: 'A rocket tracker', label: 'Rocket tracker' }]
}))

const tipTrigger = (el: HTMLElement) => el.closest('[data-slot="tooltip-trigger"]')

describe('ProjectDialog', () => {
  it('wraps the "shuffle idea" button in a Tip', () => {
    render(<ProjectDialog />)

    const button = screen.getByRole('button', { name: 'Shuffle ideas' })
    expect(tipTrigger(button)).toBeTruthy()
  })

  it('wraps the "remove folder" button in a Tip once a folder is added', async () => {
    render(<ProjectDialog />)

    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }))

    const button = await screen.findByRole('button', { name: 'Remove folder' })
    expect(tipTrigger(button)).toBeTruthy()
  })

  it('locks the idea textarea and shows a generating overlay while inventing', async () => {
    let resolveIdea!: (value: string) => void
    generateProjectIdea.mockReturnValueOnce(
      new Promise<string>(resolve => {
        resolveIdea = resolve
      })
    )

    render(<ProjectDialog />)

    const idea = screen.getByPlaceholderText('What are you building?')
    expect(idea).not.toBeDisabled()
    expect(idea.className).toContain('resize-none')
    expect(idea.className).toContain('dt-portal-scrollbar')

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    expect(idea).toBeDisabled()
    expect(screen.getByText('Generating…')).toBeTruthy()

    resolveIdea('A SaaS for electrical contractors')
    await screen.findByDisplayValue('A SaaS for electrical contractors')
    expect(idea).not.toBeDisabled()
    expect(screen.queryByText('Generating…')).toBeNull()
  })
})
