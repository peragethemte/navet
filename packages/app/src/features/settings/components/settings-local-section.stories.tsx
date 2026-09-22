import type { Meta, StoryObj } from '@storybook/react-vite';
import { useSettingsSectionController } from '../hooks/use-settings-section-controller';
import { SettingsLocalSection } from './settings-local-section';

function LocalStory() {
  const controller = useSettingsSectionController();
  return (
    <div className="h-full min-w-0 overflow-x-hidden overflow-y-auto px-3 py-3 md:px-6 md:py-6">
      <div className="mx-auto w-full max-w-4xl">
        <SettingsLocalSection controller={controller} />
      </div>
    </div>
  );
}

const meta = {
  title: 'Pages/Settings/Local Services',
  component: LocalStory,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Local services settings tab - the household weather location, with the server-configured location as the fallback.',
      },
    },
  },
} satisfies Meta<typeof LocalStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
