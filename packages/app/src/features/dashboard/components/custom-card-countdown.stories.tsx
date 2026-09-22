import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { getCardSizeOverlayStyle } from '@navet/app/components/shared/card-size-selector';
import { getStoryDocsDescription } from '@navet/app/storybook/story-docs';
import { type CountdownDisplay, parseCountdownTarget } from '@navet/core/countdown';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CountdownWidgetView } from './widgets/countdown-widget-view';

// Fixed so every snapshot of this card reads the same number.
const NOW = new Date(2027, 5, 17, 8, 15, 30);
const TARGET = parseCountdownTarget({ date: '2027-06-20', time: '09:30', precision: 'datetime' });
const TODAY_TARGET = parseCountdownTarget({ date: '2027-06-17' });

type CountdownStoryArgs = {
  size: CardSize;
  display: CountdownDisplay;
  title: string;
  background: string;
};

function CountdownStoryPreview({ size, display, title, background }: CountdownStoryArgs) {
  return (
    <div style={getCardSizeOverlayStyle(size)}>
      <CountdownWidgetView
        size={size}
        now={NOW}
        title={title}
        target={TARGET}
        display={display}
        background={background || undefined}
      />
    </div>
  );
}

const meta = {
  title: 'Cards/Custom/Countdown',
  component: CountdownStoryPreview,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'medium', 'large', 'extra-large'],
    },
    display: {
      control: 'inline-radio',
      options: ['days', 'full'],
    },
    title: { control: 'text' },
    background: {
      control: 'select',
      options: ['', 'builtin:nocturne-01', 'builtin:aurora-haze-02', 'builtin:cinematic-glow-03'],
    },
  },
  parameters: { docs: { description: {} } },
} satisfies Meta<CountdownStoryArgs>;

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

type Story = StoryObj<CountdownStoryArgs>;

const baseArgs: CountdownStoryArgs = {
  size: 'medium',
  display: 'days',
  title: 'Summer holiday',
  background: 'builtin:nocturne-01',
};

export const Playground: Story = { args: baseArgs };

export const Small: Story = { args: { ...baseArgs, size: 'small' } };

export const Medium: Story = { args: baseArgs };

export const Large: Story = { args: { ...baseArgs, size: 'large' } };

export const ExtraLarge: Story = { args: { ...baseArgs, size: 'extra-large' } };

export const FullBreakdown: Story = {
  args: { ...baseArgs, size: 'large', display: 'full' },
};

export const FullBreakdownCompact: Story = {
  args: { ...baseArgs, size: 'small', display: 'full' },
};

export const WithoutImage: Story = {
  args: { ...baseArgs, size: 'large', background: '' },
};

export const ReachedToday: Story = {
  render: (args) => (
    <div style={getCardSizeOverlayStyle(args.size)}>
      <CountdownWidgetView
        size={args.size}
        now={NOW}
        title={args.title}
        target={TODAY_TARGET}
        display={args.display}
        background={args.background || undefined}
      />
    </div>
  ),
  args: { ...baseArgs, size: 'large' },
};

export const EmptyState: Story = {
  render: (args) => (
    <div style={getCardSizeOverlayStyle(args.size)}>
      <CountdownWidgetView
        size={args.size}
        now={NOW}
        target={null}
        display={args.display}
        canConfigure
        onOpenSettings={() => undefined}
      />
    </div>
  ),
  args: { ...baseArgs, size: 'large', background: '' },
};
