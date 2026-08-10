import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import {
  Save,
  Plus,
  Trash2,
  Pencil,
  Download,
  Upload,
  Search,
  Filter,
  Settings,
  RefreshCw,
  Printer,
  FileText,
  ChevronDown,
  ArrowLeft,
  Check,
  X,
  Eye,
  Copy,
  Send,
  Mail,
} from 'lucide-react';

import { Button, IconButton, buttonVariants } from './button';

// ─── Meta ────────────────────────────────────────────────────────────────────

const meta: Meta<typeof Button> = {
  title: 'Design System/Button',
  component: Button,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline', 'secondary', 'ghost', 'destructive', 'success', 'warning', 'link'],
      description: 'Visual variant of the button',
    },
    size: {
      control: 'select',
      options: ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'],
      description: 'Size of the button',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
    },
    loading: {
      control: 'boolean',
      description: 'Show loading spinner and disable interaction',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Make button full width',
    },
    children: {
      control: 'text',
      description: 'Button content',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// ─── Default ─────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    children: 'Button',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const AllVariants: Story = {
  name: 'Variants',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="default">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="success">Success</Button>
      <Button variant="warning">Warning</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════════
// VISUAL HIERARCHY
// ═══════════════════════════════════════════════════════════════════════════════

export const VisualHierarchy: Story = {
  name: 'Visual Hierarchy',
  description: 'Buttons ordered by visual weight (strongest to weakest)',
  render: () => (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Visual weight decreases left → right</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="default">Primary</Button>
        <Button variant="success">Success</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="warning">Warning</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </div>
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════════
// SIZES
// ═══════════════════════════════════════════════════════════════════════════════

export const AllSizes: Story = {
  name: 'Sizes',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">XS (28px)</Button>
      <Button size="sm">SM (32px)</Button>
      <Button size="default">MD (36px)</Button>
      <Button size="lg">LG (40px)</Button>
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════════
// DISABLED
// ═══════════════════════════════════════════════════════════════════════════════

export const Disabled: Story = {
  name: 'Disabled',
  render: () => (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">All variants in disabled state</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled>Primary</Button>
        <Button variant="secondary" disabled>Secondary</Button>
        <Button variant="outline" disabled>Outline</Button>
        <Button variant="ghost" disabled>Ghost</Button>
        <Button variant="destructive" disabled>Destructive</Button>
        <Button variant="success" disabled>Success</Button>
        <Button variant="warning" disabled>Warning</Button>
        <Button variant="link" disabled>Link</Button>
      </div>
      <p className="text-xs text-muted-foreground">Icon buttons disabled</p>
      <div className="flex flex-wrap items-center gap-3">
        <IconButton disabled aria-label="Disabled save"><Save /></IconButton>
        <IconButton variant="secondary" disabled aria-label="Disabled settings"><Settings /></IconButton>
        <IconButton variant="destructive" disabled aria-label="Disabled delete"><Trash2 /></IconButton>
      </div>
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING
// ═══════════════════════════════════════════════════════════════════════════════

export const Loading: Story = {
  name: 'Loading',
  render: () => (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Loading states — spinner replaces icon position</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button loading loadingText="Saving...">Save</Button>
        <Button variant="secondary" loading loadingText="Canceling...">Cancel</Button>
        <Button variant="success" loading loadingText="Approving...">Approve</Button>
        <Button variant="destructive" loading loadingText="Deleting...">Delete</Button>
        <Button variant="outline" loading loadingText="Exporting...">Export</Button>
      </div>
      <p className="text-xs text-muted-foreground">Loading without text (spinner only)</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button loading>Save</Button>
        <Button variant="secondary" loading>Cancel</Button>
        <Button variant="success" loading>Approve</Button>
      </div>
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════════
// FOCUS (Keyboard Navigation)
// ═══════════════════════════════════════════════════════════════════════════════

export const KeyboardFocus: Story = {
  name: 'Keyboard Focus',
  description: 'Press Tab to see focus ring on each button',
  render: () => (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Press Tab to navigate — focus ring appears on keyboard focus</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button>Tab → Me</Button>
        <Button variant="secondary">Then Me</Button>
        <Button variant="outline">Then Me</Button>
        <Button variant="ghost">Then Me</Button>
        <Button variant="destructive">Then Me</Button>
      </div>
      <p className="text-xs text-muted-foreground mt-4">Focus ring: 2px blue ring with offset</p>
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════════════

export const WithLeftIcon: Story = {
  name: 'Icons / Left Icon',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button leftIcon={<Plus />}>Add</Button>
      <Button leftIcon={<Save />}>Save</Button>
      <Button leftIcon={<Download />}>Export</Button>
      <Button leftIcon={<Upload />}>Upload</Button>
      <Button leftIcon={<Trash2 />}>Delete</Button>
      <Button leftIcon={<Check />}>Approve</Button>
      <Button leftIcon={<RefreshCw />}>Retry</Button>
      <Button leftIcon={<Settings />}>Settings</Button>
    </div>
  ),
};

export const WithRightIcon: Story = {
  name: 'Icons / Right Icon',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button rightIcon={<ChevronDown />}>Dropdown</Button>
      <Button variant="secondary" rightIcon={<ArrowLeft />}>Back</Button>
    </div>
  ),
};

export const IconOnly: Story = {
  name: 'Icons / Icon Only',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <IconButton aria-label="Add"><Plus /></IconButton>
      <IconButton aria-label="Save"><Save /></IconButton>
      <IconButton aria-label="Delete"><Trash2 /></IconButton>
      <IconButton aria-label="Edit"><Pencil /></IconButton>
      <IconButton aria-label="Download"><Download /></IconButton>
      <IconButton aria-label="Upload"><Upload /></IconButton>
      <IconButton aria-label="Search"><Search /></IconButton>
      <IconButton aria-label="Settings"><Settings /></IconButton>
      <IconButton aria-label="Refresh"><RefreshCw /></IconButton>
      <IconButton aria-label="Print"><Printer /></IconButton>
    </div>
  ),
};

export const StandardIcons: Story = {
  name: 'Icons / Standard Set',
  description: 'Approved icon set for ERP buttons',
  render: () => (
    <div className="grid grid-cols-4 gap-3">
      {[
        { icon: <Plus />, label: 'Add', text: 'Add' },
        { icon: <Save />, label: 'Save', text: 'Save' },
        { icon: <Trash2 />, label: 'Delete', text: 'Delete' },
        { icon: <Pencil />, label: 'Edit', text: 'Edit' },
        { icon: <Download />, label: 'Download', text: 'Download' },
        { icon: <Upload />, label: 'Upload', text: 'Upload' },
        { icon: <Search />, label: 'Search', text: 'Search' },
        { icon: <Filter />, label: 'Filter', text: 'Filter' },
        { icon: <Settings />, label: 'Settings', text: 'Settings' },
        { icon: <RefreshCw />, label: 'Refresh', text: 'Refresh' },
        { icon: <Printer />, label: 'Print', text: 'Print' },
        { icon: <FileText />, label: 'PDF', text: 'PDF' },
        { icon: <Check />, label: 'Approve', text: 'Approve' },
        { icon: <X />, label: 'Reject', text: 'Reject' },
        { icon: <Eye />, label: 'View', text: 'View' },
        { icon: <Copy />, label: 'Copy', text: 'Copy' },
        { icon: <Send />, label: 'Send', text: 'Send' },
        { icon: <Mail />, label: 'Email', text: 'Email' },
      ].map(({ icon, label, text }) => (
        <Button key={label} variant="outline" leftIcon={icon}>
          {text}
        </Button>
      ))}
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════════
// FULL WIDTH
// ═══════════════════════════════════════════════════════════════════════════════

export const FullWidth: Story = {
  name: 'Full Width',
  render: () => (
    <div className="w-80 space-y-3">
      <Button fullWidth>Full Width Primary</Button>
      <Button variant="secondary" fullWidth>Full Width Secondary</Button>
      <Button variant="outline" fullWidth>Full Width Outline</Button>
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION HIERARCHY
// ═══════════════════════════════════════════════════════════════════════════════

export const ActionHierarchy: Story = {
  name: 'Action Hierarchy',
  description: 'Real-world button groupings',
  render: () => (
    <div className="space-y-6">
      {/* Save / Cancel */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Save / Cancel</p>
        <div className="flex gap-2">
          <Button leftIcon={<Save />}>Save</Button>
          <Button variant="secondary">Cancel</Button>
        </div>
      </div>

      {/* Submit / Save as Draft / Cancel */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Submit Flow</p>
        <div className="flex gap-2">
          <Button leftIcon={<Check />}>Submit</Button>
          <Button variant="outline">Save as Draft</Button>
          <Button variant="secondary">Cancel</Button>
        </div>
      </div>

      {/* Approve / Reject */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Approval Flow</p>
        <div className="flex gap-2">
          <Button variant="success" leftIcon={<Check />}>Approve</Button>
          <Button variant="destructive" leftIcon={<X />}>Reject</Button>
        </div>
      </div>

      {/* Delete Confirmation */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Destructive Action</p>
        <div className="flex gap-2">
          <Button variant="destructive" leftIcon={<Trash2 />}>Delete</Button>
          <Button variant="secondary">Cancel</Button>
        </div>
      </div>

      {/* Export / Print / PDF */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Utility Actions</p>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download />}>Export</Button>
          <Button variant="outline" leftIcon={<Printer />}>Print</Button>
          <Button variant="outline" leftIcon={<FileText />}>PDF</Button>
        </div>
      </div>

      {/* Inline Actions */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Inline Actions</p>
        <div className="flex gap-2">
          <Button variant="ghost" leftIcon={<Eye />}>View</Button>
          <Button variant="ghost" leftIcon={<Pencil />}>Edit</Button>
          <Button variant="ghost" leftIcon={<Copy />}>Duplicate</Button>
        </div>
      </div>
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════════
// LONG TEXT
// ═══════════════════════════════════════════════════════════════════════════════

export const LongText: Story = {
  name: 'Long Labels',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Save</Button>
      <Button>Generate Client Purchase Order</Button>
      <Button variant="secondary">Export All Financial Reports to PDF</Button>
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT × SIZE MATRIX
// ═══════════════════════════════════════════════════════════════════════════════

export const VariantSizeMatrix: Story = {
  name: 'Variant × Size Matrix',
  render: () => {
    const variants = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'success', 'warning'] as const;
    const sizes = ['xs', 'sm', 'default', 'lg'] as const;

    return (
      <div className="space-y-4">
        {variants.map((variant) => (
          <div key={variant} className="flex items-center gap-3">
            <span className="w-24 text-xs font-medium text-muted-foreground capitalize">
              {variant}
            </span>
            {sizes.map((size) => (
              <Button key={`${variant}-${size}`} variant={variant} size={size}>
                {size.toUpperCase()}
              </Button>
            ))}
          </div>
        ))}
      </div>
    );
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// DARK MODE
// ═══════════════════════════════════════════════════════════════════════════════

export const DarkMode: Story = {
  name: 'Dark Mode',
  parameters: {
    backgrounds: { default: 'dark', values: [{ name: 'dark', value: '#18181b' }] },
    themes: { dark: true },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-zinc-900 p-6">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="success">Success</Button>
      <Button variant="warning">Warning</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════════
// ICONBUTTON
// ═══════════════════════════════════════════════════════════════════════════════

export const IconButtonVariants: Story = {
  name: 'IconButton / Variants',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <IconButton variant="default" aria-label="Primary icon"><Save /></IconButton>
      <IconButton variant="secondary" aria-label="Secondary icon"><Settings /></IconButton>
      <IconButton variant="outline" aria-label="Outline icon"><Search /></IconButton>
      <IconButton variant="ghost" aria-label="Ghost icon"><Eye /></IconButton>
      <IconButton variant="destructive" aria-label="Destructive icon"><Trash2 /></IconButton>
      <IconButton variant="success" aria-label="Success icon"><Check /></IconButton>
      <IconButton variant="warning" aria-label="Warning icon"><RefreshCw /></IconButton>
    </div>
  ),
};

export const IconButtonSizes: Story = {
  name: 'IconButton / Sizes',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <IconButton size="icon-xs" aria-label="Extra small"><Settings /></IconButton>
      <IconButton size="icon-sm" aria-label="Small"><Settings /></IconButton>
      <IconButton size="icon" aria-label="Default"><Settings /></IconButton>
      <IconButton size="icon-lg" aria-label="Large"><Settings /></IconButton>
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYGROUND
// ═══════════════════════════════════════════════════════════════════════════════

export const Playground: Story = {
  name: 'Playground',
  args: {
    variant: 'default',
    size: 'default',
    children: 'Button',
    disabled: false,
    loading: false,
    fullWidth: false,
  },
};
