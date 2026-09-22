import { Button } from '@navet/app/components/primitives/button';
import { getStoryDocsDescription } from '@navet/app/storybook/story-docs';
import { SettingsDialogStoryFrame } from '@navet/app/storybook/story-frames';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CountdownSettingsDialog } from './countdown-settings-dialog';
import type { CountdownCardData } from './countdown-widget-data';

function CountdownSettingsDialogStory() {
  const [isOpen, setIsOpen] = useState(false);
  const [roomValue, setRoomValue] = useState('__home__');
  const [data, setData] = useState<CountdownCardData>({
    title: 'Summer holiday',
    targetDate: '2027-06-20',
    targetTime: '09:30',
    precision: 'datetime',
    display: 'days',
    background: 'builtin:nocturne-01',
    tintColor: '#f97316',
  });

  return (
    <SettingsDialogStoryFrame parentCardClassName="bg-[linear-gradient(180deg,rgba(249,115,22,0.18),rgba(15,23,42,0.28))]">
      <div className="relative flex items-start justify-center p-6">
        <Button variant="secondary" onClick={() => setIsOpen(true)}>
          Open countdown dialog
        </Button>
      </div>
      <CountdownSettingsDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        roomValue={roomValue}
        roomLabel={roomValue === '__home__' ? 'Home' : roomValue}
        roomOptions={[
          { label: 'Home', value: '__home__' },
          { label: 'Bedroom', value: 'Bedroom' },
          { label: 'Living Room', value: 'Living Room' },
        ]}
        onRoomChange={setRoomValue}
        data={data}
        onUpdate={(update) => setData((current) => ({ ...current, ...update }))}
        onTintColorChange={(tintColor) => setData((current) => ({ ...current, tintColor }))}
      />
    </SettingsDialogStoryFrame>
  );
}

const meta = {
  title: 'Cards/Dialogs/Countdown',
  component: CountdownSettingsDialogStory,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen', docs: { description: {} } },
} satisfies Meta<typeof CountdownSettingsDialogStory>;

const richComponentDocsDescription = getStoryDocsDescription(meta.title);

meta.parameters = {
  ...meta.parameters,
  docs: {
    ...meta.parameters?.docs,
    description: {
      ...meta.parameters?.docs?.description,
      component: richComponentDocsDescription,
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
