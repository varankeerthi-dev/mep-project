import React from "react";
import { formatCurrency, formatDate } from "../utils/formatters";
import { 
  Phone,
  Mail,
  Globe,
  MapPin
} from "lucide-react";

/* ---------------- HELPERS ---------------- */

const getDocumentNumber = (data: any) => {
  if (data.quotation_no) return data.quotation_no;
  if (data.invoice_no) return data.invoice_no;
  if (data.proforma_no) return data.proforma_no;
  if (data.dc_number) return data.dc_number;
  if (data.challan_no) return data.challan_no;
  
  const type = data.document_type?.toUpperCase();
  switch (type) {
    case "QUOTATION": return data.quotation_no;
    case "INVOICE": return data.invoice_no;
    case "PROFORMA": return data.proforma_no || data.quotation_no;
    case "DELIVERY_CHALLAN": return data.dc_number;
    default: return "-";
  }
};

const getActiveColumns = (config: any) => {
  // New structure support
  if (config?.columns && Array.isArray(config.columns) && config.columns.length > 0) {
    return config.columns
      .filter((c: any) => c.enabled)
      .sort((a: any, b: any) => a.order - b.order);
  }

  const labels = config?.labels || {};
  const optional = config?.optional || {};

  const allPossible = [
    { key: "sno", label: labels.sno || "S.No.", width: "5%" },
    { key: "hsn_code", label: labels.hsn_code || "HSN/SAC", width: "10%" },
    { key: "item", label: labels.item || "Item Name", width: "25%" },
    { key: "client_part_no", label: labels.client_part_no || "Client Part No", width: "10%" },
    { key: "client_description", label: labels.client_description || "Client Description", width: "15%" },
    { key: "variant", label: labels.variant || "Variant", width: "10%" },
    { key: "description", label: labels.description || "Description", width: "20%" },
    { key: "make", label: labels.make || "Make", width: "10%" },
    { key: "qty", label: labels.qty || "Qty", width: "7%" },
    { key: "uom", label: labels.uom || "Unit", width: "7%" },
    { key: "rate", label: labels.rate || "Rate(before disc)", width: "12%", align: "right" },
    { key: "discount_percent", label: labels.discount_percent || "Disc %", width: "7%", align: "right" },
    { key: "rate_after_discount", label: labels.rate_after_discount || "Rate(after discount)", width: "12%", align: "right" },
    { key: "tax_percent", label: labels.tax_percent || "GST %", width: "7%", align: "right" },
    { key: "base_amount", label: labels.base_amount || "Amount", width: "15%", align: "right" },
    { key: "tax_amount", label: labels.tax_amount || "Tax Amt", width: "10%", align: "right" },
    { key: "line_total", label: labels.line_total || "Final Total", width: "12%", align: "right" }
  ];

  return allPossible.filter(c => optional[c.key] !== false);
};

const getCellValue = (item: any, key: string, index: number, quotation: any) => {
  const beforeDiscRate = Number(item.base_rate_snapshot || item.rate || 0);
  const netRate = Number(item.rate || 0);
  const qty = Number(item.qty || 0);
  const discPct = Number(item.discount_percent || 0);
  
  const baseAmount = qty * netRate;
  const taxPct = Number(item.tax_percent || 0);
  const taxAmount = (baseAmount * taxPct) / 100;
  const finalTotal = baseAmount + taxAmount;

  const clientId = quotation?.client_id || quotation?.client?.id;
  const mapping = clientId && item.item?.mappings?.find((m: any) => m.client_id === clientId);
  
  switch (key) {
    case "sno": return index + 1;
    case "hsn_code": return item.sac_code || item.item?.hsn_code || "-";
    case "item": return mapping?.client_description || item.item?.name || "-";
    case "item_code": return mapping?.client_part_no || item.item?.item_code || "-";
    case "client_part_no": return mapping?.client_part_no || "-";
    case "client_description": return mapping?.client_description || "-";
    case "variant": return item.variant || "-";
    case "description": return mapping?.client_description || item.description || "-";
    case "make": return item.make || item.item?.make || "-";
    case "qty": return qty;
    case "uom": return item.uom || item.item?.uom || "Nos";
    case "rate": return beforeDiscRate;
    case "discount_percent": return discPct;
    case "rate_after_discount": return netRate;
    case "base_amount": return baseAmount;
    case "tax_percent": return taxPct;
    case "tax_amount": return taxAmount;
    case "line_total": return finalTotal;
    default: return item[key] ?? "";
  }
};

const numberToWords = (num: number): string => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (val: number): string => {
    if (val === 0) return '';
    const s = ('000000000' + val).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!s) return '';
    let str = '';
    str += (Number(s[1]) !== 0) ? (a[Number(s[1])] || b[Number(s[1][0])] + ' ' + a[Number(s[1][1])]) + 'Crore ' : '';
    str += (Number(s[2]) !== 0) ? (a[Number(s[2])] || b[Number(s[2][0])] + ' ' + a[Number(s[2][1])]) + 'Lakh ' : '';
    str += (Number(s[3]) !== 0) ? (a[Number(s[3])] || b[Number(s[3][0])] + ' ' + a[Number(s[3][1])]) + 'Thousand ' : '';
    str += (Number(s[4]) !== 0) ? (a[Number(s[4])] || b[Number(s[4][0])] + ' ' + a[Number(s[4][1])]) + 'Hundred ' : '';
    str += (Number(s[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(s[5])] || b[Number(s[5][0])] + ' ' + a[Number(s[5][1])]) : '';
    return str.trim();
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = convert(rupees);
  if (paise > 0) {
    result += (result ? ' and ' : '') + convert(paise) + ' Paise';
  }
  return result || 'Zero';
};

/* ---------------- MAIN COMPONENT ---------------- */

export default function VerticalTemplate({
  data,
  organisation,
  templateConfig
}: any) {
  const columns = getActiveColumns(templateConfig);
  const docNo = getDocumentNumber(data);
  const docType = data.document_type || "QUOTATION";
  const optional = templateConfig?.optional || {};

  // Group items
  const processedItems: any[] = [];
  let currentGroup = "";
  let groupIndex = 0;
  let itemInGroupIndex = 0;

  data.items?.forEach((item: any) => {
    if (item.is_header) {
      currentGroup = item.description;
      groupIndex++;
      itemInGroupIndex = 0;
      processedItems.push({ ...item, group_no: groupIndex, type: 'header' });
    } else {
      itemInGroupIndex++;
      processedItems.push({ 
        ...item, 
        sno_display: currentGroup ? `${groupIndex}.${itemInGroupIndex}` : `${processedItems.length + 1}`,
        type: 'item' 
      });
    }
  });

  // Prepare info bar fields
  const infoFields = [
    { label: "PO No.", value: data.po_no, key: 'po_no' },
    { label: "PO Date", value: formatDate(data.po_date), key: 'po_date' },
    { label: "Valid Till", value: formatDate(data.valid_till), key: 'valid_till' },
    { label: "Payment Terms", value: data.payment_terms, key: 'payment_terms' },
    { label: "Reference", value: data.reference, key: 'reference' },
    { label: "E-Way Bill", value: data.eway_bill, key: 'eway_bill' },
    { label: "Vendor No.", value: data.client?.vendor_no, key: 'vendor_no' }
  ]
  .filter(f => optional[f.key] !== false)
  .filter(f => f.value && f.value !== "-" && f.value !== "" && f.value !== formatDate(null));

  // Calculate taxes by rate for mixed tax scenarios
  const calculateTaxesByRate = () => {
    const taxGroups: { [key: string]: { baseAmount: number; taxAmount: number; sgst: number; cgst: number } } = {};
    
    data.items?.forEach((item: any) => {
      if (item.is_header) return;
      
      const qty = Number(item.qty || 0);
      const netRate = Number(item.rate || 0);
      const baseAmount = qty * netRate;
      const taxPct = Number(item.tax_percent || 0);
      
      if (taxPct > 0) {
        if (!taxGroups[taxPct]) {
          taxGroups[taxPct] = { baseAmount: 0, taxAmount: 0, sgst: 0, cgst: 0 };
        }
        
        const taxAmount = (baseAmount * taxPct) / 100;
        const sgst = taxAmount / 2;
        const cgst = taxAmount / 2;
        
        taxGroups[taxPct].baseAmount += baseAmount;
        taxGroups[taxPct].taxAmount += taxAmount;
        taxGroups[taxPct].sgst += sgst;
        taxGroups[taxPct].cgst += cgst;
      }
    });
    
    return taxGroups;
  };

  const taxGroups = calculateTaxesByRate();

  return (
    <div className="vertical-template-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&family=Manrope:wght@800;900&display=swap');
        
        .vertical-template-container {
          font-family: 'Roboto', sans-serif;
          width: 210mm;
          min-height: 297mm;
          background: white;
          color: #1e293b;
          font-size: 11px;
          line-height: 1.3;
          display: flex;
          flex-direction: column;
          -webkit-print-color-adjust: exact;
        }

        .org-name-font {
          font-family: 'Manrope', sans-serif !important;
          font-weight: 900 !important;
        }

        .doc-no-font {
          font-family: 'Manrope', sans-serif !important;
          font-weight: 800 !important;
        }

        /* Hex-based Color Fallbacks for html2canvas (OKLCH not supported) */
        .txt-slate-900 { color: #0f172a !important; }
        .txt-slate-800 { color: #1e293b !important; }
        .txt-slate-700 { color: #334155 !important; }
        .txt-slate-600 { color: #475569 !important; }
        .txt-slate-500 { color: #64748b !important; }
        .txt-slate-400 { color: #94a3b8 !important; }
        .txt-blue-600 { color: #2563eb !important; }
        .txt-blue-700 { color: #1d4ed8 !important; }
        .txt-red-600 { color: #dc2626 !important; }
        
        .bg-slate-50 { background-color: #f8fafc !important; }
        .bg-slate-100 { background-color: #f1f5f9 !important; }
        .bg-slate-900 { background-color: #0f172a !important; }
        
        .brd-slate-100 { border-color: #f1f5f9 !important; }
        .brd-slate-200 { border-color: #e2e8f0 !important; }
        .brd-slate-300 { border-color: #cbd5e1 !important; }
        .brd-slate-900 { border-color: #0f172a !important; }
        
        /* Force Hex on SVGs for html2canvas */
        svg {
          stroke: currentColor !important;
          fill: none;
        }
        svg * {
          stroke: inherit !important;
          fill: inherit !important;
        }

        .a4-page {
          height: 297mm;
          padding: 2mm 5mm;
          display: flex;
          flex-direction: column;
          position: relative;
          page-break-after: always;
        }

        .dense-header {
          padding-bottom: 8px;
          border-bottom: 1.5px solid #e2e8f0;
        }

        .grid-table {
          width: 100%;
          border: 1px solid #94a3b8;
          border-collapse: collapse;
        }

        .grid-table th {
          background: #f1f5f9;
          border: 1px solid #94a3b8;
          padding: 6px 6px;
          text-transform: uppercase;
          font-weight: 700;
          font-size: 9px;
          color: #334155;
          font-family: 'Roboto', sans-serif;
          vertical-align: middle;
          height: 28px;
          line-height: 1.2;
          display: table-cell;
          text-align: left;
        }

        .grid-table td {
          border-right: 1px solid #cbd5e1;
          border-bottom: 0.5px solid #f1f5f9;
          padding: 4px 6px;
          vertical-align: top;
          font-size: 10px;
          font-weight: 400; /* normal thickness */
          color: #0f172a;
          font-family: 'Roboto', sans-serif;
        }

        .grid-table tr:last-child td {
          border-bottom: none;
        }

        .footer-fixed {
          margin-top: auto;
          border-top: 1.5px solid #94a3b8;
          padding-top: 2px;
        }

        .amount-words {
          font-style: italic;
          color: #475569;
          font-size: 10px;
          margin-top: 4px;
          font-weight: 600;
        }

        @media print {
          .vertical-template-container { width: 210mm; }
          .a4-page { height: 297mm; border: none; }
        }
      `}</style>

      {/* ---------------- PAGE 1 ---------------- */}
      <div className="a4-page">
        {/* Header */}
        <div className="dense-header flex justify-between items-start pt-2">
          <div className="flex gap-5">
            <div className="w-20 h-20 bg-slate-900 rounded-lg flex items-center justify-center text-white shrink-0 overflow-hidden border brd-slate-200">
              {organisation.logo_url ? (
                <img src={organisation.logo_url} alt="Logo" className="w-full h-full object-contain bg-white p-1" crossOrigin="anonymous" />
              ) : (
                <span className="text-4xl font-bold italic">{organisation.name?.[0] || 'S'}</span>
              )}
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-2xl font-black txt-slate-900 tracking-tight leading-tight org-name-font">
                {organisation.name}
              </div>
              <div className="text-[10px] txt-blue-600 font-bold uppercase tracking-widest mb-2">
                {organisation.subtitle || organisation.description || "Engineering & Manufacturing Solutions"}
              </div>
              <div className="grid grid-cols-1 gap-1 txt-slate-600 text-[10px]">
                <div className="flex items-center gap-1.5" style={{ minHeight: '16px' }}>
                  <MapPin size={10} className="txt-slate-400 flex-shrink-0" />
                  <span className="max-w-[450px]">{organisation.address}</span>
                </div>
                <div className="flex gap-4" style={{ minHeight: '16px' }}>
                  <div className="flex items-center gap-1.5">
                    <Phone size={10} className="txt-slate-400 flex-shrink-0" />
                    <span className="font-bold">{organisation.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-bold txt-slate-800 uppercase">
                    <span className="txt-slate-400 flex-shrink-0">GSTIN:</span>
                    <span>{organisation.gstin}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5" style={{ minHeight: '16px' }}>
                  <Mail size={10} className="txt-slate-400 flex-shrink-0" />
                  <span className="font-bold">{organisation.email}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-4xl font-black txt-slate-900 tracking-tighter leading-none">
              {docType.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Info Bar - Clean Layout */}
        {infoFields.length > 0 && (
          <div className="mt-0 grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 py-1 text-[11px] font-bold">
          <div className="p-2 grid grid-cols-[90px_1fr] gap-x-2">
            <div className="txt-slate-500 font-bold uppercase text-[9px]">{docType} No</div><div className="font-bold doc-no-font">: {docNo}</div>
            <div className="txt-slate-500 font-bold uppercase text-[9px]">{docType} Date</div><div className="font-bold">: {formatDate(data.date)}</div>
          </div>
          <div className="p-2 grid grid-cols-[90px_1fr] gap-x-2">
            {infoFields.slice(0, 2).map((f, i) => (
              <React.Fragment key={i}>
                <div className="txt-slate-500 font-bold uppercase text-[9px]">{f.label}</div>
                <div className="font-bold">: {f.value || "-"}</div>
              </React.Fragment>
            ))}
          </div>
          <div className="p-2 grid grid-cols-[90px_1fr] gap-x-2">
            {infoFields.slice(2).map((f, i) => (
              <React.Fragment key={i}>
                <div className="txt-slate-500 font-bold uppercase text-[9px]">{f.label}</div>
                <div className="font-bold">: {f.value || "-"}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
        )}

        {/* Billing & Shipping */}
        {(optional.bill_to !== false || optional.ship_to !== false) && (
          <div className="mt-1 grid grid-cols-2 gap-4">
            {optional.bill_to !== false && (
              <div className="bg-slate-50 p-2 border-l-2 brd-slate-900" style={{ backgroundColor: '#f8fafc' }}>
                <div className="text-[10px] font-black uppercase txt-slate-900 mb-1 tracking-widest">Bill To</div>
                <div className="font-extrabold txt-slate-900 text-[12px] leading-tight mb-1">
                  {data.client?.client_name || data.client?.name}
                </div>
                <div className="text-[11px] txt-slate-600 leading-relaxed mb-2">
                  {data.billing_address || [data.client?.address, data.client?.city, data.client?.state, data.client?.pincode].filter(Boolean).join(", ")}
                </div>
                <div className="mt-auto grid grid-cols-1 gap-0.5 text-[10px] font-bold">
                  <div className="flex gap-2"><span className="txt-slate-400 uppercase w-12">GSTIN</span><span className="txt-slate-900">: {data.client?.gstin || data.gstin || "-"}</span></div>
                  <div className="flex gap-2"><span className="txt-slate-400 uppercase w-12">Contact</span><span className="txt-slate-900">: {data.client?.phone || data.client_contact || "-"}</span></div>
                </div>
              </div>
            )}
            {optional.ship_to !== false && (
              <div className="bg-slate-50 p-2 border-l-2 brd-slate-300" style={{ backgroundColor: '#f8fafc' }}>
                <div className="text-[10px] font-black uppercase txt-slate-900 mb-1 tracking-widest">Ship To / Project</div>
                <div className="font-extrabold txt-slate-900 text-[12px] leading-tight mb-1">
                  {data.shipping_company_name || data.client?.client_name || data.client?.name}
                </div>
                <div className="text-[11px] txt-slate-600 leading-relaxed mb-2">
                  {data.shipping_address || data.billing_address || [data.client?.address, data.client?.city, data.client?.state, data.client?.pincode].filter(Boolean).join(", ")}
                </div>
                <div className="mt-auto grid grid-cols-1 gap-0.5 text-[10px] font-bold">
                  <div className="flex gap-2"><span className="txt-slate-400 uppercase w-12">GSTIN</span><span className="txt-slate-900">: {data.client?.gstin || data.gstin || "-"}</span></div>
                  <div className="flex gap-2"><span className="txt-slate-400 uppercase w-12">Contact</span><span className="txt-slate-900">: {data.client?.phone || data.client_contact || "-"}</span></div>
                  {optional.project_name !== false && data.project_name && <div className="txt-blue-700 mt-1 uppercase text-[9px] tracking-tight font-black">Project: {data.project_name}</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Table - Optimized for 15+ items */}
        <div className="mt-3 flex-1 overflow-hidden">
          <table className="grid-table">
            <thead>
              <tr>
                {columns.map((col: any) => (
                  <th key={col.key} style={{ width: col.width, textAlign: col.align || 'left' }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {processedItems.map((item, idx) => {
                const clientId = data?.client_id || data?.client?.id;
                const mapping = clientId && item.item?.mappings?.find((m: any) => m.client_id === clientId);
                return (
                  <React.Fragment key={idx}>
                  {item.type === 'header' ? (
                    <tr className="bg-slate-50">
                      <td colSpan={columns.length} className="font-black text-blue-900 uppercase tracking-tight py-1 text-[10px]">
                        {item.group_no}. {item.description}
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      {columns.map((col: any) => (
                        <td key={col.key} style={{ textAlign: col.align || 'left' }}>
                          {col.key === 'sno' ? (
                            <span className="font-bold text-slate-400 text-[10px]">{item.sno_display}</span>
                          ) : col.key === 'item' ? (
                            <div>
                              <div className="font-bold text-slate-900">{getCellValue(item, col.key, idx, data)}</div>
                              {item.description && <div className="text-[9px] text-slate-500 mt-0.5 leading-none">{mapping?.client_description || item.description}</div>}
                            </div>
                          ) : (
                            <span className={col.align === 'right' ? 'font-bold' : ''}>
                              {(() => {
                                const val = getCellValue(item, col.key, idx, data);
                                const isCurrency = ["rate", "rate_after_discount", "base_amount", "tax_amount", "line_total"].includes(col.key);
                                const isPercent = ["discount_percent", "tax_percent"].includes(col.key);
                                if (isCurrency) return formatCurrency(val);
                                if (isPercent) return `${val}%`;
                                return val;
                              })()}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  )}
                </React.Fragment>
              )})}
              {/* Fill remaining space to keep layout consistent */}
              {Array.from({ length: Math.max(0, 30 - processedItems.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="h-6">
                  {columns.map((col: any) => (
                    <td key={col.key}>&nbsp;</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Footer Section - FIXED AT BOTTOM */}
        <div className="footer-fixed mt-auto">
          <div className="flex justify-between items-start gap-8">
            {/* Left Column: Amount in Words and Bank Details */}
            <div className="flex-grow flex flex-col justify-between self-stretch py-0">
              <div className="brd-slate-200 border-t border-b py-1 mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[8px] font-black uppercase txt-slate-400 tracking-widest">Amount in Words</span>
                  <div className="h-px bg-slate-100 flex-grow"></div>
                </div>
                <div className="text-[12px] font-black txt-slate-900 italic uppercase">
                  Indian Rupees {numberToWords(data.grand_total)} Only
                </div>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase txt-slate-400 mb-1 tracking-widest flex items-center gap-2">
                  <span>Bank Details</span>
                  <div className="h-px bg-slate-100 flex-grow"></div>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-x-2 text-[12px] border brd-slate-100 p-2 rounded" style={{ backgroundColor: '#fafbfc' }}>
                  <div className="txt-slate-500 font-bold uppercase text-[8px]">Bank</div><div className="font-bold text-slate-900">: {organisation.bank_details?.bank_name}</div>
                  <div className="txt-slate-500 font-bold uppercase text-[8px]">A/C No</div><div className="font-bold text-slate-900">: {organisation.bank_details?.account_no}</div>
                  <div className="txt-slate-500 font-bold uppercase text-[8px]">IFSC</div><div className="font-bold text-slate-900">: {organisation.bank_details?.ifsc_code}</div>
                  <div className="txt-slate-500 font-bold uppercase text-[8px]">Branch</div><div className="font-bold text-slate-900">: {organisation.bank_details?.branch_name || organisation.bank_details?.branch}</div>
                </div>
              </div>
            </div>

            {/* Right Column: Financial Totals */}
            <div className="w-[300px] shrink-0">
              <div className="space-y-1.5 p-1">
                {optional.subtotal !== false && (
                  <div className="flex justify-between txt-slate-600 text-[11px]">
                    <span className="font-bold uppercase">Sub-Total</span>
                    <span className="font-bold">{formatCurrency(data.subtotal)}</span>
                  </div>
                )}
                {data.discount_amount > 0 && (
                  <div className="flex justify-between txt-red-600 text-[11px]">
                    <span className="font-bold uppercase">Discount</span>
                    <span className="font-bold">-{formatCurrency(data.discount_amount)}</span>
                  </div>
                )}
                {optional.total_tax !== false && (
                  <>
                    {Object.keys(taxGroups).length > 0 ? (
                      Object.entries(taxGroups).map(([rate, taxes]) => (
                        <React.Fragment key={rate}>
                          <div className="flex justify-between txt-slate-500 text-[10px] border-t brd-slate-100 mt-1 pt-1">
                            <span className="font-bold uppercase">SGST {Number(rate) / 2}%</span>
                            <span className="font-bold">{formatCurrency(taxes.sgst)}</span>
                          </div>
                          <div className="flex justify-between txt-slate-500 text-[10px]">
                            <span className="font-bold uppercase">CGST {Number(rate) / 2}%</span>
                            <span className="font-bold">{formatCurrency(taxes.cgst)}</span>
                          </div>
                        </React.Fragment>
                      ))
                    ) : (
                      <>
                        <div className="flex justify-between txt-slate-500 text-[10px] border-t brd-slate-100 mt-1 pt-1">
                          <span className="font-bold uppercase">SGST</span>
                          <span className="font-bold">{formatCurrency(data.total_tax / 2)}</span>
                        </div>
                        <div className="flex justify-between txt-slate-500 text-[10px]">
                          <span className="font-bold uppercase">CGST</span>
                          <span className="font-bold">{formatCurrency(data.total_tax / 2)}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
                {optional.round_off !== false && (
                  <div className="flex justify-between txt-slate-400 text-[10px]">
                    <span className="font-bold uppercase">Round Off</span>
                    <span className="font-bold">{formatCurrency(data.round_off || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-900 pt-2 mt-2">
                  <span className="font-black uppercase text-[12px] txt-slate-900">Grand Total</span>
                  <span className="font-black text-xl txt-slate-900 leading-none">{formatCurrency(data.grand_total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-1 flex justify-between items-end">
            <div className="text-[9px] txt-slate-400 font-bold uppercase italic">
              * This is a computer generated document.
            </div>
            <div className="text-right">
              <div className="font-black uppercase text-[11px] txt-slate-900 mb-0">
                FOR {organisation.name}
              </div>
              <div className="h-16 flex items-center justify-end mb-1">
                {organisation.signatures?.find((s: any) => String(s.id) === String(data.authorized_signatory_id))?.url ? (
                  <img 
                    src={organisation.signatures.find((s: any) => String(s.id) === String(data.authorized_signatory_id)).url} 
                    alt="Signature" 
                    className="max-h-full max-w-[200px] object-contain"
                  />
                ) : organisation.signatures?.[0]?.url ? (
                  <img 
                    src={organisation.signatures[0].url} 
                    alt="Signature" 
                    className="max-h-full max-w-[200px] object-contain"
                  />
                ) : (
                  <div className="h-10"></div>
                )}
              </div>
              <div className="font-black uppercase text-[11px] txt-slate-900 border-t-2 brd-slate-900 pt-1 px-6 inline-block">
                Authorised Signature
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- PAGE 2: TERMS ---------------- */}
      <div className="a4-page">
        <div className="dense-header flex justify-between items-center">
          <div className="text-lg font-black txt-slate-900 uppercase tracking-tighter">Terms & Conditions</div>
          <div className="txt-slate-400 font-bold text-[10px]">Annexure to {docNo}</div>
        </div>
        
        <div className="mt-4 flex-1 text-[11px] leading-relaxed txt-slate-700 font-medium">
          <div dangerouslySetInnerHTML={{ 
            __html: (() => {
              let termsText = '';
              
              // Handle new Terms & Conditions format
              if (data.terms_conditions) {
                try {
                  const termsData = typeof data.terms_conditions === 'string' 
                    ? JSON.parse(data.terms_conditions) 
                    : data.terms_conditions;
                  
                  if (termsData && termsData.sections) {
                    termsText = termsData.sections.map((section: any, sectionIndex: number) => {
                      const sectionTitle = `${sectionIndex + 1}. ${section.title}`;
                      const items = section.items ? section.items.map((item: any, itemIndex: number) => {
                        const prefix = item.item_type === 'bullet' ? '•' : `${itemIndex + 1}.`;
                        return `   ${prefix} ${item.content}`;
                      }).join('\n') : '';
                      return `${sectionTitle}\n${items}`;
                    }).join('\n\n');
                  }
                } catch (error) {
                  // Fallback to plain text if JSON parsing fails
                  termsText = String(data.terms_conditions);
                }
              }
              
              // Fallback to organisation terms if no quotation terms
              if (!termsText) {
                termsText = organisation.terms_conditions || 'Standard terms and conditions apply.';
              }
              
              return termsText.replace(/\n/g, '<br/>');
            })()
          }} />
        </div>

        <div className="footer-fixed text-center pt-2">
          <div className="text-slate-400 font-bold uppercase text-[9px]">End of Document</div>
        </div>
      </div>
    </div>
  );
}
