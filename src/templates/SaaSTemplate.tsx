import React from "react";

/* ---------------- CONFIG ---------------- */

const DOCUMENT_LABELS: any = {
  QUOTATION: "QUOTATION",
  INVOICE: "TAX INVOICE",
  PROFORMA: "PROFORMA INVOICE",
  DELIVERY_CHALLAN: "DELIVERY CHALLAN"
};

/* ---------------- HELPERS ---------------- */

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2
  }).format(val || 0);

const getActiveColumns = (config: any) => {
  // New structure support
  if (config?.columns && Array.isArray(config.columns) && config.columns.length > 0) {
    return config.columns
      .filter((c: any) => c.enabled)
      .sort((a: any, b: any) => a.order - b.order);
  }

  // Legacy structure support (optional/labels)
  const optional = config?.optional || {};
  const labels = config?.labels || {};
  
  const allPossible = [
    { key: "sno", label: labels.sno || "S.No", order: 1, width: 1, align: "left" },
    { key: "item", label: labels.item || "Item Description", order: 2, width: 6, align: "left" },
    { key: "client_part_no", label: labels.client_part_no || "Client Part No", order: 2.1, width: 2, align: "left" },
    { key: "client_description", label: labels.client_description || "Client Description", order: 2.2, width: 4, align: "left" },
    { key: "qty", label: labels.qty || "Qty", order: 3, width: 1, align: "right" },
    { key: "rate", label: labels.rate || "Rate", order: 4, width: 2, align: "right", type: "currency" },
    { key: "amount", label: labels.amount || "Amount", order: 5, width: 2, align: "right", type: "currency" }
  ];
  
  return allPossible.filter(c => optional[c.key] !== false);
};

const getCellValue = (item: any, key: string, index: number, quotation: any) => {
  const clientId = quotation?.client_id || quotation?.client?.id;
  const mapping = clientId && item.item?.mappings?.find((m: any) => m.client_id === clientId);

  switch (key) {
    case "sno": return index + 1;
    case "hsn": return item.sac_code || item.item?.hsn_code || "-";
    case "item": return mapping?.client_description || item.description || item.item?.name || "-";
    case 'description':
        return mapping?.client_description || item.description || '-';
    case "item_code": return mapping?.client_part_no || item.item?.item_code || "-";
    case "client_part_no": return mapping?.client_part_no || "-";
    case "client_description": return mapping?.client_description || "-";
    case "qty": return item.qty;
    case "rate": return item.rate;
    case "amount": return item.line_total;
    default: return item[key] ?? "";
  }
};

const getGridTemplate = (cols: any[]) => {
  const total = cols.reduce((sum, c) => sum + (c.width || 1), 0);
  return cols.map(c => `${((c.width || 1) / total) * 100}%`).join(" ");
};

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

/* ---------------- MAIN ---------------- */

export default function DocumentPreview({
  data,
  organisation,
  templateConfig
}: any) {
  const columns = getActiveColumns(templateConfig);

  if (columns.length === 0) {
    return <div>No columns configured</div>;
  }

  const gridTemplate = getGridTemplate(columns);
  const title = DOCUMENT_LABELS[data.document_type] || "DOCUMENT";

  return (
    <div className="min-h-[297mm] flex flex-col bg-white text-[11px] text-gray-800 p-6">
      <style>{`
        .bg-blue-700 { background-color: #1d4ed8 !important; }
        .bg-gray-100 { background-color: #f3f4f6 !important; }
        .bg-gray-50 { background-color: #f9fafb !important; }
        .text-blue-700 { color: #1d4ed8 !important; }
        .text-gray-500 { color: #6b7280 !important; }
        .text-gray-600 { color: #4b5563 !important; }
        .text-gray-800 { color: #1f2937 !important; }
      `}</style>

      {/* ---------------- HEADER ---------------- */}
      <div className="flex justify-between items-start border-b pb-3">
        <div>
          <div className="text-lg font-bold">{organisation.name}</div>
          <div className="text-[10px] text-gray-500">
            {organisation.address}
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-blue-700">{title}</div>
          <div className="text-xs font-semibold">
            {getDocumentNumber(data)}
          </div>
          <div className="text-xs text-gray-500">
            {data.date}
          </div>
        </div>
      </div>

      {/* ---------------- INFO ---------------- */}
      <div className="grid grid-cols-3 gap-4 py-2 border-b text-[10px] text-gray-600">
        <div>PO No: {data.po_no || "-"}</div>
        <div>Valid Till: {data.valid_till || "-"}</div>
        <div>Payment: {data.payment_terms || "-"}</div>
      </div>

      {/* ---------------- BILL / SHIP ---------------- */}
      <div className="grid grid-cols-2 gap-4 mt-2">
        <div className="border p-2">
          <div className="text-blue-700 font-semibold text-[10px]">BILL TO</div>
          <div className="font-medium">{data.client?.client_name}</div>
          <div className="text-[10px] text-gray-500">
            {data.billing_address}
          </div>
        </div>

        <div className="border p-2">
          <div className="text-blue-700 font-semibold text-[10px]">SHIP TO</div>
          <div className="font-medium">{data.client?.client_name}</div>
          <div className="text-[10px] text-gray-500">
            {data.shipping_address || data.billing_address}
          </div>
        </div>
      </div>

      {/* ---------------- TABLE ---------------- */}
      <div className="mt-3 flex-1 border">

        {/* HEADER */}
        <div
          className="grid bg-blue-700 text-white text-[10px] font-semibold"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {columns.map((col: any) => (
            <div
              key={col.key}
              className={`p-2 ${col.align === "right"
                  ? "text-right"
                  : col.align === "center"
                    ? "text-center"
                    : ""
                }`}
            >
              {col.label}
            </div>
          ))}
        </div>

        {/* BODY */}
        {data.items?.map((item: any, i: number) => {
          if (item.is_header) {
            return (
              <div
                key={i}
                className="bg-gray-100 font-semibold px-2 py-1 text-[10px]"
              >
                {item.description}
              </div>
            );
          }

          return (
            <div
              key={i}
              className={`grid border-t ${i % 2 === 0 ? "bg-white" : "bg-gray-50"
                }`}
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {columns.map((col: any) => {
                let value = getCellValue(item, col.key, i, data);

                if (col.type === "currency") {
                  value = formatCurrency(value);
                }

                return (
                  <div
                    key={col.key}
                    className={`p-2 ${col.align === "right"
                        ? "text-right font-mono"
                        : col.align === "center"
                          ? "text-center"
                          : ""
                      }`}
                  >
                    {value}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ---------------- FOOTER ---------------- */}
      <div className="mt-auto grid grid-cols-2 gap-4 pt-3">

        {/* LEFT */}
        <div>
          <div className="border p-2 mb-2">
            <div className="text-blue-700 font-semibold text-[10px]">
              Total Amount In Words
            </div>
            <div>{data.amount_words}</div>
          </div>

          <div className="border p-2">
            <div className="text-blue-700 font-semibold text-[10px]">
              Terms & Conditions
            </div>
            <div className="text-[10px] whitespace-pre-line">
              {(() => {
                if (!data.terms_conditions) return '';
                
                try {
                  const termsData = typeof data.terms_conditions === 'string' 
                    ? JSON.parse(data.terms_conditions) 
                    : data.terms_conditions;
                  
                  if (termsData && termsData.sections) {
                    return termsData.sections.map((section: any, sectionIndex: number) => {
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
                  return String(data.terms_conditions);
                }
                
                return String(data.terms_conditions);
              })()}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="border p-2 text-right">
          <div className="flex justify-between">
            <span>Sub Total</span>
            <span>{formatCurrency(data.subtotal)}</span>
          </div>

          <div className="flex justify-between">
            <span>Tax</span>
            <span>{formatCurrency(data.total_tax || data.cgst_amount + data.sgst_amount)}</span>
          </div>

          <div className="flex justify-between font-bold text-lg text-blue-700 mt-2">
            <span>Total</span>
            <span>{formatCurrency(data.grand_total || data.total)}</span>
          </div>

          <div className="mt-6 text-center">
            <div>For {organisation?.name || '-'}</div>
            <div className="mt-8 border-t pt-1 text-xs w-40 mx-auto">
              Authorized Signature
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}