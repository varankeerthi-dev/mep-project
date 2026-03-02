export const PortraitTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @page { size: A4; margin: 0; }
        body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; }
        .print-container { 
            width: 210mm; 
            min-height: 297mm; 
            padding: 15mm; 
            margin: auto; 
            background: white; 
            position: relative;
            border: 1px solid #000;
        }
        /* Double line border effect */
        .print-container::after {
            content: '';
            position: absolute;
            top: 1mm;
            left: 1mm;
            right: 1mm;
            bottom: 1mm;
            border: 0.2mm solid #000;
            pointer-events: none;
        }
        :root { --brand-color: {{print_settings.theme_color || '#3b82f6'}}; }
        .text-brand { color: var(--brand-color); }
        .bg-brand { background-color: var(--brand-color); }
        .border-brand { border-color: var(--brand-color); }
        
        /* Auto-Adjusting Table Logic */
        table { width: 100%; border-collapse: collapse; table-layout: auto; }
        th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 11px; vertical-align: top; }
        
        /* Force small columns to wrap to content, let description fill the rest */
        .col-shrink { width: 1%; white-space: nowrap; }
        .col-expand { width: auto; }
        
        @media print {
            .no-print { display: none; }
            body { background: white; }
            .print-container { border: none; box-shadow: none; margin: 0; width: 100%; }
        }
    </style>
</head>
<body class="bg-gray-100">
    <div class="print-container shadow-lg">
        <!-- HEADER SECTION -->
        <div class="flex justify-between items-start mb-8 border-b-2 border-brand pb-6">
            <div class="w-2/3">
                {{#if organisation.logo_url}}
                <img src="{{organisation.logo_url}}" alt="Logo" class="h-16 mb-4 object-contain">
                {{/if}}
                <h1 class="text-2xl font-bold text-brand uppercase mb-1">{{organisation.name}}</h1>
                <p class="text-xs text-gray-600 whitespace-pre-line">{{organisation.address}}</p>
                <p class="text-sm font-bold mt-2 uppercase">GSTIN: {{organisation.gstin}}</p>
            </div>
            <div class="w-1/3 text-right">
                <h2 class="text-3xl font-black text-gray-300 mb-4 uppercase tracking-tighter">INVOICE</h2>
                <div class="text-sm space-y-1">
                    <p><span class="font-semibold text-gray-500 uppercase text-xs">Invoice No:</span> <span class="font-bold">{{invoice_metadata.invoice_no}}</span></p>
                    <p><span class="font-semibold text-gray-500 uppercase text-xs">Invoice Date:</span> <span class="font-bold">{{invoice_metadata.invoice_date}}</span></p>
                    <p><span class="font-semibold text-gray-500 uppercase text-xs">PO No:</span> <span class="font-bold">{{invoice_metadata.po_no}}</span></p>
                </div>
            </div>
        </div>

        <!-- CONDITIONAL METADATA & REMARKS -->
        <div class="mb-8 space-y-2 text-sm border-l-4 border-brand pl-4 bg-gray-50 py-3">
            {{#if invoice_metadata.po_data}}
            <p><span class="font-bold uppercase text-xs text-gray-500">PO Data:</span> {{invoice_metadata.po_data}}</p>
            {{/if}}
            
            {{#if print_settings.show_header_field}}
            <p><span class="font-bold uppercase text-xs text-gray-500">Header Field:</span> {{invoice_metadata.header_field}}</p>
            {{/if}}
            
            {{#if print_settings.show_remarks}}
            <p><span class="font-bold uppercase text-xs text-gray-500">Remarks:</span> {{invoice_metadata.remarks}}</p>
            {{/if}}
        </div>

        <!-- LOGISTICS SECTION -->
        <div class="grid grid-cols-2 gap-8 mb-8">
            <div class="p-4 border border-gray-200 rounded-lg">
                <h3 class="font-bold text-brand uppercase text-xs mb-3 border-b pb-1">Bill To (Buyer)</h3>
                <div class="text-sm space-y-1">
                    <p class="font-bold text-lg whitespace-pre-line">{{billing_shipping.bill_to}}</p>
                    <p class="font-bold mt-2">GSTIN: <span class="uppercase">{{billing_shipping.buyer_gstin}}</span></p>
                </div>
            </div>
            <div class="p-4 border border-gray-200 rounded-lg">
                <h3 class="font-bold text-brand uppercase text-xs mb-3 border-b pb-1">Ship To (Receiver)</h3>
                <div class="text-sm space-y-1">
                    <p class="font-bold whitespace-pre-line">{{billing_shipping.ship_to}}</p>
                    <p class="font-bold mt-2">Ship to GSTIN: <span class="uppercase">{{billing_shipping.ship_to_gstin}}</span></p>
                    {{#if invoice_metadata.eway_bill}}
                    <p class="bg-gray-100 p-1 mt-2 text-xs font-mono uppercase">E-Way Bill: {{invoice_metadata.eway_bill}}</p>
                    {{/if}}
                </div>
            </div>
        </div>

        <!-- DYNAMIC TABLE -->
        <table class="mb-8">
            <thead class="bg-brand text-white">
                <tr>
                    <th class="text-center col-shrink">S.No</th>
                    {{#if print_settings.show_hsn_column}}<th class="text-center col-shrink">HSN/SAC</th>{{/if}}
                    <th class="text-left col-expand">Item Description</th>
                    <th class="text-center col-shrink">Qty</th>
                    {{#if print_settings.show_unit_column}}<th class="text-center col-shrink">Unit</th>{{/if}}
                    <th class="text-right col-shrink">Rate/Unit</th>
                    <th class="text-center col-shrink">GST%</th>
                    <th class="text-right col-shrink">Amount</th>
                </tr>
            </thead>
            <tbody>
                {{#each items}}
                <tr>
                    <td class="text-center col-shrink">{{this.s_no}}</td>
                    {{#if ../print_settings.show_hsn_column}}<td class="text-center col-shrink">{{this.hsn_sac}}</td>{{/if}}
                    <td class="col-expand font-medium">{{this.item_description}}</td>
                    <td class="text-center col-shrink">{{this.qty}}</td>
                    {{#if ../print_settings.show_unit_column}}<td class="text-center col-shrink">{{this.unit}}</td>{{/if}}
                    <td class="text-right col-shrink">₹{{this.rate_per_unit}}</td>
                    <td class="text-center col-shrink">{{this.gst_percentage}}%</td>
                    <td class="text-right col-shrink font-bold">₹{{this.amount}}</td>
                </tr>
                {{/each}}
            </tbody>
        </table>

        <!-- FINANCIALS SECTION -->
        <div class="flex justify-between items-start mb-10">
            <div class="w-1/2">
                <p class="text-xs font-bold text-gray-500 uppercase mb-2">Amount in Words:</p>
                <p class="text-sm font-medium italic underline decoration-brand/30">{{totals.amount_in_words}} Only</p>
                
                <div class="mt-8 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <h4 class="text-xs font-black uppercase text-brand mb-2">Bank Account Details</h4>
                    <div class="text-xs grid grid-cols-2 gap-y-1">
                        <span class="text-gray-500 uppercase">Bank Name:</span> <span class="font-bold">{{bank_details.name}}</span>
                        <span class="text-gray-500 uppercase">A/c No:</span> <span class="font-bold text-sm">{{bank_details.account_no}}</span>
                        <span class="text-gray-500 uppercase">Branch:</span> <span>{{bank_details.branch}}</span>
                        <span class="text-gray-500 uppercase">IFSC:</span> <span class="font-bold text-blue-700 uppercase">{{bank_details.ifsc}}</span>
                    </div>
                </div>
            </div>
            
            <div class="w-1/3">
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-gray-500">Basic Amount:</span>
                        <span class="font-medium">₹{{totals.basic_amount}}</span>
                    </div>
                    {{#if totals.cgst}}
                    <div class="flex justify-between">
                        <span class="text-gray-500 uppercase">CGST:</span>
                        <span>₹{{totals.cgst}}</span>
                    </div>
                    {{/if}}
                    {{#if totals.sgst}}
                    <div class="flex justify-between">
                        <span class="text-gray-500 uppercase">SGST:</span>
                        <span>₹{{totals.sgst}}</span>
                    </div>
                    {{/if}}
                    <div class="flex justify-between">
                        <span class="text-gray-500">Round off:</span>
                        <span>₹{{totals.round_off}}</span>
                    </div>
                    <div class="flex justify-between border-t-2 border-brand pt-2 font-bold text-lg text-brand">
                        <span>Net Value:</span>
                        <span>₹{{totals.net_value}}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- CLOSING SECTION -->
        <div class="flex justify-between items-end mt-20">
            <div class="text-xs text-gray-400">
                <p>This is a computer generated invoice.</p>
            </div>
            <div class="text-center w-64">
                <p class="text-xs font-bold uppercase mb-16 text-gray-600">{{footer.organisation_name_footer}}</p>
                <div class="border-t border-gray-400 pt-2">
                    <p class="text-sm font-bold uppercase">{{footer.signatory_label}}</p>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
`;
