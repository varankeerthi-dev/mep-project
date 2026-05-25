const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'CreatePO.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add lucide-react icons
content = content.replace(
  "import { Plus, Save, X, FileText, Upload, CheckCircle, Clock, XCircle, Trash2 } from 'lucide-react';",
  "import { Plus, Save, X, FileText, Upload, CheckCircle, Clock, XCircle, Trash2, GripVertical, Settings } from 'lucide-react';"
);

// 2. Add variants hook and dialog components if missing
if (!content.includes('import { useVariants }')) {
  content = content.replace(
    "import { useProjects } from '../hooks/useProjects';",
    "import { useProjects } from '../hooks/useProjects';\nimport { useVariants } from '../hooks/useVariants';\nimport { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';"
  );
}

// 3. Add state variables
const stateHookPos = content.indexOf('const [lineItems, setLineItems] = useState<POLineItem[]>([]);');
if (stateHookPos !== -1 && !content.includes('const [draggingItemId')) {
  const newStates = `
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);
  const { data: variants = [] } = useVariants();
  const [headerDiscounts, setHeaderDiscounts] = useState<Record<string, number>>({});
  const [draggingItemId, setDraggingItemId] = useState<string | number | null>(null);
  const [showCustomLabelEditor, setShowCustomLabelEditor] = useState(false);
  const [inputDialog, setInputDialog] = useState<{
    open: boolean;
    title: string;
    placeholder: string;
    defaultValue?: string;
    onSubmit: (value: string) => void;
  } | null>(null);
  
  const [templateSettings, setTemplateSettings] = useState<any>({
    column_settings: {
      optional: {
        item_code: true,
        variant: true,
        make: true,
        description: true,
        hsn_sac_code: true,
        rate_per_unit: true,
        discount_percent: true,
        rate_after_discount: true,
        gst_percentage: true,
        line_total: true,
        custom1: false,
        custom2: false
      },
      labels: {
        custom1: 'Custom 1',
        custom2: 'Custom 2',
        rate_after_discount: 'Final Rate'
      }
    }
  });

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, itemId: string | number) => {
    setDraggingItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnRow = (e: React.DragEvent, targetId: string | number) => {
    e.preventDefault();
    if (!draggingItemId || draggingItemId === targetId) return;
    setLineItems((prev) => {
      const fromIndex = prev.findIndex((r) => r.id === draggingItemId);
      const toIndex = prev.findIndex((r) => r.id === targetId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setDraggingItemId(null);
  };

  const handleDragEnd = () => {
    setDraggingItemId(null);
  };

  // Row Additions
  const addEmptyItemRow = () => {
    const newItem: POLineItem = {
      id: Date.now() + Math.random(),
      is_manual: true,
      description: '',
      quantity: 1,
      unit: '',
      rate_per_unit: 0,
      gst_percentage: 18,
      is_header: false,
      is_subtotal: false,
      display_order: 0,
      original_discount_percent: 0,
      discount_percent: 0,
      discount_amount: 0,
      override_flag: false,
      base_rate_snapshot: 0,
      applied_discount_percent: 0,
      is_override: false,
      final_rate_snapshot: 0
    };
    setLineItems([...lineItems, newItem]);
  };

  const addSectionHeader = () => {
    setInputDialog({
      open: true,
      title: 'Add Section Header',
      placeholder: 'Enter section name (e.g. First Floor)',
      onSubmit: (val) => {
        const newItem: POLineItem = {
          id: Date.now() + Math.random(),
          is_header: true,
          description: val,
          is_manual: true,
          quantity: 0,
          unit: '',
          rate_per_unit: 0,
          gst_percentage: 0,
          is_subtotal: false,
          display_order: 0,
          original_discount_percent: 0,
          discount_percent: 0,
          discount_amount: 0,
          override_flag: false,
          base_rate_snapshot: 0,
          applied_discount_percent: 0,
          is_override: false,
          final_rate_snapshot: 0
        };
        setLineItems(prev => [...prev, newItem]);
        setInputDialog(null);
      }
    });
  };

  const addSubtotal = () => {
    setInputDialog({
      open: true,
      title: 'Add Sub-total',
      placeholder: 'Enter sub-total label (e.g. Total A)',
      onSubmit: (val) => {
        const newItem: POLineItem = {
          id: Date.now() + Math.random(),
          is_subtotal: true,
          subtotal_label: val,
          description: '',
          is_manual: true,
          quantity: 0,
          unit: '',
          rate_per_unit: 0,
          gst_percentage: 0,
          is_header: false,
          display_order: 0,
          original_discount_percent: 0,
          discount_percent: 0,
          discount_amount: 0,
          override_flag: false,
          base_rate_snapshot: 0,
          applied_discount_percent: 0,
          is_override: false,
          final_rate_snapshot: 0
        };
        setLineItems(prev => [...prev, newItem]);
        setInputDialog(null);
      }
    });
  };
`;
  content = content.replace('const [lineItems, setLineItems] = useState<POLineItem[]>([]);', newStates);
}

// 4. Overhaul addLineItem to use addEmptyItemRow
content = content.replace(
  /const addLineItem = \(\) => {[\s\S]*?};/,
  "const addLineItem = addEmptyItemRow;"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully injected state and methods into CreatePO.tsx');
