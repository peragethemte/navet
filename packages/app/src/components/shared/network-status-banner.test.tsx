import { renderWithProviders } from '@navet/app/test/render';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NetworkStatusBanner } from './network-status-banner';

describe('NetworkStatusBanner', () => {
  it('renders provider-aware disconnect copy for non-Home Assistant providers', () => {
    renderWithProviders(
      <NetworkStatusBanner
        connected={false}
        connecting={false}
        reconnecting={false}
        isOnline
        providerLabel="openHAB"
      />
    );

    expect(screen.getByText('openHAB disconnected')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Navet cannot reach openHAB right now. Cached UI is still available while it reconnects.'
      )
    ).toBeInTheDocument();
  });

  it('shows provider-specific error details when available', () => {
    renderWithProviders(
      <NetworkStatusBanner
        connected={false}
        connecting={false}
        reconnecting={false}
        isOnline
        providerLabel="openHAB"
        lastError="openHAB authentication failed. Check your username, password, and API Security settings."
      />
    );

    expect(
      screen.getByText(
        'openHAB authentication failed. Check your username, password, and API Security settings.'
      )
    ).toBeInTheDocument();
  });

  it('hides the banner when the close control is clicked', () => {
    renderWithProviders(
      <NetworkStatusBanner
        connected={false}
        connecting={false}
        reconnecting={false}
        isOnline
        providerLabel="openHAB"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('openHAB disconnected')).not.toBeInTheDocument();
  });

  it('shows the banner again when the connection status changes after a dismiss', () => {
    const { rerender } = renderWithProviders(
      <NetworkStatusBanner
        connected={false}
        connecting={false}
        reconnecting={false}
        isOnline
        providerLabel="openHAB"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    rerender(
      <NetworkStatusBanner
        connected={false}
        connecting
        reconnecting
        isOnline
        providerLabel="openHAB"
      />
    );

    expect(screen.getByText('Reconnecting to openHAB')).toBeInTheDocument();
  });
});
