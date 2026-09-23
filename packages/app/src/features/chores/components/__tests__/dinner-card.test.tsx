import { renderWithProviders } from '@navet/app/test/render';
import { createDinnerDefinition } from '@navet/core/chore-dinner';
import { createEmptyChoreWorkspace } from '@navet/core/chores';
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChoreWorkspaceStore } from '../../chore-workspace-store';
import { DinnerCard } from '../dinner-card';

vi.mock('../../use-chore-workspace-sync', () => ({ useChoreWorkspaceSync: () => undefined }));
vi.mock('../../use-chore-materialization', () => ({
  useChoreMaterialization: () => ({ runtimeCapabilities: null, authoritySchedules: true }),
}));

const timestamp = '2026-09-22T06:00:00.000Z';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 22, 12));
  const taco = createDinnerDefinition({
    title: 'Taco',
    dateKey: '2026-09-22',
    timeZone: 'UTC',
    imageUrl: 'https://example.com/taco.jpg',
    timestamp,
  });
  const soup = createDinnerDefinition({
    title: 'Suppe',
    dateKey: '2026-09-24',
    timeZone: 'UTC',
    timestamp,
  });
  useChoreWorkspaceStore.setState(useChoreWorkspaceStore.getInitialState(), true);
  useChoreWorkspaceStore.getState().setPreviewDocument({
    data: {
      ...createEmptyChoreWorkspace(),
      definitionsById: { [taco.id]: taco, [soup.id]: soup },
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  useChoreWorkspaceStore.setState(useChoreWorkspaceStore.getInitialState(), true);
});

describe('dinner dashboard card', () => {
  it("shows only today's dinner, with its image, by default", () => {
    const { container } = renderWithProviders(<DinnerCard size="large" />);

    expect(screen.getByText('Taco')).toBeInTheDocument();
    expect(screen.queryByText('Suppe')).not.toBeInTheDocument();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://example.com/taco.jpg'
    );
  });

  it('lists the coming days below today when configured', () => {
    renderWithProviders(<DinnerCard size="large" data={{ days: 3 }} />);

    expect(screen.getByText('Taco')).toBeInTheDocument();
    expect(screen.getByText('Suppe')).toBeInTheDocument();
  });
});
