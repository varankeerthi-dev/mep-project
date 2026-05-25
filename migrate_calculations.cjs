const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'CreatePO.tsx');
let content = fs.readFileSync(file, 'utf8');

const calcSection = `
  const calculateLineTotal = (item: POLineItem) => {
    if (item.is_header || item.is_subtotal) return 0;
    const baseRate = parseFloat(item.base_rate_snapshot?.toString() || item.rate_per_unit?.toString() || '0');
    const discount = parseFloat(item.applied_discount_percent?.toString() || item.discount_percent?.toString() || '0');
    const finalRate = baseRate - (baseRate * discount / 100);
    return (item.quantity || 0) * finalRate;
  };

  const calculateBasicTotal = () => {
    return lineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  };

  const calculateGSTTotal = () => {
    return lineItems.reduce((sum, item) => {
      if (item.is_header || item.is_subtotal) return sum;
      const lineBasic = calculateLineTotal(item);
      return sum + (lineBasic * ((item.gst_percentage || 0) / 100));
    }, 0);
  };

  const calculateGrandTotal = () => {
    return calculateBasicTotal() + calculateGSTTotal();
  };
`;

// Replace the old calculation functions
content = content.replace(
  /const calculateLineTotal = [\s\S]*?const calculateGrandTotal = \(\) => {[\s\S]*?};/,
  calcSection.trim()
);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully injected calculation methods into CreatePO.tsx');
