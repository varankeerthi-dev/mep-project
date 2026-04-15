-- Update the HTML quotation template in the database
-- Run this in Supabase SQL Editor

UPDATE document_templates
SET
  template_content = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>QUOTATION</title>
<style>
  @page { margin: 12px; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: ''DejaVu Sans'', Arial, sans-serif; font-size: 11px; }
  body { padding: 8px; }
  .bordered { border: 1.5px solid #000; padding: 6px 8px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border: 1.5px solid #000; padding: 6px 8px; margin-bottom: 4px; }
  .org-name { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .org-details { font-size: 10px; line-height: 1.4; margin-top: 2px; }
  .quote-title { font-size: 16px; font-weight: 700; text-align: right; letter-spacing: 2px; }
  .meta-section { display: flex; gap: 0; border: 1.5px solid #000; margin-bottom: 4px; }
  .meta-left, .meta-right { flex: 1; border-right: 1px solid #000; padding: 5px 7px; font-size: 10px; }
  .meta-right { border-right: none; }
  .meta-label { font-weight: 700; display: inline-block; min-width: 100px; }
  .meta-value { display: inline-block; }
  .meta-row { display: flex; }
  .meta-row + .meta-row { margin-top: 3px; }
  .client-section { display: flex; gap: 0; border: 1.5px solid #000; margin-bottom: 4px; }
  .client-box, .address-box { flex: 1; padding: 5px 7px; font-size: 10px; border-right: 1px solid #000; }
  .address-box { border-right: none; }
  .box-label { font-weight: 700; font-size: 10px; display: block; margin-bottom: 2px; }
  .items-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin-bottom: 4px; }
  .items-table th, .items-table td { border: 1px solid #000; padding: 4px 5px; font-size: 10px; vertical-align: top; }
  .items-table th { background: #f0f0f0; font-weight: 700; text-align: center; }
  .items-table .num { text-align: center; width: 35px; }
  .items-table .hsn { text-align: center; width: 55px; }
  .items-table .item-desc { text-align: left; }
  .items-table .qty { text-align: center; width: 40px; }
  .items-table .unit { text-align: center; width: 45px; }
  .items-table .rate { text-align: right; width: 70px; }
  .items-table .gst { text-align: center; width: 40px; }
  .items-table .amount { text-align: right; width: 80px; }
  .items-table tfoot td { font-weight: 700; }
  .items-table .subtotal-row td { background: #f5f5f5; }
  .items-table .cgst-row td, .items-table .sgst-row td, .items-table .igst-row td { background: #fafafa; }
  .items-table .round-row td { background: #f0f0f0; }
  .items-table .total-row td { background: #000; color: #fff; font-size: 12px; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .words-section { border: 1.5px solid #000; padding: 5px 7px; margin-bottom: 4px; font-size: 10px; }
  .words-label { font-weight: 700; }
  .footer-section { display: flex; gap: 0; border: 1.5px solid #000; }
  .sign-box, .bank-box { flex: 1; padding: 5px 7px; font-size: 10px; border-right: 1px solid #000; }
  .bank-box { border-right: none; }
  .box-title { font-weight: 700; font-size: 10px; display: block; margin-bottom: 3px; }
  .bank-row { display: flex; gap: 4px; font-size: 10px; margin-top: 2px; }
  .bank-key { font-weight: 700; min-width: 70px; }
  .thankyou { text-align: center; font-size: 9px; color: #555; margin-top: 4px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="org-name">{{organisation_name}}</div>
    <div class="org-details">
      {{organisation_address}}<br>
      Ph: {{organisation_phone}} | Email: {{organisation_email}} | GSTIN: {{organisation_gstin}}<br>
      CIN: {{organisation_cin}} | PAN: {{organisation_pan}} | IE Code: {{organisation_ie_code}}
    </div>
  </div>
  <div class="quote-title">{{document_type}}</div>
</div>
<div class="meta-section">
  <div class="meta-left">
    <div class="meta-row"><span class="meta-label">Quote No. :</span><span class="meta-value">{{quotation_no}}</span></div>
    <div class="meta-row"><span class="meta-label">Revision No. :</span><span class="meta-value">{{revision_no}}</span></div>
    <div class="meta-row"><span class="meta-label">Quote Date :</span><span class="meta-value">{{date}}</span></div>
  </div>
  <div class="meta-right">
    <div class="meta-row"><span class="meta-label">Remarks :</span><span class="meta-value">{{remarks}}</span></div>
    <div class="meta-row"><span class="meta-label">Payment Terms :</span><span class="meta-value">{{payment_terms}}</span></div>
    <div class="meta-row"><span class="meta-label">Valid Until :</span><span class="meta-value">{{valid_till}}</span></div>
  </div>
</div>
<div class="client-section">
  <div class="client-box">
    <span class="box-label">BILL TO (Client Details)</span>
    <strong>{{client_name}}</strong><br>
    Attn: {{client_contact_person}}<br>
    {{client_address}}<br>
    {{client_city}} – {{client_pincode}}<br>
    GSTIN: {{client_gstin}} | Ph: {{client_phone}}
  </div>
  <div class="address-box">
    <span class="box-label">SHIP TO (Delivery Address)</span>
    <strong>{{shipping_company_name}}</strong><br>
    {{shipping_address}}<br>
    {{shipping_city}} – {{shipping_pincode}}<br>
    Contact: {{shipping_phone}}
  </div>
</div>
<table class="items-table">
  <thead>
    <tr>
      <th class="num">S.No</th>
      <th class="hsn">HSN</th>
      <th class="item-desc">Item Description</th>
      <th class="qty">Qty</th>
      <th class="unit">Unit</th>
      <th class="rate">Rate (₹)</th>
      <th class="gst">GST%</th>
      <th class="amount">Amount (₹)</th>
    </tr>
  </thead>
  <tbody>
    {{#items}}
    <tr>
      <td class="num">{{index}}</td>
      <td class="hsn">{{hsn}}</td>
      <td class="item-desc">{{description}}</td>
      <td class="qty text-center">{{qty}}</td>
      <td class="unit text-center">{{uom}}</td>
      <td class="rate">{{rate}}</td>
      <td class="gst text-center">{{gst_percent}}</td>
      <td class="amount">{{amount}}</td>
    </tr>
    {{/items}}
  </tbody>
  <tfoot>
    <tr class="subtotal-row">
      <td colspan="7" class="text-right"><strong>Sub Total (Basic)</strong></td>
      <td class="amount">₹ {{subtotal}}</td>
    </tr>
    <tr class="cgst-row">
      <td colspan="7" class="text-right">Add : CGST @ 9%</td>
      <td class="amount">{{cgst_amount}}</td>
    </tr>
    <tr class="sgst-row">
      <td colspan="7" class="text-right">Add : SGST @ 9%</td>
      <td class="amount">{{sgst_amount}}</td>
    </tr>
    <tr class="round-row">
      <td colspan="7" class="text-right">Round Off</td>
      <td class="amount">{{round_off}}</td>
    </tr>
    <tr class="total-row">
      <td colspan="7" class="text-right" style="color:#fff;"><strong>GRAND TOTAL (₹)</strong></td>
      <td class="amount"><strong>{{grand_total}}</strong></td>
    </tr>
  </tfoot>
</table>
<div class="words-section">
  <span class="words-label">Amount in Words :</span>
  <em>{{amount_in_words}}</em>
</div>
<div class="footer-section">
  <div class="sign-box">
    <span class="box-title">Authorised Signatory</span>
    <br><br>
    <strong>For {{organisation_name}}</strong><br><br>
    <br><br>
    _______________________________<br>
    Authorised Signatory<br>
    Designation: {{signatory_designation}}<br>
    <br>
    <em style="font-size:9px;">This is a computer generated quotation.<br>No signature required.</em>
  </div>
  <div class="bank-box">
    <span class="box-title">Bank Details</span>
    <div class="bank-row"><span class="bank-key">Bank Name :</span><span>{{bank_name}}</span></div>
    <div class="bank-row"><span class="bank-key">Branch :</span><span>{{bank_branch}}</span></div>
    <div class="bank-row"><span class="bank-key">A/c No. :</span><span>{{bank_account_no}}</span></div>
    <div class="bank-row"><span class="bank-key">A/c Type :</span><span>{{bank_account_type}}</span></div>
    <div class="bank-row"><span class="bank-key">IFSC Code :</span><span>{{bank_ifsc}}</span></div>
    <div class="bank-row"><span class="bank-key">MICR Code :</span><span>{{bank_micr}}</span></div>
    <div class="bank-row" style="margin-top:5px;"><span class="bank-key">SWIFT :</span><span>{{bank_swift}}</span></div>
    <div class="bank-row"><span class="bank-key">UPI/QR :</span><span>{{bank_upi}}</span></div>
    <br>
    <span class="box-title" style="margin-top:4px;">Terms &amp; Conditions</span>
    <span style="font-size:9px; line-height:1.4;">
      {{terms_conditions}}
    </span>
  </div>
</div>
<div class="thankyou">Thank you for your business! | {{organisation_name}} | {{organisation_email}} | Ph: {{organisation_phone}}</div>
</body>
</html>',
  template_type = 'html',
  updated_at = NOW()
WHERE template_code = 'HTML_QUOTATION';
