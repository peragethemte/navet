import { getSettingsSectionStyles } from '@navet/app/features/settings/hooks/settings-section-styles';
import { useSettingsStore } from '@navet/app/stores/settings-store';
import { renderWithProviders } from '@navet/app/test/render';
import { resetAppStores } from '@navet/app/test/store-reset';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsTransitJourneys } from '../settings-transit-journeys';

const searchMock = vi.hoisted(() => vi.fn());
vi.mock('@navet/app/features/transit/entur-client', () => ({
  searchTransitPlaces: searchMock,
}));

const styles = getSettingsSectionStyles('dark', 'blue');

function TestBlock() {
  return <SettingsTransitJourneys styles={styles} />;
}

function suggestion(id: string, name: string) {
  return { id, name, locality: 'Sarpsborg', modes: ['bus'] };
}

async function pickStop(label: string, text: string, id: string, name: string) {
  searchMock.mockResolvedValueOnce([suggestion(id, name)]);
  fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value: text } });
  await act(async () => {
    vi.advanceTimersByTime(400);
  });
  await waitFor(() => expect(screen.getByRole('button', { name })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('SettingsTransitJourneys', () => {
  beforeEach(async () => {
    await resetAppStores();
    searchMock.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts empty', () => {
    renderWithProviders(<TestBlock />);

    expect(
      screen.getByText('No journeys yet. Add one to show departures on the dashboard.')
    ).toBeInTheDocument();
    expect(useSettingsStore.getState().transitJourneys).toEqual([]);
  });

  it('keeps an incomplete journey out of the persisted settings', async () => {
    renderWithProviders(<TestBlock />);

    fireEvent.click(screen.getByRole('button', { name: 'Add journey' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'School' },
    });

    expect(
      screen.getByText('Pick both stops and at least one day to save this journey.')
    ).toBeInTheDocument();
    expect(useSettingsStore.getState().transitJourneys).toEqual([]);
  });

  it('persists a journey once both stops are picked', async () => {
    renderWithProviders(<TestBlock />);

    fireEvent.click(screen.getByRole('button', { name: 'Add journey' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'School' },
    });
    await pickStop('From', 'Sarps', 'NSR:StopPlace:2952', 'Sarpsborg bussterminal');
    await pickStop('To', 'Greå', 'NSR:StopPlace:2719', 'Greåker vgs.');

    await waitFor(() => expect(useSettingsStore.getState().transitJourneys).toHaveLength(1));
    const [journey] = useSettingsStore.getState().transitJourneys;
    expect(journey?.name).toBe('School');
    expect(journey?.from.id).toBe('NSR:StopPlace:2952');
    expect(journey?.to.id).toBe('NSR:StopPlace:2719');
    expect(journey?.timeMode).toBe('arriveBy');
    expect(journey?.targetMinute).toBe(480);
    expect(journey?.weekdays).toEqual([1, 2, 3, 4, 5]);
  });

  it('searches within a bounding box around the configured home', async () => {
    act(() => {
      useSettingsStore.getState().updateSettings({
        weatherLocation: { latitude: 59.2839, longitude: 11.1094, name: 'Home' },
      });
    });
    renderWithProviders(<TestBlock />);

    fireEvent.click(screen.getByRole('button', { name: 'Add journey' }));
    searchMock.mockResolvedValueOnce([]);
    fireEvent.change(screen.getByRole('textbox', { name: 'From' }), { target: { value: 'skole' } });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(searchMock).toHaveBeenCalledWith(
      'skole',
      expect.objectContaining({ location: { latitude: 59.2839, longitude: 11.1094, name: 'Home' } })
    );
  });

  it('reports a failed stop search', async () => {
    renderWithProviders(<TestBlock />);

    fireEvent.click(screen.getByRole('button', { name: 'Add journey' }));
    searchMock.mockRejectedValueOnce(new Error('offline'));
    fireEvent.change(screen.getByRole('textbox', { name: 'From' }), { target: { value: 'skole' } });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() =>
      expect(screen.getByText('Stop search is unavailable right now.')).toBeInTheDocument()
    );
  });

  it('drops a weekday from a saved journey', async () => {
    act(() => {
      useSettingsStore.getState().updateSettings({
        transitJourneys: [
          {
            id: 'school',
            name: 'School',
            from: { id: 'NSR:StopPlace:2952', name: 'Sarpsborg bussterminal' },
            to: { id: 'NSR:StopPlace:2719', name: 'Greåker vgs.' },
            timeMode: 'arriveBy',
            targetMinute: 495,
            leadMinutes: 120,
            weekdays: [1, 2, 3, 4, 5],
          },
        ],
      });
    });
    renderWithProviders(<TestBlock />);

    fireEvent.click(screen.getByRole('button', { name: 'Friday' }));

    await waitFor(() =>
      expect(useSettingsStore.getState().transitJourneys[0]?.weekdays).toEqual([1, 2, 3, 4])
    );
  });

  it('switches a journey to depart after and relabels its time', async () => {
    act(() => {
      useSettingsStore.getState().updateSettings({
        transitJourneys: [
          {
            id: 'home',
            name: 'Home',
            from: { id: 'NSR:StopPlace:2719', name: 'Greåker vgs.' },
            to: { id: 'NSR:StopPlace:2952', name: 'Sarpsborg bussterminal' },
            timeMode: 'arriveBy',
            targetMinute: 960,
            leadMinutes: 120,
            weekdays: [1],
          },
        ],
      });
    });
    renderWithProviders(<TestBlock />);

    expect(screen.getByLabelText('Arrive by')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Depart after' }));

    await waitFor(() =>
      expect(useSettingsStore.getState().transitJourneys[0]?.timeMode).toBe('departAfter')
    );
    expect(screen.getByLabelText('Depart after')).toBeInTheDocument();
    expect(useSettingsStore.getState().transitJourneys[0]?.targetMinute).toBe(960);
  });

  it('removes a journey', async () => {
    act(() => {
      useSettingsStore.getState().updateSettings({
        transitJourneys: [
          {
            id: 'school',
            name: 'School',
            from: { id: 'NSR:StopPlace:2952', name: 'Sarpsborg bussterminal' },
            to: { id: 'NSR:StopPlace:2719', name: 'Greåker vgs.' },
            timeMode: 'arriveBy',
            targetMinute: 495,
            leadMinutes: 120,
            weekdays: [1],
          },
        ],
      });
    });
    renderWithProviders(<TestBlock />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove journey' }));

    await waitFor(() => expect(useSettingsStore.getState().transitJourneys).toEqual([]));
  });
});
