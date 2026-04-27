import React from "react";
import { formatCurrency, formatDate } from "../utils/formatters";
import { 
  Calendar, 
  User, 
  Truck, 
  FileText, 
  ClipboardList, 
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin
} from "lucide-react";

/* ---------------- HELPERS ---------------- */

const getDocumentNumber = (data: any) => {
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
    { key: "variant", label: labels.variant || "Variant", width: "10%" },
    { key: "description", label: labels.description || "Description", width: "20%" },
    { key: "make", label: labels.make || "Make", width: "10%" },
    { key: "qty", label: labels.qty || "Qty", width: "7%" },
    { key: "uom", label: labels.uom || "Unit", width: "7%" },
    { key: "rate", label: labels.rate || "Rate", width: "12%", align: "right" },
    { key: "discount_percent", label: labels.discount_percent || "Disc %", width: "7%", align: "right" },
    { key: "tax_percent", label: labels.tax_percent || "Tax %", width: "7%", align: "right" },
    { key: "tax_amount", label: labels.tax_amount || "Tax Amt", width: "10%", align: "right" },
    { key: "line_total", label: labels.line_total || "Total", width: "12%", align: "right" }
  ];

  return allPossible.filter(c => optional[c.key] !== false);
};

const getCellValue = (item: any, key: string, index: number) => {
  switch (key) {
    case "sno": return index + 1;
    case "hsn_code": return item.item?.hsn_code || "-";
    case "item": return item.item?.name || "-";
    case "variant": return item.variant || "-";
    case "description": return item.description || "-";
    case "make": return item.make || item.item?.make || "-";
    case "qty": return item.qty;
    case "uom": return item.uom || item.item?.uom || "Nos";
    case "rate": return item.rate;
    case "discount_percent": return item.discount_percent ? `${item.discount_percent}%` : "0%";
    case "tax_percent": return item.tax_percent ? `${item.tax_percent}%` : "0%";
    case "tax_amount": return item.tax_amount || 0;
    case "line_total": return item.line_total;
    default: return item[key] ?? "";
  }
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

  // Group items by a "group" field if it exists, or just handle headers
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

  // Prepare info bar fields dynamically
  const infoFields = [
    { label: "PO No.", value: data.po_no, key: 'po_no' },
    { label: "PO Date", value: formatDate(data.po_date), key: 'po_date' },
    { label: "Valid Till", value: formatDate(data.valid_till), key: 'valid_till' },
    { label: "Payment Terms", value: data.payment_terms, key: 'payment_terms' },
    { label: "Reference", value: data.reference, key: 'reference' },
    { label: "E-Way Bill", value: data.eway_bill, key: 'eway_bill' }
  ].filter(f => optional[f.key] !== false && (f.key !== 'po_no' && f.key !== 'po_date' && f.key !== 'eway_bill' || f.value));

  return (
    <div className="w-[210mm] min-h-[297mm] bg-white text-[11px] text-slate-800 flex flex-col font-sans">
      {/* ---------------- HEADER ---------------- */}
      <div className="p-8 pb-4 flex justify-between items-start border-b-2 border-blue-50">
        <div className="flex gap-4">
          <div className="w-16 h-16 bg-blue-900 rounded-xl flex items-center justify-center text-white shrink-0 overflow-hidden border-2 border-blue-100">
            {organisation.logo_url ? (
              <img 
                src={organisation.logo_url} 
                alt="Logo" 
                className="w-full h-full object-contain bg-white p-1" 
                crossOrigin="anonymous"
              />
            ) : (
              <span className="text-4xl font-bold italic select-none">
                {organisation.name?.[0] || 'S'}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">
              {organisation.name}
            </h1>
            <p className="text-slate-500 font-medium text-[10px] uppercase tracking-wider mb-2">
              {organisation.subtitle || "Manufacturer of Precision Components"}
            </p>
            <div className="grid grid-cols-1 gap-1 text-slate-600 text-[9px]">
              <div className="flex items-center gap-1">
                <MapPin size={10} className="text-blue-600" />
                <span>{organisation.address}</span>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1">
                  <Phone size={10} className="text-blue-600" />
                  <span>{organisation.phone}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Mail size={10} className="text-blue-600" />
                  <span>{organisation.email}</span>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1">
                  <Globe size={10} className="text-blue-600" />
                  <span>{organisation.website}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-blue-600 font-bold">GSTIN:</span>
                  <span>{organisation.gstin}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-right">
          <h2 className="text-4xl font-black text-blue-800 tracking-tighter opacity-90">
            {docType.toUpperCase()}
          </h2>
          <div className="mt-4 inline-flex flex-col items-end">
            <div className="flex gap-6 text-[10px]">
              <div className="flex flex-col items-end">
                <span className="text-slate-400 font-semibold uppercase">Quotation No.</span>
                <span className="text-blue-700 font-bold text-sm">{docNo}</span>
              </div>
              <div className="flex flex-col items-end border-l pl-6 border-slate-200">
                <span className="text-slate-400 font-semibold uppercase">Date</span>
                <div className="flex items-center gap-1 text-slate-800 font-bold text-sm">
                  <Calendar size={12} className="text-blue-600" />
                  <span>{formatDate(data.date)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- INFO BAR ---------------- */}
      {infoFields.length > 0 && (
        <div className="mx-8 mt-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-3 divide-x divide-slate-200 overflow-hidden">
          {/* First column: 2 fields */}
          <div className="p-2 grid grid-cols-2 gap-y-1">
            {infoFields.slice(0, 2).map((f, i) => (
              <React.Fragment key={i}>
                <div className="text-slate-500 font-medium">{f.label}</div>
                <div className="font-semibold">: {f.value || "-"}</div>
              </React.Fragment>
            ))}
          </div>
          {/* Second column: 2 fields */}
          <div className="p-2 grid grid-cols-2 gap-y-1">
            {infoFields.slice(2, 4).map((f, i) => (
              <React.Fragment key={i}>
                <div className="text-slate-500 font-medium">{f.label}</div>
                <div className="font-semibold">: {f.value || "-"}</div>
              </React.Fragment>
            ))}
          </div>
          {/* Third column: Remaining fields */}
          <div className="p-2 grid grid-cols-2 gap-y-1">
            {infoFields.slice(4).map((f, i) => (
              <React.Fragment key={i}>
                <div className="text-slate-500 font-medium">{f.label}</div>
                <div className="font-semibold">: {f.value || "-"}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- BILLING ---------------- */}
      <div className="mx-8 mt-4 grid grid-cols-2 gap-6">
        <div className="bg-white border-l-4 border-blue-600 shadow-sm p-4 rounded-r-lg ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-blue-700 font-bold mb-2 uppercase tracking-wide">
            <User size={14} />
            <span>Bill To</span>
          </div>
          <div className="font-bold text-sm text-slate-900">{data.client?.client_name || "ABC Industries Pvt. Ltd."}</div>
          <div className="text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
            {data.billing_address || "Address not provided"}
          </div>
          <div className="mt-2 text-[10px]">
            <span className="text-blue-700 font-bold uppercase">GSTIN: </span>
            <span className="font-semibold text-slate-800">{data.gstin || data.client?.gstin || "-"}</span>
          </div>
        </div>

        <div className="bg-white border-l-4 border-blue-400 shadow-sm p-4 rounded-r-lg ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-blue-600 font-bold mb-2 uppercase tracking-wide">
            <Truck size={14} />
            <span>Ship To</span>
          </div>
          <div className="font-bold text-sm text-slate-900">{data.shipping_name || data.client?.client_name || "ABC Industries Pvt. Ltd."}</div>
          <div className="text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
            {data.shipping_address || data.billing_address || "Address not provided"}
          </div>
          <div className="mt-2 text-[10px]">
            <span className="text-blue-600 font-bold uppercase">GSTIN: </span>
            <span className="font-semibold text-slate-800">{data.gstin || data.client?.gstin || "-"}</span>
          </div>
        </div>
      </div>

      {/* ---------------- TABLE ---------------- */}
      <div className="mx-8 mt-6 flex-1">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-blue-900 text-white text-[10px] font-bold uppercase tracking-wider">
              {columns.map((col: any) => (
                <th 
                  key={col.key} 
                  className={`p-3 text-left border-r border-blue-800 last:border-r-0`}
                  style={{ width: col.width, textAlign: col.align || 'left' }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedItems.map((item, idx) => {
              if (item.type === 'header') {
                return (
                  <tr key={`h-${idx}`} className="bg-blue-50/50">
                    <td className="p-2 border font-bold text-blue-800" colSpan={1}>{item.group_no}</td>
                    <td className="p-2 border font-bold text-blue-800" colSpan={columns.length - 1}>
                      {item.description}
                    </td>
                  </tr>
                );
              }

              return (
                <tr 
                  key={`i-${idx}`} 
                  className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} border-b border-slate-100 hover:bg-blue-50/30 transition-colors`}
                >
                  {columns.map((col: any) => {
                    let val = col.key === 'sno' ? item.sno_display : getCellValue(item, col.key, idx);
                    const isCurrency = col.key === 'rate' || col.key === 'amount';
                    
                    return (
                      <td 
                        key={col.key} 
                        className={`p-2.5 border-x border-slate-100 first:border-l-0 last:border-r-0 ${isCurrency ? 'font-mono' : ''}`}
                        style={{ textAlign: col.align || 'left' }}
                      >
                        {isCurrency ? formatCurrency(val) : val}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ---------------- FOOTER ---------------- */}
      <div className="p-8 pt-4 grid grid-cols-12 gap-8 border-t-2 border-blue-50">
        {/* Left Side: Words, Terms, Bank */}
        <div className="col-span-7 flex flex-col gap-4">
          <div className="bg-slate-50 rounded-lg p-3 ring-1 ring-slate-100">
            <div className="flex items-center gap-2 text-blue-800 font-bold mb-1 uppercase tracking-tight">
              <FileText size={12} />
              <span>Total Amount In Words</span>
            </div>
            <div className="font-bold text-slate-900 italic">
              Indian Rupee {data.amount_words || "Fifty Eight Thousand Four Hundred Fifty Only"}
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 ring-1 ring-slate-100">
            <div className="flex items-center gap-2 text-blue-800 font-bold mb-2 uppercase tracking-tight">
              <ClipboardList size={12} />
              <span>Terms & Conditions</span>
            </div>
            <ul className="text-[9px] text-slate-600 space-y-1 list-disc list-inside">
              {data.terms_conditions?.split('\n').map((line: string, i: number) => (
                <li key={i}>{line}</li>
              )) || (
                <>
                  <li>Payment - Purchase Order & 100% Advance</li>
                  <li>Delivery - 3-4 days from the date of confirmation</li>
                  <li>Freight - Client Scope</li>
                  <li>GST Extra as applicable</li>
                  <li>Subject to Pune Jurisdiction</li>
                </>
              )}
            </ul>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 ring-1 ring-slate-100">
            <div className="flex items-center gap-2 text-blue-800 font-bold mb-2 uppercase tracking-tight">
              <Building2 size={12} />
              <span>Bank Details</span>
            </div>
            <div className="grid grid-cols-2 text-[10px] gap-x-4 gap-y-1">
              <div className="flex justify-between text-slate-500">Bank Name <span>:</span></div>
              <div className="font-semibold">{organisation.bank_name || "HDFC Bank Ltd."}</div>
              <div className="flex justify-between text-slate-500">Account No. <span>:</span></div>
              <div className="font-semibold">{organisation.bank_account_no || "50200012345678"}</div>
              <div className="flex justify-between text-slate-500">IFSC Code <span>:</span></div>
              <div className="font-semibold font-mono">{organisation.bank_ifsc || "HDFC0001234"}</div>
              <div className="flex justify-between text-slate-500">Branch <span>:</span></div>
              <div className="font-semibold">{organisation.bank_branch || "Chakan, Pune"}</div>
            </div>
          </div>
        </div>

        {/* Right Side: Totals & Signature */}
        <div className="col-span-5 flex flex-col justify-between">
          <div className="space-y-1.5 px-2">
            <div className="flex justify-between text-slate-600 font-medium">
              <span>Sub Total</span>
              <span className="font-mono">{formatCurrency(data.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600 font-medium">
              <span>SGST @ 9%</span>
              <span className="font-mono">{formatCurrency(data.sgst_amount || (data.total_tax / 2))}</span>
            </div>
            <div className="flex justify-between text-slate-600 font-medium">
              <span>CGST @ 9%</span>
              <span className="font-mono">{formatCurrency(data.cgst_amount || (data.total_tax / 2))}</span>
            </div>
            <div className="flex justify-between text-slate-600 font-medium">
              <span>Rounding Off</span>
              <span className="font-mono">{formatCurrency(data.round_off)}</span>
            </div>
            <div className="mt-4 pt-4 border-t-2 border-blue-900 flex justify-between items-center bg-blue-50 -mx-2 px-4 py-2 rounded-lg">
              <span className="text-blue-900 font-black text-sm uppercase">Total Amount</span>
              <span className="text-blue-900 font-black text-lg font-mono">
                {formatCurrency(data.grand_total || data.total)}
              </span>
            </div>
          </div>

          <div className="mt-12 text-center relative">
            <div className="text-slate-800 font-bold text-[10px] mb-8">
              For {organisation.name || "Shivam Engineering Pvt. Ltd."}
            </div>
            
            {/* Signature Placeholder */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 opacity-80">
               {/* This would be the signature image if available */}
               <div className="w-24 h-12 border-b border-dotted border-blue-200"></div>
            </div>

            <div className="mt-10 border-t border-slate-300 pt-1 inline-block px-8 text-slate-500 font-bold uppercase tracking-widest text-[9px]">
              Authorized Signature
            </div>
          </div>
        </div>
      </div>

      {/* Page Numbering */}
      <div className="mt-auto p-4 text-center text-slate-400 text-[9px] font-medium border-t border-slate-50">
        Page 1 of 1
      </div>
    </div>
  );
}
