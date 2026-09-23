import { renderWithProviders } from '@navet/app/test/render';
import { act, fireEvent, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { CustomExtensionsDialog } from './custom-extensions-dialog';

it('keeps typed values when several keystrokes batch into one render', () => {
  renderWithProviders(<CustomExtensionsDialog isOpen onOpenChange={() => {}} mode="sidebar" />);
  const [name, url] = screen.getAllByRole('textbox');
  act(() => {
    fireEvent.change(name, { target: { value: 'F' } });
    fireEvent.change(name, { target: { value: 'Fi' } });
    fireEvent.change(url, { target: { value: 'h' } });
    fireEvent.change(url, { target: { value: 'ht' } });
  });
  expect((name as HTMLInputElement).value).toBe('Fi');
  expect((url as HTMLInputElement).value).toBe('ht');
});
