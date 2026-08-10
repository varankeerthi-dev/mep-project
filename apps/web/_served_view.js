import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/pages/QuotationView.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=2fa961a5"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
var _s = $RefreshSig$();
import __vite__cjsImport1_react from "/node_modules/.vite/deps/react.js?v=2fa961a5"; const useState = __vite__cjsImport1_react["useState"]; const useEffect = __vite__cjsImport1_react["useEffect"]; const useRef = __vite__cjsImport1_react["useRef"];
import DOMPurify from "/node_modules/.vite/deps/dompurify.js?v=2fa961a5";
import { useQuery } from "/node_modules/.vite/deps/@tanstack_react-query.js?v=2fa961a5";
import { supabase } from "/src/supabase.ts";
import { useNavigate, useSearchParams } from "/node_modules/.vite/deps/react-router-dom.js?v=2fa961a5";
import { jsPDF } from "/node_modules/.vite/deps/jspdf.js?v=2fa961a5";
import autoTable from "/node_modules/.vite/deps/jspdf-autotable.js?v=2fa961a5";
import { formatDate, formatCurrency } from "/src/utils/formatters.js";
import { useAuth } from "/src/App.tsx?t=1785695718354";
import { generateQuotationPdf } from "/src/pdf/enterpriseQuotationPdf.ts";
import { renderTemplateToPdf } from "/src/utils/htmlTemplateRenderer.ts";
import { generateClassicQuotationTemplate } from "/src/pages/ClassicQuotationTemplate.tsx";
import { generateProGridQuotationPdf } from "/src/pdf/proGridQuotationPdf.ts";
import { generateSakthiPdf } from "/src/pdf/sakthiTemplatePdf.ts";
import { generateZohoTemplate } from "/src/pages/ZohoTemplate.tsx";
import { timedSupabaseQuery } from "/src/utils/queryTimeout.ts";
import SaaSTemplate from "/src/templates/SaaSTemplate.tsx";
import VerticalTemplate from "/src/templates/VerticalTemplate.tsx";
import { htmlToPdf } from "/src/utils/htmlTemplateRenderer.ts";
import __vite__cjsImport20_reactDom_client from "/node_modules/.vite/deps/react-dom_client.js?v=2fa961a5"; const createRoot = __vite__cjsImport20_reactDom_client["createRoot"];
import __vite__cjsImport21_reactDom from "/node_modules/.vite/deps/react-dom.js?v=2fa961a5"; const flushSync = __vite__cjsImport21_reactDom["flushSync"];
import { Printer, Edit, Copy, MoreHorizontal, Trash2, XCircle, CheckCircle, ChevronDown, ChevronRight, ChevronLeft, Download, Eye, FileText, Plus, Loader2, Share2 } from "/node_modules/.vite/deps/lucide-react.js?v=2fa961a5";
import { useVariants } from "/src/hooks/useVariants.ts";
import { ApprovalAPI } from "/src/approvals/api.ts";
import { initiateQuotationRevision } from "/src/lib/quotation-workflow.ts";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "/src/components/ui/resizable.tsx";
export default function QuotationView() {
  _s();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quotationId = searchParams.get("id");
  const { organisation, user } = useAuth();
  const isEmbed = searchParams.get("embed") === "true";
  const [embedPdfUrl, setEmbedPdfUrl] = useState(null);
  const [embedLoading, setEmbedLoading] = useState(false);
  const [embedError, setEmbedError] = useState(null);
  const [showConvertMenu, setShowConvertMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showStockCheckModal, setShowStockCheckModal] = useState(false);
  const [launchingStockCheck, setLaunchingStockCheck] = useState(false);
  const [launchingRevision, setLaunchingRevision] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [printMenuView, setPrintMenuView] = useState("main");
  const [printLoading, setPrintLoading] = useState(false);
  const printMenuRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (printMenuRef.current && !printMenuRef.current.contains(event.target)) {
        setShowPrintMenu(false);
        setShowConvertMenu(false);
      }
    };
    if (showPrintMenu || showConvertMenu || showActionsMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPrintMenu, showConvertMenu]);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewHTML, setPreviewHTML] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const quotationQuery = useQuery({
    queryKey: ["quotation", quotationId, organisation?.id],
    queryFn: async () => {
      if (!quotationId) return null;
      const query = supabase.from("quotation_header").select(`
          *,
          client:clients(*),
          project:projects(id, project_name, project_code),
          items:quotation_items(*, item:materials(id, item_code, display_name, name, hsn_code))
        `).eq("id", quotationId).eq("organisation_id", organisation?.id || "00000000-0000-0000-0000-000000000000").single();
      const data = await timedSupabaseQuery(query, "Quotation view");
      return data;
    },
    enabled: !!quotationId && !!organisation?.id
  });
  const templatesQuery = useQuery({
    queryKey: ["documentTemplates", "Quotation"],
    queryFn: async () => {
      const data = await timedSupabaseQuery(
        supabase.from("document_templates").select("*").eq("document_type", "Quotation").eq("active", true).order("is_default", { ascending: false }),
        "Quotation templates"
      );
      return data || [];
    },
    staleTime: 10 * 60 * 1e3
  });
  const quotation = quotationQuery.data;
  const templates = templatesQuery.data || [];
  const loading = quotationQuery.isPending;
  const termsConditionsQuery = useQuery({
    queryKey: ["quotation-terms", quotationId],
    queryFn: async () => {
      if (!quotationId) return null;
      const data = await timedSupabaseQuery(
        supabase.from("quotation_terms_conditions").select("*").eq("quotation_id", quotationId).maybeSingle(),
        "Quotation terms conditions"
      );
      return data;
    },
    enabled: !!quotationId
  });
  const quotationsQuery = useQuery({
    queryKey: ["quotations", organisation?.id],
    queryFn: async () => {
      const data = await timedSupabaseQuery(
        supabase.from("quotation_header").select(`*, client:clients(id, client_name, gstin, state), project:projects(id, project_name)`).eq("organisation_id", organisation?.id).order("created_at", { ascending: false }),
        "Quotation list sidebar"
      );
      return data || [];
    },
    enabled: !!organisation?.id
  });
  const quotations = quotationsQuery.data || [];
  const { data: allVariants = [] } = useVariants();
  useEffect(() => {
    if (quotation?.template_id) {
      setSelectedTemplateId(quotation.template_id);
    }
  }, [quotation?.template_id]);
  useEffect(() => {
    if (templatesQuery.isError) {
      console.error("Error loading templates:", templatesQuery.error);
    }
  }, [templatesQuery.isError, templatesQuery.error]);
  const generateEmbedPdf = async () => {
    try {
      setEmbedLoading(true);
      setEmbedError(null);
      const templates2 = templatesQuery.data || [];
      let template = templates2.find((t) => t.is_default);
      if (!template) {
        const { data } = await supabase.from("document_templates").select("*").eq("document_type", "Quotation").eq("is_default", true).maybeSingle();
        if (data) {
          template = data;
        }
      }
      if (!template && quotation?.template_id) {
        template = templates2.find((t) => t.id === quotation.template_id);
      }
      if (!template) {
        template = templates2[0];
      }
      if (!template) {
        const { data } = await supabase.from("document_templates").select("*").eq("document_type", "Quotation").limit(1).maybeSingle();
        template = data;
      }
      if (!template) {
        throw new Error("No template found. Please set up a template.");
      }
      console.log("📄 Embed mode generating PDF with template:", template.template_name);
      const blob = await downloadPDF(template, "blob");
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        setEmbedPdfUrl(url);
      } else {
        throw new Error("PDF generation did not return a valid Blob.");
      }
    } catch (err) {
      console.error("Error generating embed PDF:", err);
      setEmbedError(err?.message || "Failed to generate quotation PDF");
    } finally {
      setEmbedLoading(false);
    }
  };
  useEffect(() => {
    if (isEmbed && quotation && organisation && templatesQuery.data && !termsConditionsQuery.isPending && !embedPdfUrl && !embedLoading && !embedError) {
      generateEmbedPdf();
    }
  }, [isEmbed, quotation, organisation, templatesQuery.data, termsConditionsQuery.isPending]);
  useEffect(() => {
    return () => {
      if (embedPdfUrl) {
        URL.revokeObjectURL(embedPdfUrl);
      }
    };
  }, [embedPdfUrl]);
  const handleEdit = () => {
    navigate(`/quotation/edit?id=${quotationId}`);
  };
  const handleDuplicate = async () => {
    if (!quotation) return;
    try {
      const { data: existing } = await supabase.from("quotation_header").select("quotation_no").order("created_at", { ascending: false }).limit(1);
      let quotationNo = "QT-0001";
      if (existing && existing.length > 0) {
        const lastNum = parseInt(existing[0].quotation_no.replace(/[^0-9]/g, ""));
        quotationNo = `QT-${String(lastNum + 1).padStart(4, "0")}`;
      }
      const newQuotation = {
        quotation_no: quotationNo,
        client_id: quotation.client_id,
        project_id: quotation.project_id,
        billing_address: quotation.billing_address,
        gstin: quotation.gstin,
        state: quotation.state,
        date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        valid_till: quotation.valid_till,
        payment_terms: quotation.payment_terms,
        contact_no: quotation.contact_no || null,
        remarks: quotation.remarks || quotation.reference || null,
        reference: quotation.reference,
        subtotal: quotation.subtotal,
        total_item_discount: quotation.total_item_discount,
        extra_discount_percent: quotation.extra_discount_percent,
        extra_discount_amount: quotation.extra_discount_amount,
        total_tax: quotation.total_tax,
        round_off: quotation.round_off,
        grand_total: quotation.grand_total,
        status: "Draft",
        negotiation_mode: false,
        revised_from_id: quotationId
      };
      const { data, error } = await supabase.from("quotation_header").insert(newQuotation).select().single();
      if (error) throw error;
      if (quotation.items && quotation.items.length > 0) {
        const itemsToInsert = quotation.items.map((item) => ({
          quotation_id: data.id,
          item_id: item.item_id,
          variant_id: item.variant_id,
          description: item.description,
          qty: item.qty,
          uom: item.uom,
          rate: item.rate,
          original_discount_percent: item.original_discount_percent,
          discount_percent: item.discount_percent,
          discount_amount: item.discount_amount,
          tax_percent: item.tax_percent,
          tax_amount: item.tax_amount,
          line_total: item.line_total,
          override_flag: false
        }));
        await supabase.from("quotation_items").insert(itemsToInsert);
      }
      alert("Quotation duplicated!");
      navigate(`/quotation/edit?id=${data.id}`);
    } catch (err) {
      console.error("Error duplicating quotation:", err);
      alert("Error: " + err.message);
    }
  };
  const handleConvert = (type) => {
    if (!quotation) return;
    if (type === "proforma-invoice") {
      navigate(`/proforma-invoices/create?convertFrom=quotation-to-proforma&sourceId=${quotationId}`);
    } else if (type === "invoice") {
      navigate(`/invoices/create?convertFrom=quotation-to-invoice&sourceId=${quotationId}`);
    } else if (type === "delivery-challan") {
      navigate(`/dc/create?convertFrom=quotation-to-dc&sourceId=${quotationId}`);
    } else if (type === "sales-order") {
      alert("Sales Order conversion not implemented yet.");
    }
    setShowConvertMenu(false);
  };
  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this quotation?")) return;
    try {
      await supabase.from("quotation_header").update({ status: "Cancelled" }).eq("id", quotationId);
      quotationQuery.refetch();
    } catch (err) {
      console.error("Error cancelling quotation:", err);
      alert("Error: " + err.message);
    }
  };
  const handleDelete = async () => {
    if (!quotation) return;
    if (quotation.status !== "Draft") {
      alert("Only Draft quotations can be deleted.");
      return;
    }
  };
  const handleApprovalAction = async (action) => {
    if (!quotationId || !quotation) return;
    try {
      const res = await ApprovalAPI.processApproval(
        quotation.approval_id || quotationId,
        { action, comments: `${action === "APPROVED" ? "Approved via quotation view" : "Rejected via quotation view"}` }
      );
      if (res.success) {
        alert(`Quotation ${action.toLowerCase()} successfully!`);
        quotationQuery.refetch();
      } else {
        alert(res.error?.message || `Failed to ${action.toLowerCase()} quotation`);
      }
    } catch (error) {
      console.error("Error processing approval:", error);
      alert("Error processing approval. Please try again.");
    }
  };
  const handleDeleteQuotation = async () => {
    if (!confirm("Are you sure you want to delete this quotation? This cannot be undone.")) return;
    try {
      await supabase.from("approvals").delete().eq("reference_id", quotationId);
      await supabase.from("quotation_header").delete().eq("id", quotationId);
      navigate("/quotation");
    } catch (err) {
      console.error("Error deleting quotation:", err);
      alert("Error: " + err.message);
    }
  };
  const handleSelectTemplate = async (templateId) => {
    try {
      await supabase.from("quotation_header").update({ template_id: templateId }).eq("id", quotationId);
      setSelectedTemplateId(templateId);
      setShowTemplateMenu(false);
      quotationQuery.refetch();
    } catch (err) {
      console.error("Error selecting template:", err);
      alert("Error: " + err.message);
    }
  };
  const handleLaunchStockCheck = async () => {
    setLaunchingStockCheck(true);
    try {
      const client = quotation.client;
      const project = quotation.project;
      const { data: listData, error: listError } = await supabase.from("procurement_lists").insert({
        organisation_id: organisation?.id,
        title: `${quotation.quotation_no || "Quotation"} — Stock Check`,
        source: "quotation",
        quotation_id: quotation.id || null,
        quotation_no: quotation.quotation_no || null,
        client_id: quotation.client_id || client?.id || null,
        client_name: client?.client_name || client?.name || null,
        project_id: quotation.project_id || project?.id || null,
        project_name: project?.project_name || null,
        status: "Active"
      }).select().single();
      if (listError) throw listError;
      const rows = (quotation.items || []).filter((item) => !item.is_header && (item.description || item.item_id || item.qty)).map((item, index) => {
        const material = item.item || {};
        const clientId = quotation.client_id || client?.id;
        const mapping = clientId && material?.mappings?.find((m) => m.client_id === clientId);
        return {
          list_id: listData.id,
          organisation_id: organisation?.id,
          item_id: material.id || item.item_id || null,
          item_name: mapping?.client_description || item.description || material.display_name || material.name || "",
          make: item.make || material.make || null,
          variant_name: item.variant?.variant_name || null,
          uom: item.uom || material.unit || null,
          boq_qty: parseFloat(String(item.qty)) || 0,
          stock_qty: 0,
          local_qty: 0,
          vendor_id: null,
          notes: null,
          status: "Pending",
          display_order: index,
          is_header_row: false
        };
      });
      if (rows.length > 0) {
        const { error } = await supabase.from("procurement_items").insert(rows);
        if (error) throw error;
      }
      setShowStockCheckModal(false);
      setShowActionsMenu(false);
      navigate(`/procurement/detail?id=${listData.id}`);
    } catch (e) {
      alert("Error launching stock check: " + e.message);
    } finally {
      setLaunchingStockCheck(false);
    }
  };
  const handlePrintAction = async (action, templateId = null) => {
    try {
      setPrintLoading(true);
      setShowPrintMenu(false);
      let template = null;
      console.log("handlePrintAction called with:", { action, templateId, quotationId });
      if (templateId) {
        console.log("Fetching template by ID:", templateId);
        const { data, error } = await supabase.from("document_templates").select("*").eq("id", templateId).single();
        console.log("Template query result:", { data, error });
        if (error) throw error;
        template = data;
      } else if (quotation.template_id) {
        console.log("Fetching template by quotation.template_id:", quotation.template_id);
        const { data, error } = await supabase.from("document_templates").select("*").eq("id", quotation.template_id).single();
        console.log("Template query result:", { data, error });
        if (error) throw error;
        template = data;
      } else {
        console.log("Fetching default template");
        const { data, error } = await supabase.from("document_templates").select("*").eq("document_type", "Quotation").eq("is_default", true).single();
        console.log("Default template query result:", { data, error });
        if (error) throw error;
        template = data;
      }
      if (!template) {
        alert("No template found. Please select a template from Template Settings.");
        return;
      }
      if (action === "preview-html") {
        previewQuotation(template);
      } else if (action === "preview") {
        await downloadPDF(template, "preview");
      } else if (action === "download") {
        await downloadPDF(template, "download");
      } else if (action === "email") {
        alert("Email feature coming soon!");
      } else if (action === "print") {
        await downloadPDF(template, "print");
      }
      setShowPrintMenu(false);
    } catch (err) {
      console.error("Error preparing print action:", err);
      alert("Unable to load print template. Please verify template settings.");
    } finally {
      setPrintLoading(false);
    }
  };
  const previewQuotation = async (template) => {
    setPreviewTemplate(template);
    setPreviewModalOpen(true);
    setPreviewLoading(true);
    const generatePreviewHTML = async (tmpl) => {
      if (tmpl?.column_settings?.print?.style === "saas") {
        const container = document.createElement("div");
        container.style.width = "210mm";
        container.style.position = "fixed";
        container.style.left = "-9999px";
        container.style.top = "0";
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
          const quotationWithTerms = {
            ...quotation,
            terms_conditions: termsConditionsQuery.data?.custom_content || null
          };
          root.render(
            /* @__PURE__ */ jsxDEV(
              SaaSTemplate,
              {
                data: quotationWithTerms,
                organisation,
                templateConfig: tmpl.column_settings
              },
              void 0,
              false,
              {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 580,
                columnNumber: 13
              },
              this
            )
          );
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        const html = container.innerHTML;
        document.body.removeChild(container);
        return html;
      }
      if (tmpl?.column_settings?.print?.style === "vertical" || tmpl?.template_code === "QTN_VERTICAL") {
        const container = document.createElement("div");
        container.style.width = "210mm";
        container.style.position = "fixed";
        container.style.left = "-9999px";
        container.style.top = "0";
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
          const quotationWithTerms = {
            ...quotation,
            terms_conditions: termsConditionsQuery.data?.custom_content || null
          };
          root.render(
            /* @__PURE__ */ jsxDEV(
              VerticalTemplate,
              {
                data: quotationWithTerms,
                organisation,
                templateConfig: tmpl.column_settings
              },
              void 0,
              false,
              {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 609,
                columnNumber: 13
              },
              this
            )
          );
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        const html = container.innerHTML;
        document.body.removeChild(container);
        return html;
      }
      if (tmpl?.template_code === "QTN_ENTERPRISE") {
        const quotationWithTerms = {
          ...quotation,
          terms_conditions: termsConditionsQuery.data?.custom_content || null
        };
        const isInterState = quotation.state && organisation?.state && quotation.state.trim().toLowerCase() !== organisation.state.trim().toLowerCase();
        const selectedSignatory = (organisation?.signatures || []).find((s) => s.id == quotation.authorized_signatory_id);
        const opts = {
          org: {
            name: organisation?.name || "",
            address: organisation?.address || "",
            city: organisation?.city || "",
            state: organisation?.state || "",
            pincode: organisation?.pincode || "",
            gstin: organisation?.gstin || "",
            phone: organisation?.phone || "",
            email: organisation?.email || "",
            logo_url: organisation?.logo_url || ""
          },
          client: {
            display_name: quotation.client?.client_name || quotation.client?.name || "",
            billing_address: quotation.billing_address || "",
            gstin: quotation.client?.gstin || quotation.gstin || "",
            state: quotation.client?.state || quotation.state || ""
          },
          header: {
            quotation_no: quotation.quotation_no || "",
            revision_no: quotation.revision_no ? parseInt(quotation.revision_no) : void 0,
            date: formatDate(quotation.date),
            valid_till: formatDate(quotation.valid_till),
            payment_terms: quotation.payment_terms || "",
            reference: quotation.reference || "",
            prepared_by: quotation.prepared_by || "",
            remarks: quotation.remarks || "",
            project_name: quotation.project?.project_name || quotation.project?.project_code || ""
          },
          items: (quotation.items || []).map((item) => ({
            is_header: item.is_header,
            is_subtotal: item.is_subtotal,
            subtotal_label: item.subtotal_label,
            description: item.description || item.item?.name || item.item?.display_name || "",
            item_code: item.item_code || item.item?.item_code || "",
            hsn_code: item.sac_code || item.item?.hsn_code || "",
            variant_name: item.variant?.variant_name || "",
            qty: item.qty,
            uom: item.uom,
            base_rate_snapshot: item.base_rate_snapshot || item.rate,
            discount_percent: item.discount_percent,
            rate: item.rate,
            tax_percent: item.tax_percent,
            line_total: item.line_total,
            custom1: item.custom1,
            custom2: item.custom2
          })),
          calculations: {
            subtotal: quotation.subtotal || 0,
            totalItemDiscount: quotation.total_item_discount || 0,
            extraDiscountAmount: quotation.extra_discount_amount || 0,
            cgst: isInterState ? 0 : (quotation.total_tax || 0) / 2,
            sgst: isInterState ? 0 : (quotation.total_tax || 0) / 2,
            igst: isInterState ? quotation.total_tax || 0 : 0,
            isInterState,
            totalTax: quotation.total_tax || 0,
            roundOff: quotation.round_off || 0,
            grandTotal: quotation.grand_total || 0,
            amountInWords: quotation.amount_in_words || ""
          },
          columnSettings: tmpl.column_settings,
          signatory: {
            name: selectedSignatory?.name || "",
            designation: organisation?.signatory_designation || "Authorised Signatory",
            for_company: organisation?.name || ""
          },
          bankDetails: {
            bank_name: organisation?.bank_name,
            branch: organisation?.bank_branch,
            account_name: organisation?.bank_account_name || organisation?.name,
            account_no: organisation?.bank_account_no,
            ifsc: organisation?.bank_ifsc,
            account_type: organisation?.bank_account_type,
            swift: organisation?.bank_swift
          },
          termsAndConditions: (() => {
            const rawTerms = quotationWithTerms.terms_conditions;
            let parsedTerms = [];
            if (rawTerms) {
              try {
                const parsed = typeof rawTerms === "string" ? JSON.parse(rawTerms) : rawTerms;
                const extractSections = (obj) => {
                  if (!obj) return;
                  if (Array.isArray(obj)) {
                    obj.forEach(extractSections);
                  } else if (obj.sections && Array.isArray(obj.sections)) {
                    obj.sections.forEach((sec) => {
                      if (sec.items && Array.isArray(sec.items)) {
                        sec.items.forEach((item) => {
                          if (item.content) parsedTerms.push(item.content);
                        });
                      }
                    });
                  }
                };
                extractSections(parsed);
                if (parsedTerms.length === 0) {
                  parsedTerms = typeof rawTerms === "string" ? rawTerms.split("\n") : [];
                }
              } catch (e) {
                parsedTerms = typeof rawTerms === "string" ? rawTerms.split("\n") : [];
              }
            }
            const finalTerms = parsedTerms.filter((t) => t && t.trim().length > 0);
            return finalTerms.length > 0 ? finalTerms : ["Payment as per terms mentioned above.", "This is a system-generated document."];
          })(),
          companyLogoBase64: organisation?.logo_url
        };
        try {
          const enterpriseDoc = generateQuotationPdf(opts);
          const pdfBlob = enterpriseDoc.output("blob");
          const blobUrl = URL.createObjectURL(pdfBlob);
          return `<iframe src="${blobUrl}#view=FitH" width="100%" height="800px" style="border: none; border-radius: 8px;"></iframe>`;
        } catch (e) {
          console.error("Enterprise Preview Error", e);
          return `<div class="p-8 text-center text-red-500">Error generating PDF preview</div>`;
        }
      }
      return generateQuotationHTML(tmpl);
    };
    try {
      const html = await generatePreviewHTML(template);
      setPreviewHTML(html);
    } catch (err) {
      console.error("Preview error:", err);
      setPreviewHTML('<div class="p-8 text-center text-red-500">Error generating preview</div>');
    } finally {
      setPreviewLoading(false);
    }
  };
  const downloadFromPreview = async () => {
    if (!previewTemplate || !quotation) return;
    const safeFileName = String(quotation.quotation_no || "quotation").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, "_");
    try {
      if (previewTemplate?.column_settings?.print?.style === "saas") {
        const blob = await htmlToPdf(document.getElementById("preview-modal-content"), `${safeFileName}.pdf`);
        return;
      }
      if (previewTemplate?.column_settings?.print?.style === "vertical" || previewTemplate?.template_code === "QTN_VERTICAL") {
        const blob = await htmlToPdf(document.getElementById("preview-modal-content"), `${safeFileName}.pdf`);
        return;
      }
      downloadPDF(previewTemplate);
    } catch (err) {
      console.error("Download error:", err);
      downloadPDF(previewTemplate);
    }
  };
  const printFromPreview = () => {
    const printContent = document.getElementById("preview-modal-content");
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print - ${quotation?.quotation_no || "Quotation"}</title>
          <script src="https://cdn.tailwindcss.com"><\/script>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { margin: 0; }
            }
            body { margin: 0; padding: 0; }
            #print-container { width: 210mm; margin: 0 auto; background: white; }
          </style>
        </head>
        <body>
          <div id="print-container">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };
  const downloadPDF = async (template, action = "download") => {
    try {
      if (!quotation) throw new Error("Quotation data is missing");
      const safeFileName = String(quotation.quotation_no || "quotation").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, "_");
      const handleOutput = (blob2) => {
        const url = URL.createObjectURL(blob2);
        if (action === "preview") {
          setPdfPreviewUrl(url);
          setShowPdfPreviewModal(true);
        } else if (action === "print") {
          const printWindow = window.open(url, "_blank");
          if (printWindow) {
            printWindow.onload = () => {
              printWindow.print();
            };
          }
        } else {
          const a = document.createElement("a");
          a.href = url;
          a.download = `${safeFileName}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 100);
        }
      };
      if (template.template_type === "html") {
        const htmlData = {
          document_type: "QUOTATION",
          quotation_no: quotation.quotation_no || "",
          revision_no: quotation.revision_no || "00",
          date: quotation.date || "",
          valid_till: quotation.valid_till || "",
          remarks: quotation.remarks || "",
          payment_terms: quotation.payment_terms || "",
          // Organisation details
          organisation_name: organisation.name || "",
          organisation_address: organisation.address || "",
          organisation_phone: organisation.phone || "",
          organisation_email: organisation.email || "",
          organisation_gstin: organisation.gstin || "",
          organisation_cin: organisation.cin || "",
          organisation_pan: organisation.pan || "",
          organisation_ie_code: organisation.ie_code || "",
          // Client details
          client_name: quotation.client?.client_name || quotation.client?.name || "",
          client_contact_person: quotation.contact_person || "",
          client_address: quotation.billing_address || quotation.client?.address || "",
          client_city: quotation.client?.city || "",
          client_pincode: quotation.client?.pincode || "",
          client_gstin: quotation.client?.gstin || quotation.gstin || "",
          client_phone: quotation.client?.phone || "",
          // Shipping details
          shipping_company_name: quotation.shipping_company_name || quotation.client?.client_name || "",
          shipping_address: quotation.shipping_address || quotation.billing_address || "",
          shipping_city: quotation.shipping_city || quotation.client?.city || "",
          shipping_pincode: quotation.shipping_pincode || quotation.client?.pincode || "",
          shipping_phone: quotation.shipping_phone || quotation.client?.phone || "",
          // Items
          items: (quotation.items || []).map((item, idx) => {
            const clientId = quotation.client_id || quotation.client?.id;
            const mapping = clientId && item.item?.mappings?.find((m) => m.client_id === clientId);
            return {
              index: idx + 1,
              hsn: item.sac_code || item.item?.hsn_code || "",
              item_code: mapping?.client_part_no || item.item?.item_code || "",
              description: mapping?.client_description || item.description || item.item?.display_name || item.item?.name || "",
              qty: String(item.qty || ""),
              uom: item.uom || "",
              rate: formatCurrency(item.rate || 0),
              gst_percent: item.tax_percent ? `${item.tax_percent}%` : "18%",
              amount: formatCurrency(item.line_total || 0)
            };
          }),
          // Totals
          subtotal: formatCurrency(quotation.subtotal || 0),
          cgst_amount: formatCurrency(quotation.cgst_amount || 0),
          sgst_amount: formatCurrency(quotation.sgst_amount || 0),
          round_off: quotation.round_off ? formatCurrency(quotation.round_off) : "0.00",
          grand_total: formatCurrency(quotation.grand_total || 0),
          amount_in_words: quotation.amount_in_words || "",
          // Bank details
          bank_name: organisation.bank_name || "",
          bank_branch: organisation.bank_branch || "",
          bank_account_no: organisation.bank_account_no || "",
          bank_account_type: organisation.bank_account_type || "",
          bank_ifsc: organisation.bank_ifsc || "",
          bank_micr: organisation.bank_micr || "",
          bank_swift: organisation.bank_swift || "",
          bank_upi: organisation.bank_upi || "",
          // Signatory
          signatory_designation: organisation.signatory_designation || "Director / Manager",
          // Terms & conditions
          terms_conditions: quotation.terms_conditions || organisation.terms_conditions || ""
        };
        const safeFileName2 = String(quotation.quotation_no || "quotation").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, "_");
        const blob2 = await renderTemplateToPdf(template.template_content || "", htmlData, `${safeFileName2}.pdf`);
        if (action === "blob") return blob2;
        handleOutput(blob2);
        return;
      }
      if (template?.column_settings?.print?.style === "saas") {
        const container = document.createElement("div");
        container.id = "pdf-capture-container";
        container.style.position = "fixed";
        container.style.left = "0";
        container.style.top = "0";
        container.style.width = "210mm";
        container.style.background = "white";
        container.style.zIndex = "-9999";
        container.style.pointerEvents = "none";
        const fontLink = document.createElement("link");
        fontLink.rel = "stylesheet";
        fontLink.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
        document.head.appendChild(fontLink);
        document.body.appendChild(container);
        const root = createRoot(container);
        try {
          const quotationWithTerms = {
            ...quotation,
            terms_conditions: termsConditionsQuery.data?.custom_content || null
          };
          flushSync(() => {
            root.render(/* @__PURE__ */ jsxDEV(SaaSTemplate, { data: quotationWithTerms, organisation, templateConfig: template.column_settings }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 981,
              columnNumber: 25
            }, this));
          });
          await new Promise((resolve) => setTimeout(resolve, 2e3));
          const blob2 = await htmlToPdf(container, `${safeFileName}.pdf`);
          if (action === "blob") return blob2;
          handleOutput(blob2);
        } catch (captureErr) {
          console.error("SaaS PDF Capture Error:", captureErr);
          throw captureErr;
        } finally {
          root.unmount();
          document.body.removeChild(container);
        }
        return;
      }
      if (template?.column_settings?.print?.style === "vertical" || template?.template_code === "QTN_VERTICAL") {
        const container = document.createElement("div");
        container.id = "pdf-capture-container";
        container.style.position = "absolute";
        container.style.left = "-9999px";
        container.style.top = "0";
        container.style.width = "210mm";
        container.style.background = "white";
        container.style.zIndex = "-9999";
        container.style.pointerEvents = "none";
        const fontLink = document.createElement("link");
        fontLink.rel = "stylesheet";
        fontLink.href = "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap";
        document.head.appendChild(fontLink);
        document.body.appendChild(container);
        const root = createRoot(container);
        try {
          const quotationWithTerms = {
            ...quotation,
            terms_conditions: termsConditionsQuery.data?.custom_content || null
          };
          flushSync(() => {
            root.render(/* @__PURE__ */ jsxDEV(VerticalTemplate, { data: quotationWithTerms, organisation, templateConfig: template.column_settings }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1027,
              columnNumber: 25
            }, this));
          });
          await new Promise((resolve) => setTimeout(resolve, 3e3));
          const blob2 = await htmlToPdf(container, `${safeFileName}.pdf`);
          if (action === "blob") return blob2;
          handleOutput(blob2);
        } catch (captureErr) {
          console.error("Vertical PDF Capture Error:", captureErr);
          throw captureErr;
        } finally {
          root.unmount();
          document.body.removeChild(container);
        }
        return;
      }
      if (template.template_code === "QTN_ZOHO") {
        try {
          const quotationWithTerms = {
            ...quotation,
            terms_conditions: termsConditionsQuery.data?.custom_content || null
          };
          const zohoDoc = generateZohoTemplate(quotationWithTerms, organisation, template);
          const blob2 = zohoDoc.output("blob");
          if (action === "blob") return blob2;
          handleOutput(blob2);
          return;
        } catch (error) {
          console.error("Error generating Zoho template:", error);
          throw error;
        }
      }
      if (template.template_code === "QTN_CLASSIC") {
        console.log("Classic template detected, template:", template);
        try {
          const quotationWithTerms = {
            ...quotation,
            terms_conditions: termsConditionsQuery.data?.custom_content || null
          };
          console.log("Generating Classic PDF with terms:", quotationWithTerms.terms_conditions);
          console.log("Organisation data:", organisation);
          console.log("Template settings:", template);
          const classicDoc = generateClassicQuotationTemplate(quotationWithTerms, organisation, template);
          const safeFileName2 = String(quotation.quotation_no || "quotation").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, "_");
          const blob2 = classicDoc.output("blob");
          if (action === "blob") return blob2;
          handleOutput(blob2);
          return;
        } catch (error) {
          console.error("Error generating Classic template:", error);
          throw error;
        }
      }
      if (template.template_code === "QTN_GRID_PRO") {
        const quotationWithTerms = {
          ...quotation,
          terms_conditions: termsConditionsQuery.data?.custom_content || null
        };
        console.log("Generating Grid Pro PDF with terms:", quotationWithTerms.terms_conditions);
        console.log("Terms conditions query data:", termsConditionsQuery.data);
        const gridDoc = generateProGridQuotationPdf(quotationWithTerms, organisation, template);
        const safeFileName2 = String(quotation.quotation_no || "quotation").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, "_");
        const blob2 = gridDoc.output("blob");
        if (action === "blob") return blob2;
        handleOutput(blob2);
        return;
      }
      if (template.template_code === "QTN_ENTERPRISE") {
        const quotationWithTerms = {
          ...quotation,
          terms_conditions: termsConditionsQuery.data?.custom_content || null
        };
        const isInterState2 = quotation.state && organisation?.state && quotation.state.trim().toLowerCase() !== organisation.state.trim().toLowerCase();
        const selectedSignatory = (organisation?.signatures || []).find((s) => s.id == quotation.authorized_signatory_id);
        const opts = {
          org: {
            name: organisation?.name || "",
            address: organisation?.address || "",
            city: organisation?.city || "",
            state: organisation?.state || "",
            pincode: organisation?.pincode || "",
            gstin: organisation?.gstin || "",
            phone: organisation?.phone || "",
            email: organisation?.email || "",
            logo_url: organisation?.logo_url || ""
          },
          client: {
            display_name: quotation.client?.client_name || quotation.client?.name || "",
            billing_address: quotation.billing_address || "",
            gstin: quotation.client?.gstin || quotation.gstin || "",
            state: quotation.client?.state || quotation.state || ""
          },
          header: {
            quotation_no: quotation.quotation_no || "",
            revision_no: quotation.revision_no ? parseInt(quotation.revision_no) : void 0,
            date: formatDate(quotation.date),
            valid_till: formatDate(quotation.valid_till),
            payment_terms: quotation.payment_terms || "",
            reference: quotation.reference || "",
            prepared_by: quotation.prepared_by || "",
            remarks: quotation.remarks || "",
            project_name: quotation.project?.project_name || quotation.project?.project_code || ""
          },
          items: (quotation.items || []).map((item) => ({
            is_header: item.is_header,
            is_subtotal: item.is_subtotal,
            subtotal_label: item.subtotal_label,
            description: item.description || item.item?.name || item.item?.display_name || "",
            item_code: item.item_code || item.item?.item_code || "",
            hsn_code: item.sac_code || item.item?.hsn_code || "",
            variant_name: item.variant?.variant_name || "",
            qty: item.qty,
            uom: item.uom,
            base_rate_snapshot: item.base_rate_snapshot || item.rate,
            discount_percent: item.discount_percent,
            rate: item.rate,
            tax_percent: item.tax_percent,
            line_total: item.line_total,
            custom1: item.custom1,
            custom2: item.custom2
          })),
          calculations: {
            subtotal: quotation.subtotal || 0,
            totalItemDiscount: quotation.total_item_discount || 0,
            extraDiscountAmount: quotation.extra_discount_amount || 0,
            cgst: isInterState2 ? 0 : (quotation.total_tax || 0) / 2,
            sgst: isInterState2 ? 0 : (quotation.total_tax || 0) / 2,
            igst: isInterState2 ? quotation.total_tax || 0 : 0,
            isInterState: isInterState2,
            totalTax: quotation.total_tax || 0,
            roundOff: quotation.round_off || 0,
            grandTotal: quotation.grand_total || 0,
            amountInWords: quotation.amount_in_words || ""
          },
          columnSettings: template.column_settings,
          signatory: {
            name: selectedSignatory?.name || "",
            designation: organisation?.signatory_designation || "Authorised Signatory",
            for_company: organisation?.name || ""
          },
          bankDetails: {
            bank_name: organisation?.bank_name,
            branch: organisation?.bank_branch,
            account_name: organisation?.bank_account_name || organisation?.name,
            account_no: organisation?.bank_account_no,
            ifsc: organisation?.bank_ifsc,
            account_type: organisation?.bank_account_type,
            swift: organisation?.bank_swift
          },
          termsAndConditions: quotationWithTerms.terms_conditions ? quotationWithTerms.terms_conditions.split("\n").filter((t) => t.trim().length > 0) : ["Payment as per terms mentioned above.", "This is a system-generated document."],
          companyLogoBase64: organisation?.logo_url
        };
        const enterpriseDoc = generateQuotationPdf(opts);
        const safeFileName2 = String(quotation.quotation_no || "quotation").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, "_");
        const blob2 = enterpriseDoc.output("blob");
        if (action === "blob") return blob2;
        handleOutput(blob2);
        return;
      }
      if (template?.column_settings?.print?.style === "sakthi" || template?.template_code === "QTN_SAKTHI") {
        const quotationWithTerms = {
          ...quotation,
          terms_conditions: termsConditionsQuery.data?.custom_content || null
        };
        const sakthiDoc = await generateSakthiPdf(quotationWithTerms, organisation, "Quotation", template);
        const blob2 = sakthiDoc.output("blob");
        if (action === "blob") return blob2;
        handleOutput(blob2);
        return;
      }
      const isLandscape = template.orientation === "Landscape";
      const doc = new jsPDF({
        orientation: isLandscape ? "landscape" : "portrait",
        unit: "mm",
        format: template.page_size === "Letter" ? "letter" : "a4"
      });
      const colSettings = template && typeof template.column_settings === "object" && template.column_settings || {};
      const optionalCols = colSettings.optional || {};
      const labels = colSettings.labels || {};
      const columnConfig = [];
      if (optionalCols.sno !== false) columnConfig.push({ header: "#", key: "sno", width: 10 });
      if (optionalCols.hsn_code) columnConfig.push({ header: "HSN/SAC", key: "hsn_code", width: 20 });
      if (optionalCols.item !== false) columnConfig.push({ header: "Item", key: "item", width: 45 });
      if (optionalCols.item_code) columnConfig.push({ header: "Part No", key: "item_code", width: 25 });
      if (optionalCols.make) columnConfig.push({ header: "Make", key: "make", width: 25 });
      if (optionalCols.variant) columnConfig.push({ header: "Discount Category", key: "variant", width: 25 });
      if (optionalCols.description) columnConfig.push({ header: "Description", key: "description", width: 40 });
      if (optionalCols.qty !== false) columnConfig.push({ header: "Qty", key: "qty", width: 12, align: "right" });
      if (optionalCols.uom !== false) columnConfig.push({ header: "Unit", key: "uom", width: 15 });
      if (optionalCols.rate) {
        columnConfig.push({ header: "Rate", key: "base_rate", width: 22, align: "right" });
      }
      if (optionalCols.discount_percent) {
        columnConfig.push({ header: "Disc %", key: "discount_percent", width: 15, align: "right" });
      }
      if (optionalCols.rate_after_discount) {
        columnConfig.push({
          header: labels.rate_after_discount || "Rate/Unit",
          key: "rate_after_discount",
          width: 22,
          align: "right"
        });
      }
      if (optionalCols.tax_percent) columnConfig.push({ header: "Tax %", key: "tax_percent", width: 15, align: "right" });
      if (optionalCols.custom1) {
        columnConfig.push({ header: labels.custom1 || "Custom 1", key: "custom1", width: 22 });
      }
      if (optionalCols.custom2) {
        columnConfig.push({ header: labels.custom2 || "Custom 2", key: "custom2", width: 22 });
      }
      columnConfig.push({ header: "Amount", key: "line_total", width: 28, align: "right" });
      let startY = 40;
      if (template.show_logo !== false) {
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text("Quotation", 105, 20, { align: "center" });
        startY = 35;
      } else {
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text("Quotation", 105, 15, { align: "center" });
        startY = 25;
      }
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`No: ${quotation.quotation_no}`, 14, startY);
      doc.text(`Date: ${formatDate(quotation.date)}`, 14, startY + 6);
      doc.text(`Valid Till: ${formatDate(quotation.valid_till)}`, 14, startY + 12);
      doc.text("To:", 14, startY + 22);
      doc.setFont("helvetica", "bold");
      doc.text(quotation.client?.client_name || "", 14, startY + 28);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      if (quotation.billing_address) {
        const addressLines = doc.splitTextToSize(quotation.billing_address, 70);
        doc.text(addressLines, 14, startY + 34);
      }
      doc.text(`GSTIN: ${quotation.gstin || "-"}`, 14, startY + 48);
      doc.text(`State: ${quotation.state || "-"}`, 14, startY + 54);
      const rightCol = isLandscape ? 140 : 120;
      if (quotation.project) {
        doc.text(`Project: ${quotation.project.project_name || quotation.project.project_code || "-"}`, rightCol, startY + 22);
      }
      const tableData = (quotation.items || []).map((item, index) => {
        const material = item.item || {};
        const row = {};
        if (optionalCols.sno !== false) row.sno = index + 1;
        const clientId = quotation.client_id || quotation.client?.id;
        const mapping = clientId && material?.mappings?.find((m) => m.client_id === clientId);
        if (optionalCols.hsn_code) row.hsn_code = item.sac_code || material.hsn_code || "-";
        if (optionalCols.item !== false) row.item = mapping?.client_description || item.description || material.name || "-";
        if (optionalCols.item_code) row.item_code = mapping?.client_part_no || material.item_code || "-";
        if (optionalCols.make) row.make = item.make || "-";
        if (optionalCols.variant) row.variant = item.variant?.variant_name || "-";
        if (optionalCols.description) row.description = mapping?.client_description || item.description || "-";
        if (optionalCols.qty !== false) row.qty = item.qty;
        if (optionalCols.uom !== false) row.uom = item.uom;
        if (optionalCols.rate) row.base_rate = formatCurrencyNoSymbol(item.base_rate_snapshot || item.rate);
        if (optionalCols.discount_percent) row.discount_percent = `${item.discount_percent}%`;
        if (optionalCols.rate_after_discount) row.rate_after_discount = formatCurrencyNoSymbol(item.rate);
        if (optionalCols.tax_percent) row.tax_percent = `${item.tax_percent}%`;
        if (optionalCols.custom1) row.custom1 = item.custom1 || "-";
        if (optionalCols.custom2) row.custom2 = item.custom2 || "-";
        row.line_total = formatCurrencyNoSymbol(item.line_total);
        return row;
      });
      const tableStartY = startY + 60;
      autoTable(doc, {
        startY: tableStartY,
        head: [columnConfig.map((col) => col.header)],
        body: tableData.map((row) => columnConfig.map((col) => row[col.key])),
        theme: "grid",
        headStyles: { fillColor: [66, 66, 66], fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: columnConfig.reduce((acc, col, idx) => {
          if (col.align === "right") acc[idx] = { halign: "right" };
          return acc;
        }, {})
      });
      const finalY = (doc.lastAutoTable?.finalY || tableStartY + 10) + 10;
      const summaryX = isLandscape ? 200 : 160;
      doc.setFontSize(9);
      doc.text("Subtotal:", summaryX, finalY);
      doc.text(formatCurrency(quotation.subtotal), summaryX + 35, finalY, { align: "right" });
      doc.text("Item Discount:", summaryX, finalY + 6);
      doc.text(`-${formatCurrency(quotation.total_item_discount)}`, summaryX + 35, finalY + 6, { align: "right" });
      doc.text("Extra Discount:", summaryX, finalY + 12);
      doc.text(`-${formatCurrency(quotation.extra_discount_amount)}`, summaryX + 35, finalY + 12, { align: "right" });
      const isInterState = quotation.state && organisation?.state && quotation.state.trim().toLowerCase() !== organisation.state.trim().toLowerCase();
      if (isInterState) {
        doc.text("IGST:", summaryX, finalY + 18);
        doc.text(formatCurrency(quotation.total_tax), summaryX + 35, finalY + 18, { align: "right" });
      } else {
        doc.text("CGST:", summaryX, finalY + 18);
        doc.text(formatCurrency(quotation.total_tax / 2), summaryX + 35, finalY + 18, { align: "right" });
        doc.text("SGST:", summaryX, finalY + 24);
        doc.text(formatCurrency(quotation.total_tax / 2), summaryX + 35, finalY + 24, { align: "right" });
      }
      const offset = isInterState ? 24 : 30;
      doc.text("Round Off:", summaryX, finalY + offset);
      doc.text(formatCurrency(quotation.round_off), summaryX + 35, finalY + offset, { align: "right" });
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      const grandTotalOffset = isInterState ? 34 : 40;
      doc.text("Grand Total:", summaryX, finalY + grandTotalOffset);
      doc.text(formatCurrency(quotation.grand_total), summaryX + 35, finalY + grandTotalOffset, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Payment Terms: ${quotation.payment_terms || "-"}`, 14, finalY + grandTotalOffset);
      if (quotation.contact_no) {
        doc.text(`Contact No: ${quotation.contact_no}`, 14, finalY + (isInterState ? 42 : 48));
      }
      const remarksText = quotation.remarks || quotation.reference;
      if (remarksText) {
        doc.text(`Remarks: ${remarksText}`, 14, finalY + (isInterState ? 50 : 56));
      }
      if (template.show_terms !== false) {
        doc.setFontSize(8);
        const termsStart = finalY + (isInterState ? 58 : 64);
        doc.text("Terms & Conditions:", 14, termsStart);
        doc.text("1. Payment as per terms mentioned above.", 14, termsStart + 6);
        doc.text("2. This is a system-generated document.", 14, termsStart + 12);
      }
      if (template.show_signature !== false) {
        const signStart = finalY + (isInterState ? 58 : 64);
        doc.text(`For, ${organisation?.name || "Company Name"}`, 140, signStart);
        const selectedSignatory = (organisation?.signatures || []).find((s) => s.id == quotation.authorized_signatory_id);
        if (selectedSignatory?.url) {
          try {
            doc.addImage(selectedSignatory.url, "PNG", 140, signStart + 2, 30, 15);
          } catch (e) {
            console.warn("Sign image error:", e);
          }
        }
        doc.text(selectedSignatory?.name || "Authorized Signature", 140, signStart + 20);
      }
      const blob = doc.output("blob");
      if (action === "blob") return blob;
      handleOutput(blob);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("PDF export failed. Please check template settings and try again.");
    } finally {
      setPrintLoading(false);
    }
  };
  const generateQuotationHTML = (template) => {
    const colSettings = template.column_settings || {};
    const optionalCols = colSettings.optional || {};
    const labels = colSettings.labels || {};
    let columnsHTML = "";
    if (optionalCols.sno !== false) columnsHTML += "<th>#</th>";
    if (optionalCols.hsn_code) columnsHTML += "<th>HSN/SAC</th>";
    if (optionalCols.item !== false) columnsHTML += "<th>Item</th>";
    if (optionalCols.variant) columnsHTML += "<th>Discount Category</th>";
    if (optionalCols.description) columnsHTML += "<th>Description</th>";
    if (optionalCols.qty !== false) columnsHTML += "<th>Qty</th>";
    if (optionalCols.uom !== false) columnsHTML += "<th>Unit</th>";
    if (optionalCols.rate) columnsHTML += "<th>Rate</th>";
    if (optionalCols.discount_percent) columnsHTML += "<th>Disc %</th>";
    if (optionalCols.rate_after_discount) columnsHTML += `<th>${labels.rate_after_discount || "Rate/Unit"}</th>`;
    if (optionalCols.tax_percent) columnsHTML += "<th>Tax %</th>";
    if (optionalCols.custom1) columnsHTML += `<th>${labels.custom1 || "Custom 1"}</th>`;
    if (optionalCols.custom2) columnsHTML += `<th>${labels.custom2 || "Custom 2"}</th>`;
    columnsHTML += "<th>Total</th>";
    let rowsHTML = "";
    quotation.items.forEach((item, index) => {
      if (item.is_header) {
        let colCount = 0;
        if (optionalCols.sno !== false) colCount++;
        if (optionalCols.hsn_code) colCount++;
        if (optionalCols.item !== false) colCount++;
        if (optionalCols.variant) colCount++;
        if (optionalCols.description) colCount++;
        if (optionalCols.qty !== false) colCount++;
        if (optionalCols.uom !== false) colCount++;
        if (optionalCols.rate) colCount++;
        if (optionalCols.discount_percent) colCount++;
        if (optionalCols.rate_after_discount) colCount++;
        if (optionalCols.tax_percent) colCount++;
        if (optionalCols.custom1) colCount++;
        if (optionalCols.custom2) colCount++;
        colCount++;
        rowsHTML += `<tr><td colspan="${colCount}" style="padding:10px 14px;font-weight:bold;font-size:13px;background:#f8fafc">${item.description || "Section"}</td></tr>`;
        return;
      }
      if (item.is_subtotal) {
        let subtotalAmount = 0;
        for (let i = index - 1; i >= 0; i--) {
          const prev = quotation.items[i];
          if (prev.is_subtotal || prev.is_header) break;
          subtotalAmount += parseFloat(prev.line_total) || 0;
        }
        let colCount = 0;
        if (optionalCols.sno !== false) colCount++;
        if (optionalCols.hsn_code) colCount++;
        if (optionalCols.item !== false) colCount++;
        if (optionalCols.variant) colCount++;
        if (optionalCols.description) colCount++;
        if (optionalCols.qty !== false) colCount++;
        if (optionalCols.uom !== false) colCount++;
        if (optionalCols.rate) colCount++;
        if (optionalCols.discount_percent) colCount++;
        if (optionalCols.rate_after_discount) colCount++;
        if (optionalCols.tax_percent) colCount++;
        if (optionalCols.custom1) colCount++;
        if (optionalCols.custom2) colCount++;
        colCount++;
        rowsHTML += `<tr style="background:#fef9c3;border-top:2px solid #eab308"><td colspan="${colCount}" style="padding:10px 14px"><div style="display:flex;justify-content:flex-end;width:100%;gap:16px"><span style="font-weight:bold;font-size:13px;color:#b45309;text-align:right">${item.subtotal_label || "Sub-total:"}</span><span style="font-weight:bold;font-size:13px;color:#b45309;min-width:100px;text-align:right">${formatCurrency(subtotalAmount)}</span></div></td></tr>`;
        return;
      }
      const material = item.item || {};
      let rowHTML = "<tr>";
      if (optionalCols.sno !== false) rowHTML += `<td>${index + 1}</td>`;
      if (optionalCols.hsn_code) rowHTML += `<td>${item.sac_code || material.hsn_code || "-"}</td>`;
      if (optionalCols.item !== false) rowHTML += `<td>${item.description || "-"}</td>`;
      if (optionalCols.variant) rowHTML += `<td>${item.variant?.variant_name || "-"}</td>`;
      if (optionalCols.description) rowHTML += `<td>${item.description || "-"}</td>`;
      if (optionalCols.qty !== false) rowHTML += `<td style="text-align:right">${item.qty}</td>`;
      if (optionalCols.uom !== false) rowHTML += `<td>${item.uom}</td>`;
      if (optionalCols.rate) rowHTML += `<td style="text-align:right">${formatCurrency(item.base_rate_snapshot || item.rate)}</td>`;
      if (optionalCols.discount_percent) rowHTML += `<td style="text-align:right">${item.discount_percent}%</td>`;
      if (optionalCols.rate_after_discount) rowHTML += `<td style="text-align:right">${formatCurrency(item.rate)}</td>`;
      if (optionalCols.tax_percent) rowHTML += `<td style="text-align:right">${item.tax_percent}%</td>`;
      if (optionalCols.custom1) rowHTML += `<td>${item.custom1 || "-"}</td>`;
      if (optionalCols.custom2) rowHTML += `<td>${item.custom2 || "-"}</td>`;
      rowHTML += `<td style="text-align:right;font-weight:bold">${formatCurrency(item.line_total)}</td>`;
      rowHTML += "</tr>";
      rowsHTML += rowHTML;
    });
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Quotation - ${quotation.quotation_no}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { text-align: center; color: #000; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
          .info-box { line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px; }
          th { background-color: #f3f4f6; color: #374151; font-weight: 600; }
          .summary { float: right; width: 300px; }
          .summary-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f3f4f6; }
          .total { font-weight: bold; font-size: 1.2em; border-top: 2px solid #374151; margin-top: 10px; padding-top: 10px; }
          .footer { margin-top: 50px; clear: both; }
        </style>
      </head>
      <body>
        <h1>QUOTATION</h1>
        <div class="info-grid">
          <div class="info-box">
            <strong>To:</strong><br>
            ${quotation.client?.client_name || "-"}<br>
            ${quotation.billing_address || "-"}<br>
            GSTIN: ${quotation.gstin || "-"}<br>
            State: ${quotation.state || "-"}
          </div>
          <div class="info-box" style="text-align: right;">
            <strong>Quotation No:</strong> ${quotation.quotation_no}<br>
            <strong>Date:</strong> ${formatDate(quotation.date)}<br>
            <strong>Valid Till:</strong> ${formatDate(quotation.valid_till)}<br>
            <strong>Project:</strong> ${quotation.project?.project_name || quotation.project?.project_code || "-"}
          </div>
        </div>
        <table>
          <thead><tr>${columnsHTML}</tr></thead>
          <tbody>${rowsHTML}</tbody>
        </table>
        <div class="summary">
          <div class="summary-row"><span>Subtotal</span><span>${formatCurrency(quotation.subtotal)}</span></div>
          <div class="summary-row"><span>Discount</span><span>-${formatCurrency(quotation.total_item_discount + quotation.extra_discount_amount)}</span></div>
          <div class="summary-row"><span>Tax</span><span>${formatCurrency(quotation.total_tax)}</span></div>
          <div class="summary-row total"><span>Grand Total</span><span>${formatCurrency(quotation.grand_total)}</span></div>
        </div>
        <div class="footer">
          <p><strong>Payment Terms:</strong> ${quotation.payment_terms || "-"}</p>
          <p><strong>Remarks:</strong> ${quotation.remarks || quotation.reference || "-"}</p>
        </div>
      </body>
      </html>
    `;
  };
  const getStatusBadge = (status) => {
    const colors = {
      "Draft": { bg: "#f3f4f6", color: "#6b7280" },
      "Sent": { bg: "#dbeafe", color: "#1e40af" },
      "Under Negotiation": { bg: "#fef3c7", color: "#b45309" },
      "Approved": { bg: "#d1fae5", color: "#047857" },
      "PENDING_APPROVAL": { bg: "#fef3c7", color: "#d97706" },
      "Rejected": { bg: "#fee2e2", color: "#dc2626" },
      "Converted": { bg: "#dbeafe", color: "#1e40af" },
      "Cancelled": { bg: "#fee2e2", color: "#991b1b" },
      "Expired": { bg: "#f3f4f6", color: "#9ca3af" }
    };
    const style = colors[status] || colors["Draft"];
    return /* @__PURE__ */ jsxDEV("span", { style: {
      background: style.bg,
      color: style.color,
      padding: "4px 12px",
      borderRadius: "12px",
      fontSize: "13px",
      fontWeight: 600
    }, children: status }, void 0, false, {
      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
      lineNumber: 1597,
      columnNumber: 7
    }, this);
  };
  const getSelectedTemplateName = () => {
    if (!selectedTemplateId) return "Default";
    const template = templates.find((t) => t.id === selectedTemplateId);
    return template?.template_name || "Default";
  };
  const isEditable = quotation?.status !== "Converted" && quotation?.status !== "Cancelled";
  const isDeletable = quotation?.status === "Draft";
  const isCancellable = quotation?.status !== "Cancelled" && quotation?.status !== "Converted" && quotation?.status !== "Draft";
  const canApprove = quotation?.status === "PENDING_APPROVAL";
  if (loading) {
    return /* @__PURE__ */ jsxDEV("div", { style: { padding: "40px", textAlign: "center" }, children: "Loading..." }, void 0, false, {
      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
      lineNumber: 1622,
      columnNumber: 12
    }, this);
  }
  if (!quotationId) {
    return /* @__PURE__ */ jsxDEV("div", { style: { padding: "40px", textAlign: "center" }, children: "Quotation ID is missing." }, void 0, false, {
      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
      lineNumber: 1626,
      columnNumber: 12
    }, this);
  }
  if (quotationQuery.isError) {
    return /* @__PURE__ */ jsxDEV("div", { style: { padding: "40px", textAlign: "center" }, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 600, color: "#b91c1c", marginBottom: "12px" }, children: quotationQuery.error?.message || "Unable to load quotation." }, void 0, false, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 1632,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("button", { type: "button", className: "btn btn-primary", onClick: () => quotationQuery.refetch(), children: "Retry" }, void 0, false, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 1635,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
      lineNumber: 1631,
      columnNumber: 7
    }, this);
  }
  if (!quotation) {
    return /* @__PURE__ */ jsxDEV("div", { style: { padding: "40px", textAlign: "center" }, children: "Quotation not found" }, void 0, false, {
      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
      lineNumber: 1643,
      columnNumber: 12
    }, this);
  }
  if (isEmbed) {
    if (embedLoading || !embedPdfUrl) {
      return /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-6", children: [
        /* @__PURE__ */ jsxDEV(Loader2, { className: "w-8 h-8 animate-spin text-sky-500 mb-4" }, void 0, false, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 1650,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-sm font-semibold text-zinc-600", children: "Generating quotation PDF..." }, void 0, false, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 1651,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 1649,
        columnNumber: 9
      }, this);
    }
    if (embedError) {
      return /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-6 text-center", children: [
        /* @__PURE__ */ jsxDEV("span", { className: "text-3xl mb-3", children: "⚠️" }, void 0, false, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 1658,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-sm font-semibold text-red-500 mb-2", children: "Failed to generate PDF" }, void 0, false, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 1659,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-zinc-500", children: embedError }, void 0, false, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 1660,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 1657,
        columnNumber: 9
      }, this);
    }
    return /* @__PURE__ */ jsxDEV("div", { className: "w-full h-screen bg-zinc-800", children: /* @__PURE__ */ jsxDEV(
      "iframe",
      {
        src: `${embedPdfUrl}#view=FitH`,
        className: "w-full h-full border-none",
        title: "Quotation PDF"
      },
      void 0,
      false,
      {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 1666,
        columnNumber: 9
      },
      this
    ) }, void 0, false, {
      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
      lineNumber: 1665,
      columnNumber: 7
    }, this);
  }
  return /* @__PURE__ */ jsxDEV(Fragment, { children: [
    /* @__PURE__ */ jsxDEV(ResizablePanelGroup, { direction: "horizontal", autoSaveId: "quotation-split", className: "flex h-[calc(100vh-48px)] bg-zinc-100 overflow-hidden", children: [
      /* @__PURE__ */ jsxDEV(ResizablePanel, { defaultSize: 22, minSize: 16, maxSize: 38, className: "flex flex-col bg-white shadow-sm", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "py-5 px-6 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center", children: [
          /* @__PURE__ */ jsxDEV("h2", { className: "text-sm font-bold text-zinc-700", children: "All Quotes" }, void 0, false, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 1682,
            columnNumber: 11
          }, this),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => navigate("/quotation/create"),
              className: "p-1.5 bg-sky-500 text-white rounded hover:bg-sky-600 transition-colors",
              children: /* @__PURE__ */ jsxDEV(Plus, { className: "w-4 h-4" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1687,
                columnNumber: 13
              }, this)
            },
            void 0,
            false,
            {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1683,
              columnNumber: 11
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 1681,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex-1 overflow-y-auto", children: quotationsQuery.isPending ? /* @__PURE__ */ jsxDEV("div", { className: "p-8 text-center text-zinc-400 text-sm italic", children: "Loading quotes..." }, void 0, false, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 1692,
          columnNumber: 13
        }, this) : quotations.length === 0 ? /* @__PURE__ */ jsxDEV("div", { className: "p-8 text-center text-zinc-400 text-sm italic", children: "No quotations found" }, void 0, false, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 1694,
          columnNumber: 13
        }, this) : /* @__PURE__ */ jsxDEV("div", { className: "divide-y divide-zinc-100", children: quotations.map(
          (q) => /* @__PURE__ */ jsxDEV(
            "div",
            {
              onClick: () => navigate(`/quotation/view?id=${q.id}`),
              className: `px-4 cursor-pointer transition-colors hover:bg-sky-50/30 ${quotationId === q.id ? "bg-sky-100" : "bg-white"}`,
              style: { paddingTop: "14px", paddingBottom: "14px" },
              children: [
                /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between items-start mb-1", children: [
                  /* @__PURE__ */ jsxDEV("span", { className: "text-[13px] font-bold text-zinc-900 truncate pr-2", style: { paddingLeft: "10px", paddingRight: "10px" }, children: q.client?.client_name || "Walk-in Client" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1705,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { className: "text-[12px] font-bold text-zinc-900", style: { paddingLeft: "10px", paddingRight: "10px" }, children: formatCurrency(q.grand_total) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1708,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 1704,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between items-center mt-1 gap-4", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "text-[11px] font-inter flex items-center", style: { paddingLeft: "10px", paddingRight: "10px", marginLeft: "1px", gap: "5px" }, children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "text-zinc-700 font-medium", children: q.quotation_no }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 1714,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "text-zinc-300", children: "•" }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 1715,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "text-blue-500", children: formatDate(q.date) }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 1716,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1713,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV(
                    "span",
                    {
                      className: "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                      style: {
                        backgroundColor: q.status === "Approved" ? "#d1fae5" : q.status === "Draft" ? "#f3f4f6" : "#fff7ed",
                        color: q.status === "Approved" ? "#047857" : q.status === "Draft" ? "#6b7280" : "#c2410c"
                      },
                      children: q.status
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 1718,
                      columnNumber: 21
                    },
                    this
                  )
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 1712,
                  columnNumber: 19
                }, this)
              ]
            },
            q.id,
            true,
            {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1698,
              columnNumber: 15
            },
            this
          )
        ) }, void 0, false, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 1696,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 1690,
          columnNumber: 9
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 1680,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV(ResizableHandle, { withHandle: true }, void 0, false, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 1734,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV(ResizablePanel, { defaultSize: 78, className: "bg-zinc-50 overflow-y-auto", children: /* @__PURE__ */ jsxDEV("div", { className: "max-w-5xl mx-auto py-12 px-8 sm:px-12 lg:px-16", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between mb-8", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-4", children: [
            /* @__PURE__ */ jsxDEV("h1", { className: "text-2xl font-bold text-zinc-900", children: quotation.quotation_no }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1741,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV(
              "span",
              {
                className: "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
                style: {
                  backgroundColor: quotation.status === "Approved" ? "#d1fae5" : "#f3f4f6",
                  color: quotation.status === "Approved" ? "#047857" : "#6b7280",
                  borderColor: quotation.status === "Approved" ? "#10b981" : "#e5e7eb"
                },
                children: quotation.status
              },
              void 0,
              false,
              {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1742,
                columnNumber: 15
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 1740,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3", children: /* @__PURE__ */ jsxDEV(
            "button",
            {
              className: "inline-flex items-center gap-2 px-10 h-[25px] min-w-[100px] bg-gradient-to-b from-[#001f3f] to-[#003366] text-white rounded-none hover:opacity-90 transition-all text-[11px] font-bold shadow-none border-none",
              onClick: () => handlePrintAction("download"),
              children: [
                /* @__PURE__ */ jsxDEV(Printer, { className: "w-[14px] h-[14px]" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 1758,
                  columnNumber: 17
                }, this),
                "Print"
              ]
            },
            void 0,
            true,
            {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1754,
              columnNumber: 15
            },
            this
          ) }, void 0, false, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 1753,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 1739,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap items-center gap-[20px] mb-6 px-8 border-t border-zinc-200", style: { paddingTop: "16px", paddingBottom: "16px" }, children: [
          isEditable && /* @__PURE__ */ jsxDEV("button", { className: "inline-flex items-center gap-2 px-3 py-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all text-[13px] font-semibold", onClick: handleEdit, children: [
            /* @__PURE__ */ jsxDEV(Edit, { className: "w-[14px] h-[14px]" }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1767,
              columnNumber: 17
            }, this),
            "Edit"
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 1766,
            columnNumber: 15
          }, this),
          canApprove && /* @__PURE__ */ jsxDEV("button", { className: "inline-flex items-center gap-2 px-3 py-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-all text-[13px] font-semibold", onClick: () => handleApprovalAction("APPROVED"), children: [
            /* @__PURE__ */ jsxDEV(CheckCircle, { className: "w-[14px] h-[14px]" }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1773,
              columnNumber: 17
            }, this),
            "Approve"
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 1772,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("button", { className: "inline-flex items-center gap-2 px-3 py-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all text-[13px] font-semibold", onClick: handleDuplicate, children: [
            /* @__PURE__ */ jsxDEV(Copy, { className: "w-[14px] h-[14px]" }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1778,
              columnNumber: 15
            }, this),
            "Duplicate"
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 1777,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "relative", children: [
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                className: "inline-flex items-center gap-2 px-3 py-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all text-[13px] font-semibold",
                onClick: () => {
                  setShowConvertMenu(!showConvertMenu);
                  setShowPrintMenu(false);
                  setShowTemplateMenu(false);
                  setShowActionsMenu(false);
                },
                children: [
                  /* @__PURE__ */ jsxDEV(FileText, { className: "w-[14px] h-[14px]" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1787,
                    columnNumber: 17
                  }, this),
                  "Convert",
                  /* @__PURE__ */ jsxDEV(ChevronDown, { className: `w-[14px] h-[14px] transition-transform ${showConvertMenu ? "rotate-180" : ""}` }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1789,
                    columnNumber: 17
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1783,
                columnNumber: 15
              },
              this
            ),
            showConvertMenu && /* @__PURE__ */ jsxDEV("div", { className: "absolute left-0 top-full mt-1 z-50 min-w-[200px] bg-white border border-zinc-200 shadow-xl p-1", children: [
              /* @__PURE__ */ jsxDEV("button", { onClick: () => handleConvert("proforma-invoice"), className: "block w-full text-left px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-sky-50", children: "Proforma Invoice" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1794,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("button", { onClick: () => handleConvert("invoice"), className: "block w-full text-left px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-sky-50", children: "Tax Invoice" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1795,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1793,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 1782,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "relative", children: [
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                className: "inline-flex items-center gap-2 px-3 py-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all text-[13px] font-semibold",
                onClick: () => {
                  setShowPrintMenu(!showPrintMenu);
                  setShowConvertMenu(false);
                  setShowTemplateMenu(false);
                  setShowActionsMenu(false);
                },
                disabled: printLoading,
                children: [
                  printLoading ? /* @__PURE__ */ jsxDEV(Loader2, { className: "w-[14px] h-[14px] animate-spin" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1812,
                    columnNumber: 19
                  }, this) : /* @__PURE__ */ jsxDEV(Printer, { className: "w-[14px] h-[14px]" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1814,
                    columnNumber: 19
                  }, this),
                  "Print (",
                  getSelectedTemplateName(),
                  ")",
                  /* @__PURE__ */ jsxDEV(ChevronDown, { className: `w-[14px] h-[14px] transition-transform ${showPrintMenu ? "rotate-180" : ""}` }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1817,
                    columnNumber: 17
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1801,
                columnNumber: 15
              },
              this
            ),
            showPrintMenu && /* @__PURE__ */ jsxDEV("div", { ref: printMenuRef, className: "absolute left-0 top-full mt-1 z-50 min-w-[240px] bg-white border border-zinc-200 shadow-xl p-1 rounded-sm", children: printMenuView === "main" ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: () => handlePrintAction("preview"),
                  className: "flex items-center gap-3 w-full text-left text-xs font-bold text-zinc-700 hover:bg-sky-50 transition-colors",
                  style: { padding: "12px" },
                  children: [
                    /* @__PURE__ */ jsxDEV(Eye, { className: "w-4 h-4 text-sky-500" }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 1829,
                      columnNumber: 25
                    }, this),
                    "Preview"
                  ]
                },
                void 0,
                true,
                {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 1824,
                  columnNumber: 23
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: () => handlePrintAction("download"),
                  className: "flex items-center gap-3 w-full text-left text-xs font-bold text-zinc-700 hover:bg-sky-50 transition-colors",
                  style: { padding: "12px" },
                  children: [
                    /* @__PURE__ */ jsxDEV(Download, { className: "w-4 h-4 text-sky-500" }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 1837,
                      columnNumber: 25
                    }, this),
                    "Download PDF"
                  ]
                },
                void 0,
                true,
                {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 1832,
                  columnNumber: 23
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("div", { className: "h-px bg-zinc-100 my-1" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1840,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: () => setPrintMenuView("templates"),
                  className: "flex items-center justify-between w-full text-left text-xs font-bold text-zinc-700 hover:bg-sky-50 transition-colors group",
                  style: { padding: "12px" },
                  children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3", children: [
                      /* @__PURE__ */ jsxDEV(FileText, { className: "w-4 h-4 text-sky-500" }, void 0, false, {
                        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                        lineNumber: 1847,
                        columnNumber: 27
                      }, this),
                      "Choose Template"
                    ] }, void 0, true, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 1846,
                      columnNumber: 25
                    }, this),
                    /* @__PURE__ */ jsxDEV(ChevronRight, { className: "w-4 h-4 text-zinc-400 group-hover:text-sky-500 transition-colors" }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 1850,
                      columnNumber: 25
                    }, this)
                  ]
                },
                void 0,
                true,
                {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 1841,
                  columnNumber: 23
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1823,
              columnNumber: 19
            }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2 p-2 mb-1 border-b border-zinc-100", children: [
                /* @__PURE__ */ jsxDEV(
                  "button",
                  {
                    onClick: () => setPrintMenuView("main"),
                    className: "p-1 hover:bg-zinc-100 rounded transition-colors",
                    children: /* @__PURE__ */ jsxDEV(ChevronLeft, { className: "w-4 h-4 text-zinc-500" }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 1860,
                      columnNumber: 27
                    }, this)
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1856,
                    columnNumber: 25
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-zinc-400 uppercase tracking-widest", children: "Select Template" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 1862,
                  columnNumber: 25
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1855,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "max-h-[300px] overflow-y-auto", children: templates.map(
                (t) => /* @__PURE__ */ jsxDEV(
                  "button",
                  {
                    onClick: () => {
                      handleSelectTemplate(t.id);
                      setPrintMenuView("main");
                    },
                    className: `block w-full text-left text-xs font-bold transition-colors ${selectedTemplateId === t.id ? "bg-sky-50 text-sky-600" : "text-zinc-700 hover:bg-sky-50/50"}`,
                    style: { padding: "10px 12px" },
                    children: [
                      t.template_name,
                      t.is_default && /* @__PURE__ */ jsxDEV("span", { className: "ml-2 text-[10px] text-zinc-400 font-normal italic", children: "(Default)" }, void 0, false, {
                        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                        lineNumber: 1876,
                        columnNumber: 46
                      }, this)
                    ]
                  },
                  t.id,
                  true,
                  {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1866,
                    columnNumber: 23
                  },
                  this
                )
              ) }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1864,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1854,
              columnNumber: 19
            }, this) }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1821,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 1800,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "relative", children: [
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                className: "inline-flex items-center gap-2 px-3 py-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all text-[13px] font-semibold",
                onClick: () => {
                  setShowActionsMenu(!showActionsMenu);
                  setShowPrintMenu(false);
                  setShowConvertMenu(false);
                  setShowTemplateMenu(false);
                },
                children: /* @__PURE__ */ jsxDEV(MoreHorizontal, { className: "w-[14px] h-[14px]" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 1896,
                  columnNumber: 17
                }, this)
              },
              void 0,
              false,
              {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1887,
                columnNumber: 15
              },
              this
            ),
            showActionsMenu && /* @__PURE__ */ jsxDEV("div", { className: "absolute left-0 top-full mt-1 z-50 min-w-[200px] bg-white border border-zinc-200 shadow-xl p-1 rounded-sm", children: [
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: () => {
                    setShowActionsMenu(false);
                    handleLaunchStockCheck();
                  },
                  disabled: launchingStockCheck,
                  className: "flex items-center gap-3 w-full text-left text-xs font-bold text-zinc-700 hover:bg-sky-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                  style: { padding: "12px" },
                  children: [
                    launchingStockCheck ? /* @__PURE__ */ jsxDEV(Loader2, { className: "w-4 h-4 text-sky-500 animate-spin" }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 1911,
                      columnNumber: 21
                    }, this) : /* @__PURE__ */ jsxDEV("span", { className: "text-base", children: "📦" }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 1913,
                      columnNumber: 21
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { children: [
                      /* @__PURE__ */ jsxDEV("div", { children: "Stock Check" }, void 0, false, {
                        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                        lineNumber: 1916,
                        columnNumber: 23
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "text-[10px] font-normal text-zinc-400", children: "Create procurement tracker" }, void 0, false, {
                        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                        lineNumber: 1917,
                        columnNumber: 23
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 1915,
                      columnNumber: 21
                    }, this)
                  ]
                },
                void 0,
                true,
                {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 1901,
                  columnNumber: 19
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: async () => {
                    setShowActionsMenu(false);
                    setLaunchingRevision(true);
                    try {
                      if (organisation?.id && quotationId) {
                        await initiateQuotationRevision(
                          organisation.id,
                          quotationId
                        );
                      }
                    } finally {
                      setLaunchingRevision(false);
                    }
                  },
                  disabled: launchingRevision,
                  className: "flex items-center gap-3 w-full text-left text-xs font-bold text-zinc-700 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                  style: { padding: "12px" },
                  children: [
                    launchingRevision ? /* @__PURE__ */ jsxDEV(Loader2, { className: "w-4 h-4 text-amber-500 animate-spin" }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 1940,
                      columnNumber: 21
                    }, this) : /* @__PURE__ */ jsxDEV("span", { className: "text-base", children: "📋" }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 1942,
                      columnNumber: 21
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { children: [
                      /* @__PURE__ */ jsxDEV("div", { children: "Request Revision" }, void 0, false, {
                        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                        lineNumber: 1945,
                        columnNumber: 23
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "text-[10px] font-normal text-zinc-400", children: "Flag for quotation revision" }, void 0, false, {
                        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                        lineNumber: 1946,
                        columnNumber: 23
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 1944,
                      columnNumber: 21
                    }, this)
                  ]
                },
                void 0,
                true,
                {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 1920,
                  columnNumber: 19
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1900,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 1886,
            columnNumber: 13
          }, this),
          isCancellable && /* @__PURE__ */ jsxDEV("button", { className: "inline-flex items-center gap-2 px-3 py-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-all text-[13px] font-semibold", onClick: handleCancel, children: [
            /* @__PURE__ */ jsxDEV(XCircle, { className: "w-[14px] h-[14px]" }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1955,
              columnNumber: 17
            }, this),
            "Cancel"
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 1954,
            columnNumber: 15
          }, this),
          isDeletable && /* @__PURE__ */ jsxDEV("button", { className: "inline-flex items-center gap-2 px-3 py-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-all text-[13px] font-semibold", onClick: handleDelete, children: [
            /* @__PURE__ */ jsxDEV(Trash2, { className: "w-[14px] h-[14px]" }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1962,
              columnNumber: 17
            }, this),
            "Delete"
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 1961,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 1764,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "space-y-6 bg-white border border-zinc-200 shadow-2xl min-h-[1120px] mb-12 rounded-none", style: { padding: "14px" }, children: [
          /* @__PURE__ */ jsxDEV("div", { className: "border-b border-zinc-100 pb-10", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-4 gap-x-8 mb-3", children: [
              /* @__PURE__ */ jsxDEV("h3", { className: "text-[11px] font-bold text-blue-600 uppercase tracking-[0.08em]", children: "Document" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1971,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("h3", { className: "text-[11px] font-bold text-blue-600 uppercase tracking-[0.08em]", children: "Terms" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1972,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("h3", { className: "text-[11px] font-bold text-blue-600 uppercase tracking-[0.08em]", children: "Client" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1973,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("h3", { className: "text-[11px] font-bold text-blue-600 uppercase tracking-[0.08em]", children: "Project & Shipping" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1974,
                columnNumber: 17
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1970,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "border-t border-blue-200 mb-6" }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1976,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-4 gap-x-8", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "space-y-3", children: [
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("dt", { className: "text-[11px] text-zinc-400", children: "Quotation No" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1980,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("dd", { className: "text-[13px] font-bold text-zinc-900 mt-0.5", children: quotation.quotation_no || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1981,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 1979,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("dt", { className: "text-[11px] text-zinc-400", children: "Date" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1984,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("dd", { className: "text-[13px] font-bold text-zinc-900 mt-0.5", children: formatDate(quotation.date) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1985,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 1983,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("dt", { className: "text-[11px] text-zinc-400", children: "Valid Till" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1988,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("dd", { className: "text-[13px] font-bold text-zinc-900 mt-0.5", children: formatDate(quotation.valid_till) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1989,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 1987,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("dt", { className: "text-[11px] text-zinc-400", children: "Revision No" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1992,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("dd", { className: "text-[13px] font-bold text-zinc-900 mt-0.5", children: quotation.revision_no || "00" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1993,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 1991,
                  columnNumber: 19
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1978,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "space-y-3", children: [
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("dt", { className: "text-[11px] text-zinc-400", children: "Payment Terms" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1998,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("dd", { className: "text-[13px] font-bold text-zinc-900 mt-0.5", children: quotation.payment_terms || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 1999,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 1997,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("dt", { className: "text-[11px] text-zinc-400", children: "Reference" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2002,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("dd", { className: "text-[13px] font-bold text-zinc-900 mt-0.5", children: quotation.reference || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2003,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2001,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("dt", { className: "text-[11px] text-zinc-400", children: "Prepared By" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2006,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("dd", { className: "text-[13px] font-bold text-zinc-900 mt-0.5", children: quotation.prepared_by || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2007,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2005,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("dt", { className: "text-[11px] text-zinc-400", children: "Remarks" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2010,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("dd", { className: "text-[13px] font-bold text-zinc-900 mt-0.5 truncate max-w-[200px]", title: quotation.remarks || quotation.reference || "-", children: quotation.remarks || quotation.reference || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2011,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2009,
                  columnNumber: 19
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 1996,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "space-y-3", children: [
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("dt", { className: "text-[11px] text-zinc-400", children: "Name" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2016,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("dd", { className: "text-[13px] font-bold text-zinc-900 mt-0.5", children: quotation.client?.client_name || quotation.client?.name || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2017,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2015,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("dt", { className: "text-[11px] text-zinc-400", children: "Contact No" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2020,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("dd", { className: "text-[13px] font-bold text-zinc-900 mt-0.5", children: quotation.contact_no || quotation.client?.phone || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2021,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2019,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("dt", { className: "text-[11px] text-zinc-400", children: "GSTIN" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2024,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("dd", { className: "text-[13px] font-bold text-zinc-900 mt-0.5", children: quotation.gstin || quotation.client?.gstin || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2025,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2023,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("dt", { className: "text-[11px] text-zinc-400", children: "State" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2028,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("dd", { className: "text-[13px] font-bold text-zinc-900 mt-0.5", children: quotation.state || quotation.client?.state || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2029,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2027,
                  columnNumber: 19
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2014,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "space-y-3", children: [
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("dt", { className: "text-[11px] text-zinc-400", children: "Project" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2034,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("dd", { className: "text-[13px] font-bold text-zinc-900 mt-0.5", children: quotation.project?.project_name || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2035,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2033,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("dt", { className: "text-[11px] text-zinc-400", children: "Billing Address" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2038,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("dd", { className: "text-[13px] text-zinc-600 mt-0.5 leading-snug line-clamp-2", children: quotation.billing_address || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2039,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2037,
                  columnNumber: 19
                }, this),
                quotation.shipping_address && quotation.shipping_address !== quotation.billing_address && /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("dt", { className: "text-[11px] text-zinc-400", children: "Shipping Address" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2043,
                    columnNumber: 23
                  }, this),
                  /* @__PURE__ */ jsxDEV("dd", { className: "text-[13px] text-zinc-600 mt-0.5 leading-snug line-clamp-2", children: quotation.shipping_address }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2044,
                    columnNumber: 23
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2042,
                  columnNumber: 21
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2032,
                columnNumber: 17
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 1977,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 1969,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-bold text-zinc-900 mb-6", children: "Line Items" }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2052,
              columnNumber: 15
            }, this),
            !quotation.items || quotation.items.length === 0 ? /* @__PURE__ */ jsxDEV("div", { className: "text-center py-12 text-zinc-500", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "text-lg font-medium mb-2", children: "No line items found" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2055,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "text-sm", children: "This quotation may not have any items saved yet." }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2056,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2054,
              columnNumber: 17
            }, this) : /* @__PURE__ */ jsxDEV("div", { className: "overflow-x-auto -mx-12", children: /* @__PURE__ */ jsxDEV("table", { className: "min-w-full border border-zinc-200", children: [
              /* @__PURE__ */ jsxDEV("thead", { className: "bg-zinc-100", children: /* @__PURE__ */ jsxDEV("tr", { className: "border-b border-zinc-200", children: [
                templates.find((t) => t.id === selectedTemplateId)?.column_settings?.optional?.sno !== false && /* @__PURE__ */ jsxDEV("th", { className: "border-r border-zinc-200", style: { padding: "16px 12px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-zinc-500 uppercase tracking-wider block", children: "#" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2064,
                  columnNumber: 99
                }, this) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2064,
                  columnNumber: 25
                }, this),
                quotation.items?.some((i) => i.sac_code || i.hsn_code || i.item?.hsn_code) && /* @__PURE__ */ jsxDEV("th", { className: "border-r border-zinc-200", style: { padding: "16px 12px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-zinc-500 uppercase tracking-wider block", children: "HSN/SAC" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2067,
                  columnNumber: 99
                }, this) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2067,
                  columnNumber: 25
                }, this),
                quotation.items?.some((i) => i.item?.item_code) && /* @__PURE__ */ jsxDEV("th", { className: "border-r border-zinc-200", style: { padding: "16px 12px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-zinc-500 uppercase tracking-wider block", children: "Part No" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2070,
                  columnNumber: 99
                }, this) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2070,
                  columnNumber: 25
                }, this),
                quotation.items?.some((i) => i.make) && /* @__PURE__ */ jsxDEV("th", { className: "border-r border-zinc-200", style: { padding: "16px 12px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-zinc-500 uppercase tracking-wider block", children: "Make" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2073,
                  columnNumber: 99
                }, this) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2073,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("th", { className: "border-r border-zinc-200", style: { padding: "16px 12px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-zinc-500 uppercase tracking-wider block", children: "Description" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2075,
                  columnNumber: 97
                }, this) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2075,
                  columnNumber: 23
                }, this),
                quotation.items?.some((i) => i.variant_id) && /* @__PURE__ */ jsxDEV("th", { className: "border-r border-zinc-200", style: { padding: "16px 12px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-zinc-500 uppercase tracking-wider block", children: "Discount Category" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2077,
                  columnNumber: 99
                }, this) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2077,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("th", { className: "border-r border-zinc-200", style: { padding: "16px 12px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-right", children: "Qty" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2079,
                  columnNumber: 97
                }, this) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2079,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("th", { className: "border-r border-zinc-200", style: { padding: "16px 12px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-zinc-500 uppercase tracking-wider block", children: "Unit" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2080,
                  columnNumber: 97
                }, this) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2080,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("th", { className: "border-r border-zinc-200", style: { padding: "16px 12px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-right", children: "Rate" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2081,
                  columnNumber: 97
                }, this) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2081,
                  columnNumber: 23
                }, this),
                quotation.items?.some((i) => i.discount_percent > 0) && /* @__PURE__ */ jsxDEV("th", { className: "border-r border-zinc-200", style: { padding: "16px 12px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-right", children: "Disc %" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2084,
                  columnNumber: 99
                }, this) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2084,
                  columnNumber: 25
                }, this),
                quotation.items?.some((i) => i.tax_percent > 0) && /* @__PURE__ */ jsxDEV("th", { className: "border-r border-zinc-200", style: { padding: "16px 12px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-right", children: "Tax %" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2087,
                  columnNumber: 99
                }, this) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2087,
                  columnNumber: 25
                }, this),
                quotation.items?.some((i) => i.custom1) && /* @__PURE__ */ jsxDEV("th", { className: "border-r border-zinc-200", style: { padding: "16px 12px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-zinc-500 uppercase tracking-wider block", children: templates.find((t) => t.id === selectedTemplateId)?.column_settings?.labels?.custom1 || "Custom 1" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2090,
                  columnNumber: 99
                }, this) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2090,
                  columnNumber: 25
                }, this),
                quotation.items?.some((i) => i.custom2) && /* @__PURE__ */ jsxDEV("th", { className: "border-r border-zinc-200", style: { padding: "16px 12px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-zinc-500 uppercase tracking-wider block", children: templates.find((t) => t.id === selectedTemplateId)?.column_settings?.labels?.custom2 || "Custom 2" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2093,
                  columnNumber: 99
                }, this) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2093,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("th", { className: "border-r border-zinc-200", style: { padding: "16px 12px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-right", children: "Total" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2095,
                  columnNumber: 97
                }, this) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2095,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2062,
                columnNumber: 21
              }, this) }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2061,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("tbody", { className: "bg-white", children: quotation.items?.map((item, index) => {
                const template = templates.find((t) => t.id === selectedTemplateId);
                const optCols = template?.column_settings?.optional || {};
                const hasHSN = quotation.items?.some((i) => i.sac_code || i.hsn_code || i.item?.hsn_code);
                const hasItemCode = quotation.items?.some((i) => i.item?.item_code);
                const hasMake = quotation.items?.some((i) => i.make);
                const hasVariant = quotation.items?.some((i) => i.variant_id);
                const hasDiscount = quotation.items?.some((i) => i.discount_percent > 0);
                const hasTax = quotation.items?.some((i) => i.tax_percent > 0);
                const hasCustom1 = quotation.items?.some((i) => i.custom1);
                const hasCustom2 = quotation.items?.some((i) => i.custom2);
                if (item.is_header) {
                  let colCount = 0;
                  if (optCols.sno !== false) colCount++;
                  if (hasHSN) colCount++;
                  if (hasItemCode) colCount++;
                  if (hasMake) colCount++;
                  colCount++;
                  if (hasVariant) colCount++;
                  colCount += 3;
                  if (hasDiscount) colCount++;
                  if (hasTax) colCount++;
                  if (hasCustom1) colCount++;
                  if (hasCustom2) colCount++;
                  colCount++;
                  return /* @__PURE__ */ jsxDEV("tr", { style: { background: "#f8fafc" }, children: /* @__PURE__ */ jsxDEV("td", { colSpan: colCount, style: { padding: "10px 14px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[13px] font-bold text-zinc-800", children: item.description || "Section" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2129,
                    columnNumber: 31
                  }, this) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2128,
                    columnNumber: 29
                  }, this) }, item.id, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2127,
                    columnNumber: 29
                  }, this);
                }
                if (item.is_subtotal) {
                  let subtotalAmount = 0;
                  for (let i = index - 1; i >= 0; i--) {
                    const prev = quotation.items[i];
                    if (prev.is_subtotal || prev.is_header) break;
                    subtotalAmount += parseFloat(prev.line_total) || 0;
                  }
                  let colCount = 0;
                  if (optCols.sno !== false) colCount++;
                  if (hasHSN) colCount++;
                  if (hasItemCode) colCount++;
                  if (hasMake) colCount++;
                  colCount++;
                  if (hasVariant) colCount++;
                  colCount += 3;
                  if (hasDiscount) colCount++;
                  if (hasTax) colCount++;
                  if (hasCustom1) colCount++;
                  if (hasCustom2) colCount++;
                  colCount++;
                  return /* @__PURE__ */ jsxDEV("tr", { style: { background: "#fef9c3", borderTop: "2px solid #eab308" }, children: /* @__PURE__ */ jsxDEV("td", { colSpan: colCount, style: { padding: "10px 14px" }, children: /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", justifyContent: "flex-end", width: "100%", gap: "16px" }, children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "text-[13px] font-bold text-amber-700", style: { textAlign: "right" }, children: item.subtotal_label || "Sub-total:" }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 2159,
                      columnNumber: 33
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "text-[13px] font-bold text-amber-700", style: { minWidth: "100px", textAlign: "right" }, children: formatCurrency(subtotalAmount) }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 2160,
                      columnNumber: 33
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2158,
                    columnNumber: 31
                  }, this) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2157,
                    columnNumber: 29
                  }, this) }, item.id, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2156,
                    columnNumber: 29
                  }, this);
                }
                return /* @__PURE__ */ jsxDEV("tr", { className: "border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors align-top", children: [
                  optCols.sno !== false && /* @__PURE__ */ jsxDEV("td", { className: "border-r border-zinc-100", style: { padding: "14px 7px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[11px] text-zinc-400 font-medium block", children: String(index + 1).padStart(2, "0") }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2169,
                    columnNumber: 126
                  }, this) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2169,
                    columnNumber: 53
                  }, this),
                  hasHSN && /* @__PURE__ */ jsxDEV("td", { className: "border-r border-zinc-100", style: { padding: "14px 7px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] text-zinc-500 font-mono block", children: item.sac_code || item.hsn_code || item.item?.hsn_code || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2170,
                    columnNumber: 111
                  }, this) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2170,
                    columnNumber: 38
                  }, this),
                  hasItemCode && /* @__PURE__ */ jsxDEV("td", { className: "border-r border-zinc-100", style: { padding: "14px 7px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] text-zinc-500 block", children: item.item?.item_code || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2171,
                    columnNumber: 116
                  }, this) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2171,
                    columnNumber: 43
                  }, this),
                  hasMake && /* @__PURE__ */ jsxDEV("td", { className: "border-r border-zinc-100", style: { padding: "14px 7px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] text-zinc-400 italic block", children: item.make || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2172,
                    columnNumber: 112
                  }, this) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2172,
                    columnNumber: 39
                  }, this),
                  /* @__PURE__ */ jsxDEV("td", { className: "border-r border-zinc-100", style: { padding: "14px 7px" }, children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "text-[12px] font-medium text-zinc-900 leading-tight", children: item.item?.display_name || item.item?.name || "-" }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 2174,
                      columnNumber: 29
                    }, this),
                    item.description && item.description !== (item.item?.display_name || item.item?.name) && /* @__PURE__ */ jsxDEV("div", { className: "text-[11px] text-zinc-500 leading-snug mt-1", children: item.description }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 2176,
                      columnNumber: 31
                    }, this),
                    item.override_flag && /* @__PURE__ */ jsxDEV("span", { className: "inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100", children: "Modified" }, void 0, false, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 2179,
                      columnNumber: 31
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2173,
                    columnNumber: 27
                  }, this),
                  hasVariant && /* @__PURE__ */ jsxDEV("td", { className: "border-r border-zinc-100", style: { padding: "14px 7px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[11px] text-zinc-500 block", children: allVariants.find((v) => v.id === item.variant_id)?.variant_name || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2184,
                    columnNumber: 31
                  }, this) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2183,
                    columnNumber: 29
                  }, this),
                  /* @__PURE__ */ jsxDEV("td", { className: "border-r border-zinc-100", style: { padding: "14px 7px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[11px] text-zinc-900 text-right font-medium block", children: item.qty }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2187,
                    columnNumber: 100
                  }, this) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2187,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("td", { style: { padding: "14px 7px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] text-zinc-400 block", children: item.uom }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2188,
                    columnNumber: 63
                  }, this) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2188,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("td", { className: "border-l border-zinc-100", style: { padding: "14px 7px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[11px] text-zinc-900 text-right block", children: formatCurrency(item.rate) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2189,
                    columnNumber: 100
                  }, this) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2189,
                    columnNumber: 27
                  }, this),
                  hasDiscount && /* @__PURE__ */ jsxDEV("td", { style: { padding: "14px 7px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] text-red-500 text-right font-medium block", children: [
                    item.discount_percent,
                    "%"
                  ] }, void 0, true, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2191,
                    columnNumber: 79
                  }, this) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2191,
                    columnNumber: 43
                  }, this),
                  hasTax && /* @__PURE__ */ jsxDEV("td", { style: { padding: "14px 7px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] text-zinc-500 text-right block", children: [
                    item.tax_percent,
                    "%"
                  ] }, void 0, true, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2192,
                    columnNumber: 74
                  }, this) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2192,
                    columnNumber: 38
                  }, this),
                  hasCustom1 && /* @__PURE__ */ jsxDEV("td", { style: { padding: "14px 7px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] text-zinc-500 block", children: item.custom1 || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2193,
                    columnNumber: 78
                  }, this) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2193,
                    columnNumber: 42
                  }, this),
                  hasCustom2 && /* @__PURE__ */ jsxDEV("td", { style: { padding: "14px 7px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] text-zinc-500 block", children: item.custom2 || "-" }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2194,
                    columnNumber: 78
                  }, this) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2194,
                    columnNumber: 42
                  }, this),
                  /* @__PURE__ */ jsxDEV("td", { className: "bg-zinc-50", style: { padding: "14px 7px" }, children: /* @__PURE__ */ jsxDEV("span", { className: "text-[11px] font-bold text-zinc-900 text-right block", children: formatCurrency(item.line_total) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2195,
                    columnNumber: 86
                  }, this) }, void 0, false, {
                    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                    lineNumber: 2195,
                    columnNumber: 27
                  }, this)
                ] }, item.id, true, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2168,
                  columnNumber: 27
                }, this);
              }) }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2098,
                columnNumber: 20
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2060,
              columnNumber: 19
            }, this) }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2059,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 2051,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "flex justify-end pt-12 border-t border-zinc-100", children: /* @__PURE__ */ jsxDEV("div", { className: "w-full max-w-sm space-y-4", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between text-[13px] text-zinc-500", children: [
              /* @__PURE__ */ jsxDEV("span", { children: "Subtotal" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2208,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-zinc-900", children: formatCurrency(quotation.subtotal) }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2209,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2207,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between text-[13px] text-zinc-500", children: [
              /* @__PURE__ */ jsxDEV("span", { children: "Total Item Discount" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2212,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "text-red-500 font-bold", children: [
                "- ",
                formatCurrency(quotation.total_item_discount)
              ] }, void 0, true, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2213,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2211,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between text-[13px] text-zinc-500", children: [
              /* @__PURE__ */ jsxDEV("span", { children: [
                "Extra Discount (",
                quotation.extra_discount_percent,
                "%)"
              ] }, void 0, true, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2216,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "text-red-500 font-bold", children: [
                "- ",
                formatCurrency(quotation.extra_discount_amount)
              ] }, void 0, true, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2217,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2215,
              columnNumber: 17
            }, this),
            quotation.state && (organisation?.state || "Maharashtra") && quotation.state.trim().toLowerCase() !== (organisation?.state || "Maharashtra").trim().toLowerCase() ? /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between text-[13px] text-zinc-500", children: [
              /* @__PURE__ */ jsxDEV("span", { children: "IGST" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2223,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-zinc-900", children: formatCurrency(quotation.total_tax) }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2224,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2222,
              columnNumber: 19
            }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between text-[13px] text-zinc-500", children: [
                /* @__PURE__ */ jsxDEV("span", { children: "CGST" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2229,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-zinc-900", children: formatCurrency(quotation.total_tax / 2) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2230,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2228,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between text-[13px] text-zinc-500", children: [
                /* @__PURE__ */ jsxDEV("span", { children: "SGST" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2233,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-zinc-900", children: formatCurrency(quotation.total_tax / 2) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2234,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2232,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2227,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between text-[13px] text-zinc-500", children: [
              /* @__PURE__ */ jsxDEV("span", { children: "Round Off" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2240,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-zinc-900", children: formatCurrency(quotation.round_off) }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2241,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2239,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "pt-4 border-t-2 border-zinc-900 flex justify-between items-center", children: [
              /* @__PURE__ */ jsxDEV("span", { className: "text-[15px] font-bold text-zinc-900 uppercase", children: "Grand Total" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2245,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "text-2xl font-black text-zinc-900", children: formatCurrency(quotation.grand_total) }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2246,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2244,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 2206,
            columnNumber: 15
          }, this) }, void 0, false, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 2205,
            columnNumber: 13
          }, this),
          termsConditionsQuery.data?.custom_content && /* @__PURE__ */ jsxDEV("div", { className: "mt-8 border-t border-zinc-200 pt-8", children: [
            /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-bold text-zinc-900 mb-4", children: "Terms & Conditions" }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2254,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "bg-zinc-50 rounded-lg p-6", children: (() => {
              try {
                const termsData = typeof termsConditionsQuery.data.custom_content === "string" ? JSON.parse(termsConditionsQuery.data.custom_content) : termsConditionsQuery.data.custom_content;
                if (termsData && termsData.sections) {
                  return termsData.sections.map(
                    (section, sectionIndex) => /* @__PURE__ */ jsxDEV("div", { className: "mb-4 last:mb-0", children: [
                      /* @__PURE__ */ jsxDEV("h4", { className: "text-sm font-semibold text-zinc-900 mb-2", children: [
                        sectionIndex + 1,
                        ". ",
                        section.title
                      ] }, void 0, true, {
                        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                        lineNumber: 2265,
                        columnNumber: 27
                      }, this),
                      section.items && section.items.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "space-y-1", children: section.items.map(
                        (item, itemIndex) => /* @__PURE__ */ jsxDEV("div", { className: "text-sm text-zinc-600 flex items-start", children: [
                          /* @__PURE__ */ jsxDEV("span", { className: "mr-2 text-zinc-400", children: item.item_type === "bullet" ? "•" : `${itemIndex + 1}.` }, void 0, false, {
                            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                            lineNumber: 2272,
                            columnNumber: 35
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { children: item.content }, void 0, false, {
                            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                            lineNumber: 2275,
                            columnNumber: 35
                          }, this)
                        ] }, itemIndex, true, {
                          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                          lineNumber: 2271,
                          columnNumber: 29
                        }, this)
                      ) }, void 0, false, {
                        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                        lineNumber: 2269,
                        columnNumber: 27
                      }, this)
                    ] }, sectionIndex, true, {
                      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                      lineNumber: 2264,
                      columnNumber: 25
                    }, this)
                  );
                }
              } catch (error) {
                return /* @__PURE__ */ jsxDEV("div", { className: "text-sm text-zinc-600 whitespace-pre-line", children: String(termsConditionsQuery.data.custom_content) }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2286,
                  columnNumber: 25
                }, this);
              }
              return null;
            })() }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2255,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 2253,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 1968,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 1738,
        columnNumber: 9
      }, this) }, void 0, false, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 1737,
        columnNumber: 7
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
      lineNumber: 1678,
      columnNumber: 5
    }, this),
    previewModalOpen && /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-white rounded-lg w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between px-6 py-4 border-b bg-zinc-50 rounded-t-lg", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-4", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "font-semibold text-zinc-800 text-lg", children: [
            "Preview - ",
            quotation?.quotation_no || "Quotation"
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 2308,
            columnNumber: 15
          }, this),
          previewLoading && /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2 text-sm text-zinc-500", children: [
            /* @__PURE__ */ jsxDEV(Loader2, { className: "w-4 h-4 animate-spin" }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2313,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("span", { children: "Loading..." }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2314,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 2312,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 2307,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => {
                setPreviewModalOpen(false);
                navigate(`/quotation/edit?id=${quotationId}`);
              },
              className: "flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors",
              children: [
                /* @__PURE__ */ jsxDEV(Edit, { className: "w-4 h-4" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2327,
                  columnNumber: 17
                }, this),
                "Edit"
              ]
            },
            void 0,
            true,
            {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2320,
              columnNumber: 15
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: downloadFromPreview,
              disabled: previewLoading,
              className: "flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsxDEV(Download, { className: "w-4 h-4" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2337,
                  columnNumber: 17
                }, this),
                "PDF"
              ]
            },
            void 0,
            true,
            {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2332,
              columnNumber: 15
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: printFromPreview,
              disabled: previewLoading,
              className: "flex items-center gap-2 px-4 py-2 text-sm bg-zinc-600 text-white rounded hover:bg-zinc-700 transition-colors disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsxDEV(Printer, { className: "w-4 h-4" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2347,
                  columnNumber: 17
                }, this),
                "Print"
              ]
            },
            void 0,
            true,
            {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2342,
              columnNumber: 15
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => setPreviewModalOpen(false),
              className: "p-2 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-colors",
              children: /* @__PURE__ */ jsxDEV(XCircle, { className: "w-5 h-5" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2356,
                columnNumber: 17
              }, this)
            },
            void 0,
            false,
            {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2352,
              columnNumber: 15
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 2318,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 2306,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex-1 overflow-auto bg-zinc-100 p-4", children: previewLoading ? /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-center h-full min-h-[400px]", children: /* @__PURE__ */ jsxDEV("div", { className: "text-center", children: [
        /* @__PURE__ */ jsxDEV(Loader2, { className: "w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" }, void 0, false, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 2366,
          columnNumber: 19
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-zinc-500", children: "Generating preview..." }, void 0, false, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 2367,
          columnNumber: 19
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 2365,
        columnNumber: 17
      }, this) }, void 0, false, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 2364,
        columnNumber: 13
      }, this) : /* @__PURE__ */ jsxDEV(
        "div",
        {
          id: "preview-modal-content",
          className: "bg-white mx-auto shadow-lg",
          style: { width: "210mm", minHeight: "297mm" },
          dangerouslySetInnerHTML: { __html: DOMPurify.sanitize(previewHTML) }
        },
        void 0,
        false,
        {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 2371,
          columnNumber: 13
        },
        this
      ) }, void 0, false, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 2362,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
      lineNumber: 2304,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
      lineNumber: 2303,
      columnNumber: 7
    }, this),
    showPdfPreviewModal && /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-white rounded-lg w-full max-w-[210mm] h-[90vh] flex flex-col shadow-2xl overflow-hidden", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center px-4 py-2 bg-zinc-100 border-b border-zinc-200 select-none shrink-0 justify-between", style: { gap: "4px" }, children: [
        /* @__PURE__ */ jsxDEV("span", { style: { fontSize: "12px", fontWeight: 500, color: "#6b7280" }, children: quotation?.quotation_no || "Quotation" }, void 0, false, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 2389,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center", style: { gap: "6px" }, children: [
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => {
                setShowPdfPreviewModal(false);
                navigate(`/quotation/edit?id=${quotationId}`);
              },
              style: {
                padding: "7px 16px",
                background: "transparent",
                border: "1px solid #185FA5",
                color: "#185FA5",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                transition: "all 0.15s"
              },
              onMouseEnter: (e) => {
                e.currentTarget.style.background = "#f0f5ff";
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.background = "transparent";
              },
              children: [
                /* @__PURE__ */ jsxDEV(Edit, { className: "w-[14px] h-[14px]" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2410,
                  columnNumber: 19
                }, this),
                " Edit"
              ]
            },
            void 0,
            true,
            {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2391,
              columnNumber: 17
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: async () => {
                if (!pdfPreviewUrl) return;
                try {
                  if (navigator.share) {
                    const response = await fetch(pdfPreviewUrl);
                    const blob = await response.blob();
                    const file = new File([blob], `${quotation?.quotation_no || "quotation"}.pdf`, { type: "application/pdf" });
                    await navigator.share({ files: [file], title: quotation?.quotation_no || "Quotation" });
                  } else {
                    await navigator.clipboard.writeText(window.location.href);
                  }
                } catch (e) {
                  if (e.name !== "AbortError") {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                    } catch {
                    }
                  }
                }
              },
              style: {
                padding: "7px 16px",
                background: "transparent",
                border: "1px solid #d1d5db",
                color: "#374151",
                fontSize: "12px",
                fontWeight: 500,
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                transition: "all 0.15s"
              },
              onMouseEnter: (e) => {
                e.currentTarget.style.background = "#f9fafb";
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.background = "transparent";
              },
              children: [
                /* @__PURE__ */ jsxDEV(Share2, { className: "w-[14px] h-[14px]" }, void 0, false, {
                  fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                  lineNumber: 2447,
                  columnNumber: 17
                }, this),
                " Share"
              ]
            },
            void 0,
            true,
            {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2412,
              columnNumber: 17
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => {
                setShowPdfPreviewModal(false);
                if (pdfPreviewUrl) {
                  URL.revokeObjectURL(pdfPreviewUrl);
                  setPdfPreviewUrl(null);
                }
              },
              style: {
                padding: "6px",
                background: "transparent",
                border: "none",
                color: "#9ca3af",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                transition: "all 0.15s"
              },
              onMouseEnter: (e) => {
                e.currentTarget.style.color = "#374151";
                e.currentTarget.style.background = "#e5e7eb";
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.color = "#9ca3af";
                e.currentTarget.style.background = "transparent";
              },
              children: /* @__PURE__ */ jsxDEV(XCircle, { className: "w-[18px] h-[18px]" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2465,
                columnNumber: 17
              }, this)
            },
            void 0,
            false,
            {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2449,
              columnNumber: 15
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 2390,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 2388,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex-1 bg-zinc-900 min-h-0", children: pdfPreviewUrl ? /* @__PURE__ */ jsxDEV("iframe", { src: pdfPreviewUrl, className: "w-full h-full", style: { border: "none" }, title: "PDF Preview" }, void 0, false, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 2473,
        columnNumber: 13
      }, this) : /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-center h-full", children: /* @__PURE__ */ jsxDEV(Loader2, { className: "w-8 h-8 animate-spin text-zinc-400" }, void 0, false, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 2475,
        columnNumber: 70
      }, this) }, void 0, false, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 2475,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 2471,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
      lineNumber: 2386,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
      lineNumber: 2385,
      columnNumber: 7
    }, this),
    showStockCheckModal && /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 z-[2000] bg-black/45 flex items-center justify-center", onClick: () => setShowStockCheckModal(false), children: /* @__PURE__ */ jsxDEV("div", { className: "bg-white rounded-lg shadow-2xl w-[420px] max-h-[80vh] overflow-auto", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsxDEV("div", { className: "p-6 border-b border-zinc-100", children: [
        /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-bold text-zinc-900", children: "Launch Stock Check" }, void 0, false, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 2487,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-zinc-500 mt-1", children: "Create a procurement tracker from this quotation's line items." }, void 0, false, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 2488,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 2486,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "p-6", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "bg-zinc-50 border border-zinc-200 rounded p-4 mb-4", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3 mb-2", children: [
          /* @__PURE__ */ jsxDEV("span", { className: "text-2xl", children: "📦" }, void 0, false, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 2493,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("div", { className: "text-sm font-bold text-zinc-900", children: quotation.quotation_no || "Quotation" }, void 0, false, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2495,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "text-xs text-zinc-500", children: [
              (quotation.items || []).filter((i) => !i.is_header).length,
              " line items will be imported"
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2496,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 2494,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 2492,
          columnNumber: 15
        }, this) }, void 0, false, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 2491,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "text-xs text-zinc-400 space-y-1", children: [
          /* @__PURE__ */ jsxDEV("p", { children: "• BOQ quantities will be copied as required quantities" }, void 0, false, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 2501,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("p", { children: "• Stock & local quantities start at 0" }, void 0, false, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 2502,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("p", { children: "• You'll be taken to the procurement tracker to fill gaps" }, void 0, false, {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 2503,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
          lineNumber: 2500,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 2490,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "p-6 border-t border-zinc-100 flex gap-3 justify-end", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => setShowStockCheckModal(false),
            className: "px-4 py-2 text-sm font-bold text-zinc-700 bg-white border border-zinc-300 rounded hover:bg-zinc-50 transition-colors",
            children: "Cancel"
          },
          void 0,
          false,
          {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 2507,
            columnNumber: 13
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: handleLaunchStockCheck,
            disabled: launchingStockCheck || !(quotation.items || []).some((i) => !i.is_header),
            className: "px-4 py-2 text-sm font-bold text-white bg-green-600 rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2",
            children: launchingStockCheck ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV(Loader2, { className: "w-4 h-4 animate-spin" }, void 0, false, {
                fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
                lineNumber: 2520,
                columnNumber: 19
              }, this),
              "Creating..."
            ] }, void 0, true, {
              fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
              lineNumber: 2519,
              columnNumber: 15
            }, this) : "Launch Stock Check"
          },
          void 0,
          false,
          {
            fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
            lineNumber: 2513,
            columnNumber: 13
          },
          this
        )
      ] }, void 0, true, {
        fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
        lineNumber: 2506,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
      lineNumber: 2485,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
      lineNumber: 2484,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx",
    lineNumber: 1677,
    columnNumber: 5
  }, this);
}
_s(QuotationView, "XMBEPzrqlkynOB/2BXJbP20sZ54=", false, function() {
  return [useNavigate, useSearchParams, useAuth, useQuery, useQuery, useQuery, useQuery, useVariants];
});
_c = QuotationView;
var _c;
$RefreshReg$(_c, "QuotationView");
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
function $RefreshReg$(type, id) {
  return RefreshRuntime.register(type, "C:/Users/admin/mep-project/apps/web/src/pages/QuotationView.tsx " + id);
}
function $RefreshSig$() {
  return RefreshRuntime.createSignatureFunctionForTransform();
}

//# sourceMappingURL=data:application/json;base64,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QUFBQSxhQXFCQTtBQUFBLFNBMUNGO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0EyQ0EsS0E1Q0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQTZDQTtBQUFBLE9BcDFCRjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBczFCQTtBQUVKO0FBQUN4QixHQXA4RXVCRCxlQUFhO0FBQUEsVUFDbEJ6QyxhQUNNQyxpQkFFUUssU0ErQ1JSLFVBc0JBQSxVQXNCTUEsVUFpQkxBLFVBaUJXcUMsV0FBVztBQUFBO0FBQUEsS0FqSXhCTTtBQUFhLElBQUF1ZjtBQUFBLGFBQUFBLElBQUEiLCJuYW1lcyI6WyJ1c2VTdGF0ZSIsInVzZUVmZmVjdCIsInVzZVJlZiIsIkRPTVB1cmlmeSIsInVzZVF1ZXJ5Iiwic3VwYWJhc2UiLCJ1c2VOYXZpZ2F0ZSIsInVzZVNlYXJjaFBhcmFtcyIsImpzUERGIiwiYXV0b1RhYmxlIiwiZm9ybWF0RGF0ZSIsImZvcm1hdEN1cnJlbmN5IiwidXNlQXV0aCIsImdlbmVyYXRlUXVvdGF0aW9uUGRmIiwicmVuZGVyVGVtcGxhdGVUb1BkZiIsImdlbmVyYXRlQ2xhc3NpY1F1b3RhdGlvblRlbXBsYXRlIiwiZ2VuZXJhdGVQcm9HcmlkUXVvdGF0aW9uUGRmIiwiZ2VuZXJhdGVTYWt0aGlQZGYiLCJnZW5lcmF0ZVpvaG9UZW1wbGF0ZSIsInRpbWVkU3VwYWJhc2VRdWVyeSIsIlNhYVNUZW1wbGF0ZSIsIlZlcnRpY2FsVGVtcGxhdGUiLCJodG1sVG9QZGYiLCJjcmVhdGVSb290IiwiZmx1c2hTeW5jIiwiUHJpbnRlciIsIkVkaXQiLCJDb3B5IiwiTW9yZUhvcml6b250YWwiLCJUcmFzaDIiLCJYQ2lyY2xlIiwiQ2hlY2tDaXJjbGUiLCJDaGV2cm9uRG93biIsIkNoZXZyb25SaWdodCIsIkNoZXZyb25MZWZ0IiwiRG93bmxvYWQiLCJFeWUiLCJGaWxlVGV4dCIsIlBsdXMiLCJMb2FkZXIyIiwiU2hhcmUyIiwidXNlVmFyaWFudHMiLCJBcHByb3ZhbEFQSSIsImluaXRpYXRlUXVvdGF0aW9uUmV2aXNpb24iLCJSZXNpemFibGVQYW5lbEdyb3VwIiwiUmVzaXphYmxlUGFuZWwiLCJSZXNpemFibGVIYW5kbGUiLCJRdW90YXRpb25WaWV3IiwiX3MiLCJuYXZpZ2F0ZSIsInNlYXJjaFBhcmFtcyIsInF1b3RhdGlvbklkIiwiZ2V0Iiwib3JnYW5pc2F0aW9uIiwidXNlciIsImlzRW1iZWQiLCJlbWJlZFBkZlVybCIsInNldEVtYmVkUGRmVXJsIiwiZW1iZWRMb2FkaW5nIiwic2V0RW1iZWRMb2FkaW5nIiwiZW1iZWRFcnJvciIsInNldEVtYmVkRXJyb3IiLCJzaG93Q29udmVydE1lbnUiLCJzZXRTaG93Q29udmVydE1lbnUiLCJzaG93UHJpbnRNZW51Iiwic2V0U2hvd1ByaW50TWVudSIsInNob3dUZW1wbGF0ZU1lbnUiLCJzZXRTaG93VGVtcGxhdGVNZW51Iiwic2hvd0FjdGlvbnNNZW51Iiwic2V0U2hvd0FjdGlvbnNNZW51Iiwic2hvd1N0b2NrQ2hlY2tNb2RhbCIsInNldFNob3dTdG9ja0NoZWNrTW9kYWwiLCJsYXVuY2hpbmdTdG9ja0NoZWNrIiwic2V0TGF1bmNoaW5nU3RvY2tDaGVjayIsImxhdW5jaGluZ1JldmlzaW9uIiwic2V0TGF1bmNoaW5nUmV2aXNpb24iLCJzZWxlY3RlZFRlbXBsYXRlSWQiLCJzZXRTZWxlY3RlZFRlbXBsYXRlSWQiLCJwcmludE1lbnVWaWV3Iiwic2V0UHJpbnRNZW51VmlldyIsInByaW50TG9hZGluZyIsInNldFByaW50TG9hZGluZyIsInByaW50TWVudVJlZiIsImhhbmRsZUNsaWNrT3V0c2lkZSIsImV2ZW50IiwiY3VycmVudCIsImNvbnRhaW5zIiwidGFyZ2V0IiwiZG9jdW1lbnQiLCJhZGRFdmVudExpc3RlbmVyIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsInByZXZpZXdNb2RhbE9wZW4iLCJzZXRQcmV2aWV3TW9kYWxPcGVuIiwicHJldmlld0hUTUwiLCJzZXRQcmV2aWV3SFRNTCIsInByZXZpZXdMb2FkaW5nIiwic2V0UHJldmlld0xvYWRpbmciLCJwcmV2aWV3VGVtcGxhdGUiLCJzZXRQcmV2aWV3VGVtcGxhdGUiLCJwZGZQcmV2aWV3VXJsIiwic2V0UGRmUHJldmlld1VybCIsInNob3dQZGZQcmV2aWV3TW9kYWwiLCJzZXRTaG93UGRmUHJldmlld01vZGFsIiwicXVvdGF0aW9uUXVlcnkiLCJxdWVyeUtleSIsImlkIiwicXVlcnlGbiIsInF1ZXJ5IiwiZnJvbSIsInNlbGVjdCIsImVxIiwic2luZ2xlIiwiZGF0YSIsImVuYWJsZWQiLCJ0ZW1wbGF0ZXNRdWVyeSIsIm9yZGVyIiwiYXNjZW5kaW5nIiwic3RhbGVUaW1lIiwicXVvdGF0aW9uIiwidGVtcGxhdGVzIiwibG9hZGluZyIsImlzUGVuZGluZyIsInRlcm1zQ29uZGl0aW9uc1F1ZXJ5IiwibWF5YmVTaW5nbGUiLCJxdW90YXRpb25zUXVlcnkiLCJxdW90YXRpb25zIiwiYWxsVmFyaWFudHMiLCJ0ZW1wbGF0ZV9pZCIsImlzRXJyb3IiLCJjb25zb2xlIiwiZXJyb3IiLCJnZW5lcmF0ZUVtYmVkUGRmIiwidGVtcGxhdGUiLCJmaW5kIiwidCIsImlzX2RlZmF1bHQiLCJsaW1pdCIsIkVycm9yIiwibG9nIiwidGVtcGxhdGVfbmFtZSIsImJsb2IiLCJkb3dubG9hZFBERiIsIkJsb2IiLCJ1cmwiLCJVUkwiLCJjcmVhdGVPYmplY3RVUkwiLCJlcnIiLCJtZXNzYWdlIiwicmV2b2tlT2JqZWN0VVJMIiwiaGFuZGxlRWRpdCIsImhhbmRsZUR1cGxpY2F0ZSIsImV4aXN0aW5nIiwicXVvdGF0aW9uTm8iLCJsZW5ndGgiLCJsYXN0TnVtIiwicGFyc2VJbnQiLCJxdW90YXRpb25fbm8iLCJyZXBsYWNlIiwiU3RyaW5nIiwicGFkU3RhcnQiLCJuZXdRdW90YXRpb24iLCJjbGllbnRfaWQiLCJwcm9qZWN0X2lkIiwiYmlsbGluZ19hZGRyZXNzIiwiZ3N0aW4iLCJzdGF0ZSIsImRhdGUiLCJEYXRlIiwidG9JU09TdHJpbmciLCJzcGxpdCIsInZhbGlkX3RpbGwiLCJwYXltZW50X3Rlcm1zIiwiY29udGFjdF9ubyIsInJlbWFya3MiLCJyZWZlcmVuY2UiLCJzdWJ0b3RhbCIsInRvdGFsX2l0ZW1fZGlzY291bnQiLCJleHRyYV9kaXNjb3VudF9wZXJjZW50IiwiZXh0cmFfZGlzY291bnRfYW1vdW50IiwidG90YWxfdGF4Iiwicm91bmRfb2ZmIiwiZ3JhbmRfdG90YWwiLCJzdGF0dXMiLCJuZWdvdGlhdGlvbl9tb2RlIiwicmV2aXNlZF9mcm9tX2lkIiwiaW5zZXJ0IiwiaXRlbXMiLCJpdGVtc1RvSW5zZXJ0IiwibWFwIiwiaXRlbSIsInF1b3RhdGlvbl9pZCIsIml0ZW1faWQiLCJ2YXJpYW50X2lkIiwiZGVzY3JpcHRpb24iLCJxdHkiLCJ1b20iLCJyYXRlIiwib3JpZ2luYWxfZGlzY291bnRfcGVyY2VudCIsImRpc2NvdW50X3BlcmNlbnQiLCJkaXNjb3VudF9hbW91bnQiLCJ0YXhfcGVyY2VudCIsInRheF9hbW91bnQiLCJsaW5lX3RvdGFsIiwib3ZlcnJpZGVfZmxhZyIsImFsZXJ0IiwiaGFuZGxlQ29udmVydCIsInR5cGUiLCJoYW5kbGVDYW5jZWwiLCJjb25maXJtIiwidXBkYXRlIiwicmVmZXRjaCIsImhhbmRsZURlbGV0ZSIsImhhbmRsZUFwcHJvdmFsQWN0aW9uIiwiYWN0aW9uIiwicmVzIiwicHJvY2Vzc0FwcHJvdmFsIiwiYXBwcm92YWxfaWQiLCJjb21tZW50cyIsInN1Y2Nlc3MiLCJ0b0xvd2VyQ2FzZSIsImhhbmRsZURlbGV0ZVF1b3RhdGlvbiIsImRlbGV0ZSIsImhhbmRsZVNlbGVjdFRlbXBsYXRlIiwidGVtcGxhdGVJZCIsImhhbmRsZUxhdW5jaFN0b2NrQ2hlY2siLCJjbGllbnQiLCJwcm9qZWN0IiwibGlzdERhdGEiLCJsaXN0RXJyb3IiLCJvcmdhbmlzYXRpb25faWQiLCJ0aXRsZSIsInNvdXJjZSIsImNsaWVudF9uYW1lIiwibmFtZSIsInByb2plY3RfbmFtZSIsInJvd3MiLCJmaWx0ZXIiLCJpc19oZWFkZXIiLCJpbmRleCIsIm1hdGVyaWFsIiwiY2xpZW50SWQiLCJtYXBwaW5nIiwibWFwcGluZ3MiLCJtIiwibGlzdF9pZCIsIml0ZW1fbmFtZSIsImNsaWVudF9kZXNjcmlwdGlvbiIsImRpc3BsYXlfbmFtZSIsIm1ha2UiLCJ2YXJpYW50X25hbWUiLCJ2YXJpYW50IiwidW5pdCIsImJvcV9xdHkiLCJwYXJzZUZsb2F0Iiwic3RvY2tfcXR5IiwibG9jYWxfcXR5IiwidmVuZG9yX2lkIiwibm90ZXMiLCJkaXNwbGF5X29yZGVyIiwiaXNfaGVhZGVyX3JvdyIsImUiLCJoYW5kbGVQcmludEFjdGlvbiIsInByZXZpZXdRdW90YXRpb24iLCJnZW5lcmF0ZVByZXZpZXdIVE1MIiwidG1wbCIsImNvbHVtbl9zZXR0aW5ncyIsInByaW50Iiwic3R5bGUiLCJjb250YWluZXIiLCJjcmVhdGVFbGVtZW50Iiwid2lkdGgiLCJwb3NpdGlvbiIsImxlZnQiLCJ0b3AiLCJib2R5IiwiYXBwZW5kQ2hpbGQiLCJyb290IiwicXVvdGF0aW9uV2l0aFRlcm1zIiwidGVybXNfY29uZGl0aW9ucyIsImN1c3RvbV9jb250ZW50IiwicmVuZGVyIiwiUHJvbWlzZSIsInJlc29sdmUiLCJzZXRUaW1lb3V0IiwiaHRtbCIsImlubmVySFRNTCIsInJlbW92ZUNoaWxkIiwidGVtcGxhdGVfY29kZSIsImlzSW50ZXJTdGF0ZSIsInRyaW0iLCJzZWxlY3RlZFNpZ25hdG9yeSIsInNpZ25hdHVyZXMiLCJzIiwiYXV0aG9yaXplZF9zaWduYXRvcnlfaWQiLCJvcHRzIiwib3JnIiwiYWRkcmVzcyIsImNpdHkiLCJwaW5jb2RlIiwicGhvbmUiLCJlbWFpbCIsImxvZ29fdXJsIiwiaGVhZGVyIiwicmV2aXNpb25fbm8iLCJ1bmRlZmluZWQiLCJwcmVwYXJlZF9ieSIsInByb2plY3RfY29kZSIsImlzX3N1YnRvdGFsIiwic3VidG90YWxfbGFiZWwiLCJpdGVtX2NvZGUiLCJoc25fY29kZSIsInNhY19jb2RlIiwiYmFzZV9yYXRlX3NuYXBzaG90IiwiY3VzdG9tMSIsImN1c3RvbTIiLCJjYWxjdWxhdGlvbnMiLCJ0b3RhbEl0ZW1EaXNjb3VudCIsImV4dHJhRGlzY291bnRBbW91bnQiLCJjZ3N0Iiwic2dzdCIsImlnc3QiLCJ0b3RhbFRheCIsInJvdW5kT2ZmIiwiZ3JhbmRUb3RhbCIsImFtb3VudEluV29yZHMiLCJhbW91bnRfaW5fd29yZHMiLCJjb2x1bW5TZXR0aW5ncyIsInNpZ25hdG9yeSIsImRlc2lnbmF0aW9uIiwic2lnbmF0b3J5X2Rlc2lnbmF0aW9uIiwiZm9yX2NvbXBhbnkiLCJiYW5rRGV0YWlscyIsImJhbmtfbmFtZSIsImJyYW5jaCIsImJhbmtfYnJhbmNoIiwiYWNjb3VudF9uYW1lIiwiYmFua19hY2NvdW50X25hbWUiLCJhY2NvdW50X25vIiwiYmFua19hY2NvdW50X25vIiwiaWZzYyIsImJhbmtfaWZzYyIsImFjY291bnRfdHlwZSIsImJhbmtfYWNjb3VudF90eXBlIiwic3dpZnQiLCJiYW5rX3N3aWZ0IiwidGVybXNBbmRDb25kaXRpb25zIiwicmF3VGVybXMiLCJwYXJzZWRUZXJtcyIsInBhcnNlZCIsIkpTT04iLCJwYXJzZSIsImV4dHJhY3RTZWN0aW9ucyIsIm9iaiIsIkFycmF5IiwiaXNBcnJheSIsImZvckVhY2giLCJzZWN0aW9ucyIsInNlYyIsImNvbnRlbnQiLCJwdXNoIiwiZmluYWxUZXJtcyIsImNvbXBhbnlMb2dvQmFzZTY0IiwiZW50ZXJwcmlzZURvYyIsInBkZkJsb2IiLCJvdXRwdXQiLCJibG9iVXJsIiwiZ2VuZXJhdGVRdW90YXRpb25IVE1MIiwiZG93bmxvYWRGcm9tUHJldmlldyIsInNhZmVGaWxlTmFtZSIsImdldEVsZW1lbnRCeUlkIiwicHJpbnRGcm9tUHJldmlldyIsInByaW50Q29udGVudCIsInByaW50V2luZG93Iiwid2luZG93Iiwib3BlbiIsIndyaXRlIiwiY2xvc2UiLCJoYW5kbGVPdXRwdXQiLCJvbmxvYWQiLCJhIiwiaHJlZiIsImRvd25sb2FkIiwiY2xpY2siLCJ0ZW1wbGF0ZV90eXBlIiwiaHRtbERhdGEiLCJkb2N1bWVudF90eXBlIiwib3JnYW5pc2F0aW9uX25hbWUiLCJvcmdhbmlzYXRpb25fYWRkcmVzcyIsIm9yZ2FuaXNhdGlvbl9waG9uZSIsIm9yZ2FuaXNhdGlvbl9lbWFpbCIsIm9yZ2FuaXNhdGlvbl9nc3RpbiIsIm9yZ2FuaXNhdGlvbl9jaW4iLCJjaW4iLCJvcmdhbmlzYXRpb25fcGFuIiwicGFuIiwib3JnYW5pc2F0aW9uX2llX2NvZGUiLCJpZV9jb2RlIiwiY2xpZW50X2NvbnRhY3RfcGVyc29uIiwiY29udGFjdF9wZXJzb24iLCJjbGllbnRfYWRkcmVzcyIsImNsaWVudF9jaXR5IiwiY2xpZW50X3BpbmNvZGUiLCJjbGllbnRfZ3N0aW4iLCJjbGllbnRfcGhvbmUiLCJzaGlwcGluZ19jb21wYW55X25hbWUiLCJzaGlwcGluZ19hZGRyZXNzIiwic2hpcHBpbmdfY2l0eSIsInNoaXBwaW5nX3BpbmNvZGUiLCJzaGlwcGluZ19waG9uZSIsImlkeCIsImhzbiIsImNsaWVudF9wYXJ0X25vIiwiZ3N0X3BlcmNlbnQiLCJhbW91bnQiLCJjZ3N0X2Ftb3VudCIsInNnc3RfYW1vdW50IiwiYmFua19taWNyIiwiYmFua191cGkiLCJ0ZW1wbGF0ZV9jb250ZW50IiwiYmFja2dyb3VuZCIsInpJbmRleCIsInBvaW50ZXJFdmVudHMiLCJmb250TGluayIsInJlbCIsImhlYWQiLCJjYXB0dXJlRXJyIiwidW5tb3VudCIsInpvaG9Eb2MiLCJjbGFzc2ljRG9jIiwiZ3JpZERvYyIsInNha3RoaURvYyIsImlzTGFuZHNjYXBlIiwib3JpZW50YXRpb24iLCJkb2MiLCJmb3JtYXQiLCJwYWdlX3NpemUiLCJjb2xTZXR0aW5ncyIsIm9wdGlvbmFsQ29scyIsIm9wdGlvbmFsIiwibGFiZWxzIiwiY29sdW1uQ29uZmlnIiwic25vIiwia2V5IiwiYWxpZ24iLCJyYXRlX2FmdGVyX2Rpc2NvdW50Iiwic3RhcnRZIiwic2hvd19sb2dvIiwic2V0Rm9udFNpemUiLCJzZXRGb250IiwidGV4dCIsImFkZHJlc3NMaW5lcyIsInNwbGl0VGV4dFRvU2l6ZSIsInJpZ2h0Q29sIiwidGFibGVEYXRhIiwicm93IiwiYmFzZV9yYXRlIiwiZm9ybWF0Q3VycmVuY3lOb1N5bWJvbCIsInRhYmxlU3RhcnRZIiwiY29sIiwidGhlbWUiLCJoZWFkU3R5bGVzIiwiZmlsbENvbG9yIiwiZm9udFNpemUiLCJzdHlsZXMiLCJjZWxsUGFkZGluZyIsImNvbHVtblN0eWxlcyIsInJlZHVjZSIsImFjYyIsImhhbGlnbiIsImZpbmFsWSIsImxhc3RBdXRvVGFibGUiLCJzdW1tYXJ5WCIsIm9mZnNldCIsImdyYW5kVG90YWxPZmZzZXQiLCJyZW1hcmtzVGV4dCIsInNob3dfdGVybXMiLCJ0ZXJtc1N0YXJ0Iiwic2hvd19zaWduYXR1cmUiLCJzaWduU3RhcnQiLCJhZGRJbWFnZSIsIndhcm4iLCJjb2x1bW5zSFRNTCIsInJvd3NIVE1MIiwiY29sQ291bnQiLCJzdWJ0b3RhbEFtb3VudCIsImkiLCJwcmV2Iiwicm93SFRNTCIsImdldFN0YXR1c0JhZGdlIiwiY29sb3JzIiwiYmciLCJjb2xvciIsInBhZGRpbmciLCJib3JkZXJSYWRpdXMiLCJmb250V2VpZ2h0IiwiZ2V0U2VsZWN0ZWRUZW1wbGF0ZU5hbWUiLCJpc0VkaXRhYmxlIiwiaXNEZWxldGFibGUiLCJpc0NhbmNlbGxhYmxlIiwiY2FuQXBwcm92ZSIsInRleHRBbGlnbiIsIm1hcmdpbkJvdHRvbSIsInEiLCJwYWRkaW5nVG9wIiwicGFkZGluZ0JvdHRvbSIsInBhZGRpbmdMZWZ0IiwicGFkZGluZ1JpZ2h0IiwibWFyZ2luTGVmdCIsImdhcCIsImJhY2tncm91bmRDb2xvciIsImJvcmRlckNvbG9yIiwic29tZSIsIm9wdENvbHMiLCJoYXNIU04iLCJoYXNJdGVtQ29kZSIsImhhc01ha2UiLCJoYXNWYXJpYW50IiwiaGFzRGlzY291bnQiLCJoYXNUYXgiLCJoYXNDdXN0b20xIiwiaGFzQ3VzdG9tMiIsImJvcmRlclRvcCIsImRpc3BsYXkiLCJhbGlnbkl0ZW1zIiwianVzdGlmeUNvbnRlbnQiLCJtaW5XaWR0aCIsInYiLCJ0ZXJtc0RhdGEiLCJzZWN0aW9uIiwic2VjdGlvbkluZGV4IiwiaXRlbUluZGV4IiwiaXRlbV90eXBlIiwibWluSGVpZ2h0IiwiX19odG1sIiwic2FuaXRpemUiLCJib3JkZXIiLCJjdXJzb3IiLCJ0cmFuc2l0aW9uIiwiY3VycmVudFRhcmdldCIsIm5hdmlnYXRvciIsInNoYXJlIiwicmVzcG9uc2UiLCJmZXRjaCIsImZpbGUiLCJGaWxlIiwiZmlsZXMiLCJjbGlwYm9hcmQiLCJ3cml0ZVRleHQiLCJsb2NhdGlvbiIsInN0b3BQcm9wYWdhdGlvbiIsIl9jIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIlF1b3RhdGlvblZpZXcudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHVzZVN0YXRlLCB1c2VFZmZlY3QsIHVzZVJlZiB9IGZyb20gJ3JlYWN0JztcclxuaW1wb3J0IERPTVB1cmlmeSBmcm9tICdkb21wdXJpZnknO1xyXG5pbXBvcnQgeyB1c2VRdWVyeSB9IGZyb20gJ0B0YW5zdGFjay9yZWFjdC1xdWVyeSc7XHJcbmltcG9ydCB7IHN1cGFiYXNlIH0gZnJvbSAnLi4vc3VwYWJhc2UnO1xyXG5pbXBvcnQgeyB1c2VOYXZpZ2F0ZSwgdXNlU2VhcmNoUGFyYW1zIH0gZnJvbSAncmVhY3Qtcm91dGVyLWRvbSc7XHJcbmltcG9ydCB7IGpzUERGIH0gZnJvbSAnanNwZGYnO1xyXG5pbXBvcnQgYXV0b1RhYmxlIGZyb20gJ2pzcGRmLWF1dG90YWJsZSc7XHJcbmltcG9ydCB7IGZvcm1hdERhdGUsIGZvcm1hdEN1cnJlbmN5IH0gZnJvbSAnLi4vdXRpbHMvZm9ybWF0dGVycyc7XHJcbmltcG9ydCB7IHVzZUF1dGggfSBmcm9tICcuLi9BcHAnO1xyXG5pbXBvcnQgeyBnZW5lcmF0ZVF1b3RhdGlvblRhbGx5IH0gZnJvbSAnLi9RdW90YXRpb25UYWxseVRlbXBsYXRlJztcclxuaW1wb3J0IHsgZ2VuZXJhdGVQcm9mZXNzaW9uYWxUZW1wbGF0ZSB9IGZyb20gJy4vUHJvZmVzc2lvbmFsVGVtcGxhdGUnO1xyXG5pbXBvcnQgeyBnZW5lcmF0ZVF1b3RhdGlvblBkZiB9IGZyb20gJy4uL3BkZi9lbnRlcnByaXNlUXVvdGF0aW9uUGRmJztcclxuaW1wb3J0IHsgcmVuZGVyVGVtcGxhdGVUb1BkZiB9IGZyb20gJy4uL3V0aWxzL2h0bWxUZW1wbGF0ZVJlbmRlcmVyJztcclxuaW1wb3J0IHsgZ2VuZXJhdGVDbGFzc2ljUXVvdGF0aW9uVGVtcGxhdGUgfSBmcm9tICcuL0NsYXNzaWNRdW90YXRpb25UZW1wbGF0ZSc7XHJcbmltcG9ydCB7IGdlbmVyYXRlUHJvR3JpZFF1b3RhdGlvblBkZiB9IGZyb20gJy4uL3BkZi9wcm9HcmlkUXVvdGF0aW9uUGRmJztcclxuaW1wb3J0IHsgZ2VuZXJhdGVTYWt0aGlQZGYgfSBmcm9tICcuLi9wZGYvc2FrdGhpVGVtcGxhdGVQZGYnO1xyXG5pbXBvcnQgeyBnZW5lcmF0ZVpvaG9UZW1wbGF0ZSB9IGZyb20gJy4vWm9ob1RlbXBsYXRlJztcclxuaW1wb3J0IHsgZ2VuZXJhdGVHcmlkTWluaW1hbFF1b3RhdGlvblBkZkJsb2JXaXRoVGVybXMgfSBmcm9tICcuLi9wZGYvZ3JpZC1taW5pbWFsL3F1b3RhdGlvbi13aXRoLXRlcm1zJztcclxuaW1wb3J0IHsgdGltZWRTdXBhYmFzZVF1ZXJ5IH0gZnJvbSAnLi4vdXRpbHMvcXVlcnlUaW1lb3V0JztcclxuaW1wb3J0IFNhYVNUZW1wbGF0ZSBmcm9tICcuLi90ZW1wbGF0ZXMvU2FhU1RlbXBsYXRlJztcclxuaW1wb3J0IFZlcnRpY2FsVGVtcGxhdGUgZnJvbSAnLi4vdGVtcGxhdGVzL1ZlcnRpY2FsVGVtcGxhdGUnO1xyXG5pbXBvcnQgeyBodG1sVG9QZGYgfSBmcm9tICcuLi91dGlscy9odG1sVGVtcGxhdGVSZW5kZXJlcic7XHJcbmltcG9ydCB7IGNyZWF0ZVJvb3QgfSBmcm9tICdyZWFjdC1kb20vY2xpZW50JztcclxuaW1wb3J0IHsgZmx1c2hTeW5jIH0gZnJvbSAncmVhY3QtZG9tJztcclxuaW1wb3J0IHsgUHJpbnRlciwgRWRpdCwgQ29weSwgTW9yZUhvcml6b250YWwsIFRyYXNoMiwgWENpcmNsZSwgQ2hlY2tDaXJjbGUsIEFycm93TGVmdCwgQ2hldnJvbkRvd24sIENoZXZyb25SaWdodCwgQ2hldnJvbkxlZnQsIE1haWwsIERvd25sb2FkLCBFeWUsIEZpbGVUZXh0LCBQbHVzLCBMb2FkZXIyLCBSb3RhdGVDY3csIFNoYXJlMiB9IGZyb20gJ2x1Y2lkZS1yZWFjdCc7XHJcbmltcG9ydCB7IHVzZVZhcmlhbnRzIH0gZnJvbSAnLi4vaG9va3MvdXNlVmFyaWFudHMnO1xyXG5pbXBvcnQgeyBBcHByb3ZhbEFQSSB9IGZyb20gJy4uL2FwcHJvdmFscy9hcGknO1xyXG5pbXBvcnQgeyBpbml0aWF0ZVF1b3RhdGlvblJldmlzaW9uIH0gZnJvbSAnLi4vbGliL3F1b3RhdGlvbi13b3JrZmxvdyc7XHJcbmltcG9ydCB7IFJlc2l6YWJsZVBhbmVsR3JvdXAsIFJlc2l6YWJsZVBhbmVsLCBSZXNpemFibGVIYW5kbGUgfSBmcm9tICcuLi9jb21wb25lbnRzL3VpL3Jlc2l6YWJsZSc7XHJcblxyXG5cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIFF1b3RhdGlvblZpZXcoKSB7XHJcbiAgY29uc3QgbmF2aWdhdGUgPSB1c2VOYXZpZ2F0ZSgpO1xyXG4gIGNvbnN0IFtzZWFyY2hQYXJhbXNdID0gdXNlU2VhcmNoUGFyYW1zKCk7XHJcbiAgY29uc3QgcXVvdGF0aW9uSWQgPSBzZWFyY2hQYXJhbXMuZ2V0KCdpZCcpO1xyXG4gIGNvbnN0IHsgb3JnYW5pc2F0aW9uLCB1c2VyIH0gPSB1c2VBdXRoKCk7XHJcbiAgXHJcbiAgY29uc3QgaXNFbWJlZCA9IHNlYXJjaFBhcmFtcy5nZXQoJ2VtYmVkJykgPT09ICd0cnVlJztcclxuICBjb25zdCBbZW1iZWRQZGZVcmwsIHNldEVtYmVkUGRmVXJsXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpO1xyXG4gIGNvbnN0IFtlbWJlZExvYWRpbmcsIHNldEVtYmVkTG9hZGluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW2VtYmVkRXJyb3IsIHNldEVtYmVkRXJyb3JdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbCk7XHJcblxyXG4gIGNvbnN0IFtzaG93Q29udmVydE1lbnUsIHNldFNob3dDb252ZXJ0TWVudV0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW3Nob3dQcmludE1lbnUsIHNldFNob3dQcmludE1lbnVdID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0IFtzaG93VGVtcGxhdGVNZW51LCBzZXRTaG93VGVtcGxhdGVNZW51XSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbc2hvd0FjdGlvbnNNZW51LCBzZXRTaG93QWN0aW9uc01lbnVdID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0IFtzaG93U3RvY2tDaGVja01vZGFsLCBzZXRTaG93U3RvY2tDaGVja01vZGFsXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbbGF1bmNoaW5nU3RvY2tDaGVjaywgc2V0TGF1bmNoaW5nU3RvY2tDaGVja10gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW2xhdW5jaGluZ1JldmlzaW9uLCBzZXRMYXVuY2hpbmdSZXZpc2lvbl0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW3NlbGVjdGVkVGVtcGxhdGVJZCwgc2V0U2VsZWN0ZWRUZW1wbGF0ZUlkXSA9IHVzZVN0YXRlKG51bGwpO1xyXG4gIGNvbnN0IFtwcmludE1lbnVWaWV3LCBzZXRQcmludE1lbnVWaWV3XSA9IHVzZVN0YXRlKCdtYWluJyk7IC8vICdtYWluJyBvciAndGVtcGxhdGVzJ1xyXG4gIGNvbnN0IFtwcmludExvYWRpbmcsIHNldFByaW50TG9hZGluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgXHJcbiAgLy8gUHJpbnQgZHJvcGRvd24gcmVmIGZvciBjbGljayBvdXRzaWRlXHJcbiAgY29uc3QgcHJpbnRNZW51UmVmID0gdXNlUmVmPEhUTUxEaXZFbGVtZW50PihudWxsKTtcclxuXHJcbiAgLy8gQ2xvc2UgZHJvcGRvd25zIHdoZW4gY2xpY2tpbmcgb3V0c2lkZVxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBjb25zdCBoYW5kbGVDbGlja091dHNpZGUgPSAoZXZlbnQ6IE1vdXNlRXZlbnQpID0+IHtcclxuICAgICAgaWYgKHByaW50TWVudVJlZi5jdXJyZW50ICYmICFwcmludE1lbnVSZWYuY3VycmVudC5jb250YWlucyhldmVudC50YXJnZXQgYXMgTm9kZSkpIHtcclxuICAgICAgICBzZXRTaG93UHJpbnRNZW51KGZhbHNlKTtcclxuICAgICAgICBzZXRTaG93Q29udmVydE1lbnUoZmFsc2UpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgaWYgKHNob3dQcmludE1lbnUgfHwgc2hvd0NvbnZlcnRNZW51IHx8IHNob3dBY3Rpb25zTWVudSkge1xyXG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBoYW5kbGVDbGlja091dHNpZGUpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgaGFuZGxlQ2xpY2tPdXRzaWRlKTtcclxuICAgIH07XHJcbiAgfSwgW3Nob3dQcmludE1lbnUsIHNob3dDb252ZXJ0TWVudV0pO1xyXG4gIFxyXG4gIC8vIFByZXZpZXcgbW9kYWwgc3RhdGVcclxuICBjb25zdCBbcHJldmlld01vZGFsT3Blbiwgc2V0UHJldmlld01vZGFsT3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW3ByZXZpZXdIVE1MLCBzZXRQcmV2aWV3SFRNTF0gPSB1c2VTdGF0ZSgnJyk7XHJcbiAgY29uc3QgW3ByZXZpZXdMb2FkaW5nLCBzZXRQcmV2aWV3TG9hZGluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW3ByZXZpZXdUZW1wbGF0ZSwgc2V0UHJldmlld1RlbXBsYXRlXSA9IHVzZVN0YXRlKG51bGwpO1xyXG5cclxuICAvLyBQREYgUHJldmlldyBtb2RhbCBzdGF0ZVxyXG4gIGNvbnN0IFtwZGZQcmV2aWV3VXJsLCBzZXRQZGZQcmV2aWV3VXJsXSA9IHVzZVN0YXRlKG51bGwpO1xyXG4gIGNvbnN0IFtzaG93UGRmUHJldmlld01vZGFsLCBzZXRTaG93UGRmUHJldmlld01vZGFsXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBcclxuICBjb25zdCBxdW90YXRpb25RdWVyeSA9IHVzZVF1ZXJ5KHtcclxuICAgIHF1ZXJ5S2V5OiBbJ3F1b3RhdGlvbicsIHF1b3RhdGlvbklkLCBvcmdhbmlzYXRpb24/LmlkXSxcclxuICAgIHF1ZXJ5Rm46IGFzeW5jICgpID0+IHtcclxuICAgICAgaWYgKCFxdW90YXRpb25JZCkgcmV0dXJuIG51bGw7XHJcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gc3VwYWJhc2VcclxuICAgICAgICAuZnJvbSgncXVvdGF0aW9uX2hlYWRlcicpXHJcbiAgICAgICAgLnNlbGVjdChgXHJcbiAgICAgICAgICAqLFxyXG4gICAgICAgICAgY2xpZW50OmNsaWVudHMoKiksXHJcbiAgICAgICAgICBwcm9qZWN0OnByb2plY3RzKGlkLCBwcm9qZWN0X25hbWUsIHByb2plY3RfY29kZSksXHJcbiAgICAgICAgICBpdGVtczpxdW90YXRpb25faXRlbXMoKiwgaXRlbTptYXRlcmlhbHMoaWQsIGl0ZW1fY29kZSwgZGlzcGxheV9uYW1lLCBuYW1lLCBoc25fY29kZSkpXHJcbiAgICAgICAgYClcclxuICAgICAgICAuZXEoJ2lkJywgcXVvdGF0aW9uSWQpXHJcbiAgICAgICAgLmVxKCdvcmdhbmlzYXRpb25faWQnLCBvcmdhbmlzYXRpb24/LmlkIHx8ICcwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAnKVxyXG4gICAgICAgIC5zaW5nbGUoKTtcclxuXHJcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aW1lZFN1cGFiYXNlUXVlcnkocXVlcnksICdRdW90YXRpb24gdmlldycpO1xyXG4gICAgICByZXR1cm4gZGF0YTtcclxuICAgIH0sXHJcbiAgICBlbmFibGVkOiAhIXF1b3RhdGlvbklkICYmICEhb3JnYW5pc2F0aW9uPy5pZCxcclxuICB9KTtcclxuXHJcbiAgY29uc3QgdGVtcGxhdGVzUXVlcnkgPSB1c2VRdWVyeSh7XHJcbiAgICBxdWVyeUtleTogWydkb2N1bWVudFRlbXBsYXRlcycsICdRdW90YXRpb24nXSxcclxuICAgIHF1ZXJ5Rm46IGFzeW5jICgpID0+IHtcclxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHRpbWVkU3VwYWJhc2VRdWVyeShcclxuICAgICAgICBzdXBhYmFzZVxyXG4gICAgICAgICAgLmZyb20oJ2RvY3VtZW50X3RlbXBsYXRlcycpXHJcbiAgICAgICAgICAuc2VsZWN0KCcqJylcclxuICAgICAgICAgIC5lcSgnZG9jdW1lbnRfdHlwZScsICdRdW90YXRpb24nKVxyXG4gICAgICAgICAgLmVxKCdhY3RpdmUnLCB0cnVlKVxyXG4gICAgICAgICAgLm9yZGVyKCdpc19kZWZhdWx0JywgeyBhc2NlbmRpbmc6IGZhbHNlIH0pLFxyXG4gICAgICAgICdRdW90YXRpb24gdGVtcGxhdGVzJyxcclxuICAgICAgKTtcclxuICAgICAgcmV0dXJuIGRhdGEgfHwgW107XHJcbiAgICB9LFxyXG4gICAgc3RhbGVUaW1lOiAxMCAqIDYwICogMTAwMFxyXG4gIH0pO1xyXG5cclxuICBjb25zdCBxdW90YXRpb24gPSBxdW90YXRpb25RdWVyeS5kYXRhO1xyXG4gIGNvbnN0IHRlbXBsYXRlcyA9IHRlbXBsYXRlc1F1ZXJ5LmRhdGEgfHwgW107XHJcbiAgY29uc3QgbG9hZGluZyA9IHF1b3RhdGlvblF1ZXJ5LmlzUGVuZGluZztcclxuXHJcbiAgLy8gU2VwYXJhdGUgcXVlcnkgZm9yIFRlcm1zICYgQ29uZGl0aW9uc1xyXG4gIGNvbnN0IHRlcm1zQ29uZGl0aW9uc1F1ZXJ5ID0gdXNlUXVlcnkoe1xyXG4gICAgcXVlcnlLZXk6IFsncXVvdGF0aW9uLXRlcm1zJywgcXVvdGF0aW9uSWRdLFxyXG4gICAgcXVlcnlGbjogYXN5bmMgKCkgPT4ge1xyXG4gICAgICBpZiAoIXF1b3RhdGlvbklkKSByZXR1cm4gbnVsbDtcclxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHRpbWVkU3VwYWJhc2VRdWVyeShcclxuICAgICAgICBzdXBhYmFzZVxyXG4gICAgICAgICAgLmZyb20oJ3F1b3RhdGlvbl90ZXJtc19jb25kaXRpb25zJylcclxuICAgICAgICAgIC5zZWxlY3QoJyonKVxyXG4gICAgICAgICAgLmVxKCdxdW90YXRpb25faWQnLCBxdW90YXRpb25JZClcclxuICAgICAgICAgIC5tYXliZVNpbmdsZSgpLFxyXG4gICAgICAgICdRdW90YXRpb24gdGVybXMgY29uZGl0aW9ucycsXHJcbiAgICAgICk7XHJcbiAgICAgIHJldHVybiBkYXRhO1xyXG4gICAgfSxcclxuICAgIGVuYWJsZWQ6ICEhcXVvdGF0aW9uSWRcclxuICB9KTtcclxuXHJcbiAgY29uc3QgcXVvdGF0aW9uc1F1ZXJ5ID0gdXNlUXVlcnkoe1xyXG4gICAgcXVlcnlLZXk6IFsncXVvdGF0aW9ucycsIG9yZ2FuaXNhdGlvbj8uaWRdLFxyXG4gICAgcXVlcnlGbjogYXN5bmMgKCkgPT4ge1xyXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgdGltZWRTdXBhYmFzZVF1ZXJ5KFxyXG4gICAgICAgIHN1cGFiYXNlXHJcbiAgICAgICAgICAuZnJvbSgncXVvdGF0aW9uX2hlYWRlcicpXHJcbiAgICAgICAgICAuc2VsZWN0KGAqLCBjbGllbnQ6Y2xpZW50cyhpZCwgY2xpZW50X25hbWUsIGdzdGluLCBzdGF0ZSksIHByb2plY3Q6cHJvamVjdHMoaWQsIHByb2plY3RfbmFtZSlgKVxyXG4gICAgICAgICAgLmVxKCdvcmdhbmlzYXRpb25faWQnLCBvcmdhbmlzYXRpb24/LmlkKVxyXG4gICAgICAgICAgLm9yZGVyKCdjcmVhdGVkX2F0JywgeyBhc2NlbmRpbmc6IGZhbHNlIH0pLFxyXG4gICAgICAgICdRdW90YXRpb24gbGlzdCBzaWRlYmFyJ1xyXG4gICAgICApO1xyXG4gICAgICByZXR1cm4gZGF0YSB8fCBbXTtcclxuICAgIH0sXHJcbiAgICBlbmFibGVkOiAhIW9yZ2FuaXNhdGlvbj8uaWRcclxuICB9KTtcclxuXHJcbiAgY29uc3QgcXVvdGF0aW9ucyA9IHF1b3RhdGlvbnNRdWVyeS5kYXRhIHx8IFtdO1xyXG4gIGNvbnN0IHsgZGF0YTogYWxsVmFyaWFudHMgPSBbXSB9ID0gdXNlVmFyaWFudHMoKTtcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmIChxdW90YXRpb24/LnRlbXBsYXRlX2lkKSB7XHJcbiAgICAgIHNldFNlbGVjdGVkVGVtcGxhdGVJZChxdW90YXRpb24udGVtcGxhdGVfaWQpO1xyXG4gICAgfVxyXG4gIH0sIFtxdW90YXRpb24/LnRlbXBsYXRlX2lkXSk7XHJcblxyXG5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKHRlbXBsYXRlc1F1ZXJ5LmlzRXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgbG9hZGluZyB0ZW1wbGF0ZXM6JywgdGVtcGxhdGVzUXVlcnkuZXJyb3IpO1xyXG4gICAgfVxyXG4gIH0sIFt0ZW1wbGF0ZXNRdWVyeS5pc0Vycm9yLCB0ZW1wbGF0ZXNRdWVyeS5lcnJvcl0pO1xyXG5cclxuICBjb25zdCBnZW5lcmF0ZUVtYmVkUGRmID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgc2V0RW1iZWRMb2FkaW5nKHRydWUpO1xyXG4gICAgICBzZXRFbWJlZEVycm9yKG51bGwpO1xyXG5cclxuICAgICAgY29uc3QgdGVtcGxhdGVzID0gdGVtcGxhdGVzUXVlcnkuZGF0YSB8fCBbXTtcclxuICAgICAgLy8gUHJpb3JpdGl6ZSB0aGUgZGVmYXVsdCB0ZW1wbGF0ZSBmcm9tIFRlbXBsYXRlIFNldHRpbmdzXHJcbiAgICAgIGxldCB0ZW1wbGF0ZSA9IHRlbXBsYXRlcy5maW5kKHQgPT4gdC5pc19kZWZhdWx0KTtcclxuXHJcbiAgICAgIGlmICghdGVtcGxhdGUpIHtcclxuICAgICAgICAvLyBGZXRjaCBkZWZhdWx0IG1hbnVhbGx5XHJcbiAgICAgICAgY29uc3QgeyBkYXRhIH0gPSBhd2FpdCBzdXBhYmFzZVxyXG4gICAgICAgICAgLmZyb20oJ2RvY3VtZW50X3RlbXBsYXRlcycpXHJcbiAgICAgICAgICAuc2VsZWN0KCcqJylcclxuICAgICAgICAgIC5lcSgnZG9jdW1lbnRfdHlwZScsICdRdW90YXRpb24nKVxyXG4gICAgICAgICAgLmVxKCdpc19kZWZhdWx0JywgdHJ1ZSlcclxuICAgICAgICAgIC5tYXliZVNpbmdsZSgpO1xyXG4gICAgICAgIGlmIChkYXRhKSB7XHJcbiAgICAgICAgICB0ZW1wbGF0ZSA9IGRhdGE7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBGYWxsYmFjazogSWYgbm8gZGVmYXVsdCB0ZW1wbGF0ZSBleGlzdHMsIHRyeSB0aGUgdGVtcGxhdGUgZnJvbSB0aGUgcXVvdGF0aW9uXHJcbiAgICAgIGlmICghdGVtcGxhdGUgJiYgcXVvdGF0aW9uPy50ZW1wbGF0ZV9pZCkge1xyXG4gICAgICAgIHRlbXBsYXRlID0gdGVtcGxhdGVzLmZpbmQodCA9PiB0LmlkID09PSBxdW90YXRpb24udGVtcGxhdGVfaWQpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBGYWxsYmFjazogSWYgc3RpbGwgbm8gdGVtcGxhdGUsIGdldCB0aGUgZmlyc3QgYWN0aXZlIHRlbXBsYXRlXHJcbiAgICAgIGlmICghdGVtcGxhdGUpIHtcclxuICAgICAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlc1swXTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gRmFsbGJhY2s6IEZldGNoIGFueSBxdW90YXRpb24gdGVtcGxhdGUgbWFudWFsbHlcclxuICAgICAgaWYgKCF0ZW1wbGF0ZSkge1xyXG4gICAgICAgIGNvbnN0IHsgZGF0YSB9ID0gYXdhaXQgc3VwYWJhc2VcclxuICAgICAgICAgIC5mcm9tKCdkb2N1bWVudF90ZW1wbGF0ZXMnKVxyXG4gICAgICAgICAgLnNlbGVjdCgnKicpXHJcbiAgICAgICAgICAuZXEoJ2RvY3VtZW50X3R5cGUnLCAnUXVvdGF0aW9uJylcclxuICAgICAgICAgIC5saW1pdCgxKVxyXG4gICAgICAgICAgLm1heWJlU2luZ2xlKCk7XHJcbiAgICAgICAgdGVtcGxhdGUgPSBkYXRhO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoIXRlbXBsYXRlKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyB0ZW1wbGF0ZSBmb3VuZC4gUGxlYXNlIHNldCB1cCBhIHRlbXBsYXRlLicpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zb2xlLmxvZygn8J+ThCBFbWJlZCBtb2RlIGdlbmVyYXRpbmcgUERGIHdpdGggdGVtcGxhdGU6JywgdGVtcGxhdGUudGVtcGxhdGVfbmFtZSk7XHJcbiAgICAgIGNvbnN0IGJsb2IgPSBhd2FpdCBkb3dubG9hZFBERih0ZW1wbGF0ZSwgJ2Jsb2InKTtcclxuICAgICAgaWYgKGJsb2IgaW5zdGFuY2VvZiBCbG9iKSB7XHJcbiAgICAgICAgY29uc3QgdXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcclxuICAgICAgICBzZXRFbWJlZFBkZlVybCh1cmwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUERGIGdlbmVyYXRpb24gZGlkIG5vdCByZXR1cm4gYSB2YWxpZCBCbG9iLicpO1xyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZW5lcmF0aW5nIGVtYmVkIFBERjonLCBlcnIpO1xyXG4gICAgICBzZXRFbWJlZEVycm9yKGVycj8ubWVzc2FnZSB8fCAnRmFpbGVkIHRvIGdlbmVyYXRlIHF1b3RhdGlvbiBQREYnKTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIHNldEVtYmVkTG9hZGluZyhmYWxzZSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmIChpc0VtYmVkICYmIHF1b3RhdGlvbiAmJiBvcmdhbmlzYXRpb24gJiYgdGVtcGxhdGVzUXVlcnkuZGF0YSAmJiAhdGVybXNDb25kaXRpb25zUXVlcnkuaXNQZW5kaW5nICYmICFlbWJlZFBkZlVybCAmJiAhZW1iZWRMb2FkaW5nICYmICFlbWJlZEVycm9yKSB7XHJcbiAgICAgIGdlbmVyYXRlRW1iZWRQZGYoKTtcclxuICAgIH1cclxuICB9LCBbaXNFbWJlZCwgcXVvdGF0aW9uLCBvcmdhbmlzYXRpb24sIHRlbXBsYXRlc1F1ZXJ5LmRhdGEsIHRlcm1zQ29uZGl0aW9uc1F1ZXJ5LmlzUGVuZGluZ10pO1xyXG5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgaWYgKGVtYmVkUGRmVXJsKSB7XHJcbiAgICAgICAgVVJMLnJldm9rZU9iamVjdFVSTChlbWJlZFBkZlVybCk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgfSwgW2VtYmVkUGRmVXJsXSk7XHJcblxyXG4gIGNvbnN0IGhhbmRsZUVkaXQgPSAoKSA9PiB7XHJcbiAgICBuYXZpZ2F0ZShgL3F1b3RhdGlvbi9lZGl0P2lkPSR7cXVvdGF0aW9uSWR9YCk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgaGFuZGxlRHVwbGljYXRlID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKCFxdW90YXRpb24pIHJldHVybjtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHsgZGF0YTogZXhpc3RpbmcgfSA9IGF3YWl0IHN1cGFiYXNlXHJcbiAgICAgICAgLmZyb20oJ3F1b3RhdGlvbl9oZWFkZXInKVxyXG4gICAgICAgIC5zZWxlY3QoJ3F1b3RhdGlvbl9ubycpXHJcbiAgICAgICAgLm9yZGVyKCdjcmVhdGVkX2F0JywgeyBhc2NlbmRpbmc6IGZhbHNlIH0pXHJcbiAgICAgICAgLmxpbWl0KDEpO1xyXG5cclxuICAgICAgbGV0IHF1b3RhdGlvbk5vID0gJ1FULTAwMDEnO1xyXG4gICAgICBpZiAoZXhpc3RpbmcgJiYgZXhpc3RpbmcubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IGxhc3ROdW0gPSBwYXJzZUludChleGlzdGluZ1swXS5xdW90YXRpb25fbm8ucmVwbGFjZSgvW14wLTldL2csICcnKSk7XHJcbiAgICAgICAgcXVvdGF0aW9uTm8gPSBgUVQtJHtTdHJpbmcobGFzdE51bSArIDEpLnBhZFN0YXJ0KDQsICcwJyl9YDtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgbmV3UXVvdGF0aW9uID0ge1xyXG4gICAgICAgIHF1b3RhdGlvbl9ubzogcXVvdGF0aW9uTm8sXHJcbiAgICAgICAgY2xpZW50X2lkOiBxdW90YXRpb24uY2xpZW50X2lkLFxyXG4gICAgICAgIHByb2plY3RfaWQ6IHF1b3RhdGlvbi5wcm9qZWN0X2lkLFxyXG4gICAgICAgIGJpbGxpbmdfYWRkcmVzczogcXVvdGF0aW9uLmJpbGxpbmdfYWRkcmVzcyxcclxuICAgICAgICBnc3RpbjogcXVvdGF0aW9uLmdzdGluLFxyXG4gICAgICAgIHN0YXRlOiBxdW90YXRpb24uc3RhdGUsXHJcbiAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNwbGl0KCdUJylbMF0sXHJcbiAgICAgICAgdmFsaWRfdGlsbDogcXVvdGF0aW9uLnZhbGlkX3RpbGwsXHJcbiAgICAgICAgcGF5bWVudF90ZXJtczogcXVvdGF0aW9uLnBheW1lbnRfdGVybXMsXHJcbiAgICAgICAgY29udGFjdF9ubzogcXVvdGF0aW9uLmNvbnRhY3Rfbm8gfHwgbnVsbCxcclxuICAgICAgICByZW1hcmtzOiBxdW90YXRpb24ucmVtYXJrcyB8fCBxdW90YXRpb24ucmVmZXJlbmNlIHx8IG51bGwsXHJcbiAgICAgICAgcmVmZXJlbmNlOiBxdW90YXRpb24ucmVmZXJlbmNlLFxyXG4gICAgICAgIHN1YnRvdGFsOiBxdW90YXRpb24uc3VidG90YWwsXHJcbiAgICAgICAgdG90YWxfaXRlbV9kaXNjb3VudDogcXVvdGF0aW9uLnRvdGFsX2l0ZW1fZGlzY291bnQsXHJcbiAgICAgICAgZXh0cmFfZGlzY291bnRfcGVyY2VudDogcXVvdGF0aW9uLmV4dHJhX2Rpc2NvdW50X3BlcmNlbnQsXHJcbiAgICAgICAgZXh0cmFfZGlzY291bnRfYW1vdW50OiBxdW90YXRpb24uZXh0cmFfZGlzY291bnRfYW1vdW50LFxyXG4gICAgICAgIHRvdGFsX3RheDogcXVvdGF0aW9uLnRvdGFsX3RheCxcclxuICAgICAgICByb3VuZF9vZmY6IHF1b3RhdGlvbi5yb3VuZF9vZmYsXHJcbiAgICAgICAgZ3JhbmRfdG90YWw6IHF1b3RhdGlvbi5ncmFuZF90b3RhbCxcclxuICAgICAgICBzdGF0dXM6ICdEcmFmdCcsXHJcbiAgICAgICAgbmVnb3RpYXRpb25fbW9kZTogZmFsc2UsXHJcbiAgICAgICAgcmV2aXNlZF9mcm9tX2lkOiBxdW90YXRpb25JZFxyXG4gICAgICB9O1xyXG5cclxuICAgICAgY29uc3QgeyBkYXRhLCBlcnJvciB9ID0gYXdhaXQgc3VwYWJhc2VcclxuICAgICAgICAuZnJvbSgncXVvdGF0aW9uX2hlYWRlcicpXHJcbiAgICAgICAgLmluc2VydChuZXdRdW90YXRpb24pXHJcbiAgICAgICAgLnNlbGVjdCgpXHJcbiAgICAgICAgLnNpbmdsZSgpO1xyXG5cclxuICAgICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgIGlmIChxdW90YXRpb24uaXRlbXMgJiYgcXVvdGF0aW9uLml0ZW1zLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBjb25zdCBpdGVtc1RvSW5zZXJ0ID0gcXVvdGF0aW9uLml0ZW1zLm1hcChpdGVtID0+ICh7XHJcbiAgICAgICAgICBxdW90YXRpb25faWQ6IGRhdGEuaWQsXHJcbiAgICAgICAgICBpdGVtX2lkOiBpdGVtLml0ZW1faWQsXHJcbiAgICAgICAgICB2YXJpYW50X2lkOiBpdGVtLnZhcmlhbnRfaWQsXHJcbiAgICAgICAgICBkZXNjcmlwdGlvbjogaXRlbS5kZXNjcmlwdGlvbixcclxuICAgICAgICAgIHF0eTogaXRlbS5xdHksXHJcbiAgICAgICAgICB1b206IGl0ZW0udW9tLFxyXG4gICAgICAgICAgcmF0ZTogaXRlbS5yYXRlLFxyXG4gICAgICAgICAgb3JpZ2luYWxfZGlzY291bnRfcGVyY2VudDogaXRlbS5vcmlnaW5hbF9kaXNjb3VudF9wZXJjZW50LFxyXG4gICAgICAgICAgZGlzY291bnRfcGVyY2VudDogaXRlbS5kaXNjb3VudF9wZXJjZW50LFxyXG4gICAgICAgICAgZGlzY291bnRfYW1vdW50OiBpdGVtLmRpc2NvdW50X2Ftb3VudCxcclxuICAgICAgICAgIHRheF9wZXJjZW50OiBpdGVtLnRheF9wZXJjZW50LFxyXG4gICAgICAgICAgdGF4X2Ftb3VudDogaXRlbS50YXhfYW1vdW50LFxyXG4gICAgICAgICAgbGluZV90b3RhbDogaXRlbS5saW5lX3RvdGFsLFxyXG4gICAgICAgICAgb3ZlcnJpZGVfZmxhZzogZmFsc2VcclxuICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgIGF3YWl0IHN1cGFiYXNlLmZyb20oJ3F1b3RhdGlvbl9pdGVtcycpLmluc2VydChpdGVtc1RvSW5zZXJ0KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgYWxlcnQoJ1F1b3RhdGlvbiBkdXBsaWNhdGVkIScpO1xyXG4gICAgICBuYXZpZ2F0ZShgL3F1b3RhdGlvbi9lZGl0P2lkPSR7ZGF0YS5pZH1gKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBkdXBsaWNhdGluZyBxdW90YXRpb246JywgZXJyKTtcclxuICAgICAgYWxlcnQoJ0Vycm9yOiAnICsgZXJyLm1lc3NhZ2UpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IGhhbmRsZUNvbnZlcnQgPSAodHlwZSkgPT4ge1xyXG4gICAgaWYgKCFxdW90YXRpb24pIHJldHVybjtcclxuICAgIGlmICh0eXBlID09PSAncHJvZm9ybWEtaW52b2ljZScpIHtcclxuICAgICAgbmF2aWdhdGUoYC9wcm9mb3JtYS1pbnZvaWNlcy9jcmVhdGU/Y29udmVydEZyb209cXVvdGF0aW9uLXRvLXByb2Zvcm1hJnNvdXJjZUlkPSR7cXVvdGF0aW9uSWR9YCk7XHJcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdpbnZvaWNlJykge1xyXG4gICAgICBuYXZpZ2F0ZShgL2ludm9pY2VzL2NyZWF0ZT9jb252ZXJ0RnJvbT1xdW90YXRpb24tdG8taW52b2ljZSZzb3VyY2VJZD0ke3F1b3RhdGlvbklkfWApO1xyXG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnZGVsaXZlcnktY2hhbGxhbicpIHtcclxuICAgICAgbmF2aWdhdGUoYC9kYy9jcmVhdGU/Y29udmVydEZyb209cXVvdGF0aW9uLXRvLWRjJnNvdXJjZUlkPSR7cXVvdGF0aW9uSWR9YCk7XHJcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdzYWxlcy1vcmRlcicpIHtcclxuICAgICAgYWxlcnQoJ1NhbGVzIE9yZGVyIGNvbnZlcnNpb24gbm90IGltcGxlbWVudGVkIHlldC4nKTtcclxuICAgIH1cclxuXHJcbiAgICBzZXRTaG93Q29udmVydE1lbnUoZmFsc2UpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGhhbmRsZUNhbmNlbCA9IGFzeW5jICgpID0+IHtcclxuICAgIGlmICghY29uZmlybSgnQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGNhbmNlbCB0aGlzIHF1b3RhdGlvbj8nKSkgcmV0dXJuO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IHN1cGFiYXNlXHJcbiAgICAgICAgLmZyb20oJ3F1b3RhdGlvbl9oZWFkZXInKVxyXG4gICAgICAgIC51cGRhdGUoeyBzdGF0dXM6ICdDYW5jZWxsZWQnIH0pXHJcbiAgICAgICAgLmVxKCdpZCcsIHF1b3RhdGlvbklkKTtcclxuXHJcbiAgICAgIHF1b3RhdGlvblF1ZXJ5LnJlZmV0Y2goKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBjYW5jZWxsaW5nIHF1b3RhdGlvbjonLCBlcnIpO1xyXG4gICAgICBhbGVydCgnRXJyb3I6ICcgKyBlcnIubWVzc2FnZSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgaGFuZGxlRGVsZXRlID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKCFxdW90YXRpb24pIHJldHVybjtcclxuICAgIGlmIChxdW90YXRpb24uc3RhdHVzICE9PSAnRHJhZnQnKSB7XHJcbiAgICAgIGFsZXJ0KCdPbmx5IERyYWZ0IHF1b3RhdGlvbnMgY2FuIGJlIGRlbGV0ZWQuJyk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBoYW5kbGVBcHByb3ZhbEFjdGlvbiA9IGFzeW5jIChhY3Rpb246ICdBUFBST1ZFRCcgfCAnUkVKRUNURUQnKSA9PiB7XHJcbiAgICBpZiAoIXF1b3RhdGlvbklkIHx8ICFxdW90YXRpb24pIHJldHVybjtcclxuICAgIFxyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcmVzID0gYXdhaXQgQXBwcm92YWxBUEkucHJvY2Vzc0FwcHJvdmFsKFxyXG4gICAgICAgIHF1b3RhdGlvbi5hcHByb3ZhbF9pZCB8fCBxdW90YXRpb25JZCxcclxuICAgICAgICB7IGFjdGlvbiwgY29tbWVudHM6IGAke2FjdGlvbiA9PT0gJ0FQUFJPVkVEJyA/ICdBcHByb3ZlZCB2aWEgcXVvdGF0aW9uIHZpZXcnIDogJ1JlamVjdGVkIHZpYSBxdW90YXRpb24gdmlldyd9YCB9XHJcbiAgICAgICk7XHJcblxyXG4gICAgICBpZiAocmVzLnN1Y2Nlc3MpIHtcclxuICAgICAgICBhbGVydChgUXVvdGF0aW9uICR7YWN0aW9uLnRvTG93ZXJDYXNlKCl9IHN1Y2Nlc3NmdWxseSFgKTtcclxuICAgICAgICBxdW90YXRpb25RdWVyeS5yZWZldGNoKCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYWxlcnQocmVzLmVycm9yPy5tZXNzYWdlIHx8IGBGYWlsZWQgdG8gJHthY3Rpb24udG9Mb3dlckNhc2UoKX0gcXVvdGF0aW9uYCk7XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHByb2Nlc3NpbmcgYXBwcm92YWw6JywgZXJyb3IpO1xyXG4gICAgICBhbGVydCgnRXJyb3IgcHJvY2Vzc2luZyBhcHByb3ZhbC4gUGxlYXNlIHRyeSBhZ2Fpbi4nKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBoYW5kbGVEZWxldGVRdW90YXRpb24gPSBhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoIWNvbmZpcm0oJ0FyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBkZWxldGUgdGhpcyBxdW90YXRpb24/IFRoaXMgY2Fubm90IGJlIHVuZG9uZS4nKSkgcmV0dXJuO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IHN1cGFiYXNlLmZyb20oJ2FwcHJvdmFscycpLmRlbGV0ZSgpLmVxKCdyZWZlcmVuY2VfaWQnLCBxdW90YXRpb25JZCk7XHJcbiAgICAgIGF3YWl0IHN1cGFiYXNlXHJcbiAgICAgICAgLmZyb20oJ3F1b3RhdGlvbl9oZWFkZXInKVxyXG4gICAgICAgIC5kZWxldGUoKVxyXG4gICAgICAgIC5lcSgnaWQnLCBxdW90YXRpb25JZCk7XHJcblxyXG4gICAgICBuYXZpZ2F0ZSgnL3F1b3RhdGlvbicpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGRlbGV0aW5nIHF1b3RhdGlvbjonLCBlcnIpO1xyXG4gICAgICBhbGVydCgnRXJyb3I6ICcgKyBlcnIubWVzc2FnZSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgaGFuZGxlU2VsZWN0VGVtcGxhdGUgPSBhc3luYyAodGVtcGxhdGVJZCkgPT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgYXdhaXQgc3VwYWJhc2VcclxuICAgICAgICAuZnJvbSgncXVvdGF0aW9uX2hlYWRlcicpXHJcbiAgICAgICAgLnVwZGF0ZSh7IHRlbXBsYXRlX2lkOiB0ZW1wbGF0ZUlkIH0pXHJcbiAgICAgICAgLmVxKCdpZCcsIHF1b3RhdGlvbklkKTtcclxuXHJcbiAgICAgIHNldFNlbGVjdGVkVGVtcGxhdGVJZCh0ZW1wbGF0ZUlkKTtcclxuICAgICAgc2V0U2hvd1RlbXBsYXRlTWVudShmYWxzZSk7XHJcbiAgICAgIHF1b3RhdGlvblF1ZXJ5LnJlZmV0Y2goKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBzZWxlY3RpbmcgdGVtcGxhdGU6JywgZXJyKTtcclxuICAgICAgYWxlcnQoJ0Vycm9yOiAnICsgZXJyLm1lc3NhZ2UpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IGhhbmRsZUxhdW5jaFN0b2NrQ2hlY2sgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBzZXRMYXVuY2hpbmdTdG9ja0NoZWNrKHRydWUpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgY2xpZW50ID0gcXVvdGF0aW9uLmNsaWVudDtcclxuICAgICAgY29uc3QgcHJvamVjdCA9IHF1b3RhdGlvbi5wcm9qZWN0O1xyXG5cclxuICAgICAgY29uc3QgeyBkYXRhOiBsaXN0RGF0YSwgZXJyb3I6IGxpc3RFcnJvciB9ID0gYXdhaXQgc3VwYWJhc2VcclxuICAgICAgICAuZnJvbSgncHJvY3VyZW1lbnRfbGlzdHMnKVxyXG4gICAgICAgIC5pbnNlcnQoe1xyXG4gICAgICAgICAgb3JnYW5pc2F0aW9uX2lkOiBvcmdhbmlzYXRpb24/LmlkLFxyXG4gICAgICAgICAgdGl0bGU6IGAke3F1b3RhdGlvbi5xdW90YXRpb25fbm8gfHwgJ1F1b3RhdGlvbid9IOKAlCBTdG9jayBDaGVja2AsXHJcbiAgICAgICAgICBzb3VyY2U6ICdxdW90YXRpb24nLFxyXG4gICAgICAgICAgcXVvdGF0aW9uX2lkOiBxdW90YXRpb24uaWQgfHwgbnVsbCxcclxuICAgICAgICAgIHF1b3RhdGlvbl9ubzogcXVvdGF0aW9uLnF1b3RhdGlvbl9ubyB8fCBudWxsLFxyXG4gICAgICAgICAgY2xpZW50X2lkOiBxdW90YXRpb24uY2xpZW50X2lkIHx8IGNsaWVudD8uaWQgfHwgbnVsbCxcclxuICAgICAgICAgIGNsaWVudF9uYW1lOiBjbGllbnQ/LmNsaWVudF9uYW1lIHx8IGNsaWVudD8ubmFtZSB8fCBudWxsLFxyXG4gICAgICAgICAgcHJvamVjdF9pZDogcXVvdGF0aW9uLnByb2plY3RfaWQgfHwgcHJvamVjdD8uaWQgfHwgbnVsbCxcclxuICAgICAgICAgIHByb2plY3RfbmFtZTogcHJvamVjdD8ucHJvamVjdF9uYW1lIHx8IG51bGwsXHJcbiAgICAgICAgICBzdGF0dXM6ICdBY3RpdmUnLFxyXG4gICAgICAgIH0pXHJcbiAgICAgICAgLnNlbGVjdCgpXHJcbiAgICAgICAgLnNpbmdsZSgpO1xyXG5cclxuICAgICAgaWYgKGxpc3RFcnJvcikgdGhyb3cgbGlzdEVycm9yO1xyXG5cclxuICAgICAgY29uc3Qgcm93cyA9IChxdW90YXRpb24uaXRlbXMgfHwgW10pXHJcbiAgICAgICAgLmZpbHRlcigoaXRlbTogYW55KSA9PiAhaXRlbS5pc19oZWFkZXIgJiYgKGl0ZW0uZGVzY3JpcHRpb24gfHwgaXRlbS5pdGVtX2lkIHx8IGl0ZW0ucXR5KSlcclxuICAgICAgICAubWFwKChpdGVtOiBhbnksIGluZGV4OiBudW1iZXIpID0+IHtcclxuICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gaXRlbS5pdGVtIHx8IHt9O1xyXG4gICAgICAgICAgY29uc3QgY2xpZW50SWQgPSBxdW90YXRpb24uY2xpZW50X2lkIHx8IGNsaWVudD8uaWQ7XHJcbiAgICAgICAgICBjb25zdCBtYXBwaW5nID0gY2xpZW50SWQgJiYgbWF0ZXJpYWw/Lm1hcHBpbmdzPy5maW5kKChtOiBhbnkpID0+IG0uY2xpZW50X2lkID09PSBjbGllbnRJZCk7XHJcbiAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBsaXN0X2lkOiBsaXN0RGF0YS5pZCxcclxuICAgICAgICAgICAgb3JnYW5pc2F0aW9uX2lkOiBvcmdhbmlzYXRpb24/LmlkLFxyXG4gICAgICAgICAgICBpdGVtX2lkOiBtYXRlcmlhbC5pZCB8fCBpdGVtLml0ZW1faWQgfHwgbnVsbCxcclxuICAgICAgICAgICAgaXRlbV9uYW1lOiBtYXBwaW5nPy5jbGllbnRfZGVzY3JpcHRpb24gfHwgaXRlbS5kZXNjcmlwdGlvbiB8fCBtYXRlcmlhbC5kaXNwbGF5X25hbWUgfHwgbWF0ZXJpYWwubmFtZSB8fCAnJyxcclxuICAgICAgICAgICAgbWFrZTogaXRlbS5tYWtlIHx8IG1hdGVyaWFsLm1ha2UgfHwgbnVsbCxcclxuICAgICAgICAgICAgdmFyaWFudF9uYW1lOiBpdGVtLnZhcmlhbnQ/LnZhcmlhbnRfbmFtZSB8fCBudWxsLFxyXG4gICAgICAgICAgICB1b206IGl0ZW0udW9tIHx8IG1hdGVyaWFsLnVuaXQgfHwgbnVsbCxcclxuICAgICAgICAgICAgYm9xX3F0eTogcGFyc2VGbG9hdChTdHJpbmcoaXRlbS5xdHkpKSB8fCAwLFxyXG4gICAgICAgICAgICBzdG9ja19xdHk6IDAsXHJcbiAgICAgICAgICAgIGxvY2FsX3F0eTogMCxcclxuICAgICAgICAgICAgdmVuZG9yX2lkOiBudWxsLFxyXG4gICAgICAgICAgICBub3RlczogbnVsbCxcclxuICAgICAgICAgICAgc3RhdHVzOiAnUGVuZGluZycsXHJcbiAgICAgICAgICAgIGRpc3BsYXlfb3JkZXI6IGluZGV4LFxyXG4gICAgICAgICAgICBpc19oZWFkZXJfcm93OiBmYWxzZSxcclxuICAgICAgICAgIH07XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICBpZiAocm93cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgY29uc3QgeyBlcnJvciB9ID0gYXdhaXQgc3VwYWJhc2UuZnJvbSgncHJvY3VyZW1lbnRfaXRlbXMnKS5pbnNlcnQocm93cyk7XHJcbiAgICAgICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgfVxyXG5cclxuICAgICAgc2V0U2hvd1N0b2NrQ2hlY2tNb2RhbChmYWxzZSk7XHJcbiAgICAgIHNldFNob3dBY3Rpb25zTWVudShmYWxzZSk7XHJcbiAgICAgIG5hdmlnYXRlKGAvcHJvY3VyZW1lbnQvZGV0YWlsP2lkPSR7bGlzdERhdGEuaWR9YCk7XHJcbiAgICB9IGNhdGNoIChlOiBhbnkpIHtcclxuICAgICAgYWxlcnQoJ0Vycm9yIGxhdW5jaGluZyBzdG9jayBjaGVjazogJyArIGUubWVzc2FnZSk7XHJcbiAgICB9IGZpbmFsbHkge1xyXG4gICAgICBzZXRMYXVuY2hpbmdTdG9ja0NoZWNrKGZhbHNlKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBoYW5kbGVQcmludEFjdGlvbiA9IGFzeW5jIChhY3Rpb24sIHRlbXBsYXRlSWQgPSBudWxsKSA9PiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBzZXRQcmludExvYWRpbmcodHJ1ZSk7XHJcbiAgICAgIHNldFNob3dQcmludE1lbnUoZmFsc2UpO1xyXG4gICAgICBsZXQgdGVtcGxhdGUgPSBudWxsO1xyXG4gICAgICBjb25zb2xlLmxvZygnaGFuZGxlUHJpbnRBY3Rpb24gY2FsbGVkIHdpdGg6JywgeyBhY3Rpb24sIHRlbXBsYXRlSWQsIHF1b3RhdGlvbklkIH0pO1xyXG5cclxuICAgICAgaWYgKHRlbXBsYXRlSWQpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnRmV0Y2hpbmcgdGVtcGxhdGUgYnkgSUQ6JywgdGVtcGxhdGVJZCk7XHJcbiAgICAgICAgY29uc3QgeyBkYXRhLCBlcnJvciB9ID0gYXdhaXQgc3VwYWJhc2VcclxuICAgICAgICAgIC5mcm9tKCdkb2N1bWVudF90ZW1wbGF0ZXMnKVxyXG4gICAgICAgICAgLnNlbGVjdCgnKicpXHJcbiAgICAgICAgICAuZXEoJ2lkJywgdGVtcGxhdGVJZClcclxuICAgICAgICAgIC5zaW5nbGUoKTtcclxuICAgICAgICBjb25zb2xlLmxvZygnVGVtcGxhdGUgcXVlcnkgcmVzdWx0OicsIHsgZGF0YSwgZXJyb3IgfSk7XHJcbiAgICAgICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICB0ZW1wbGF0ZSA9IGRhdGE7XHJcbiAgICAgIH0gZWxzZSBpZiAocXVvdGF0aW9uLnRlbXBsYXRlX2lkKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0ZldGNoaW5nIHRlbXBsYXRlIGJ5IHF1b3RhdGlvbi50ZW1wbGF0ZV9pZDonLCBxdW90YXRpb24udGVtcGxhdGVfaWQpO1xyXG4gICAgICAgIGNvbnN0IHsgZGF0YSwgZXJyb3IgfSA9IGF3YWl0IHN1cGFiYXNlXHJcbiAgICAgICAgICAuZnJvbSgnZG9jdW1lbnRfdGVtcGxhdGVzJylcclxuICAgICAgICAgIC5zZWxlY3QoJyonKVxyXG4gICAgICAgICAgLmVxKCdpZCcsIHF1b3RhdGlvbi50ZW1wbGF0ZV9pZClcclxuICAgICAgICAgIC5zaW5nbGUoKTtcclxuICAgICAgICBjb25zb2xlLmxvZygnVGVtcGxhdGUgcXVlcnkgcmVzdWx0OicsIHsgZGF0YSwgZXJyb3IgfSk7XHJcbiAgICAgICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICB0ZW1wbGF0ZSA9IGRhdGE7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0ZldGNoaW5nIGRlZmF1bHQgdGVtcGxhdGUnKTtcclxuICAgICAgICBjb25zdCB7IGRhdGEsIGVycm9yIH0gPSBhd2FpdCBzdXBhYmFzZVxyXG4gICAgICAgICAgLmZyb20oJ2RvY3VtZW50X3RlbXBsYXRlcycpXHJcbiAgICAgICAgICAuc2VsZWN0KCcqJylcclxuICAgICAgICAgIC5lcSgnZG9jdW1lbnRfdHlwZScsICdRdW90YXRpb24nKVxyXG4gICAgICAgICAgLmVxKCdpc19kZWZhdWx0JywgdHJ1ZSlcclxuICAgICAgICAgIC5zaW5nbGUoKTtcclxuICAgICAgICBjb25zb2xlLmxvZygnRGVmYXVsdCB0ZW1wbGF0ZSBxdWVyeSByZXN1bHQ6JywgeyBkYXRhLCBlcnJvciB9KTtcclxuICAgICAgICBpZiAoZXJyb3IpIHRocm93IGVycm9yO1xyXG4gICAgICAgIHRlbXBsYXRlID0gZGF0YTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKCF0ZW1wbGF0ZSkge1xyXG4gICAgICAgIGFsZXJ0KCdObyB0ZW1wbGF0ZSBmb3VuZC4gUGxlYXNlIHNlbGVjdCBhIHRlbXBsYXRlIGZyb20gVGVtcGxhdGUgU2V0dGluZ3MuJyk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoYWN0aW9uID09PSAncHJldmlldy1odG1sJykge1xyXG4gICAgICAgIHByZXZpZXdRdW90YXRpb24odGVtcGxhdGUpO1xyXG4gICAgICB9IGVsc2UgaWYgKGFjdGlvbiA9PT0gJ3ByZXZpZXcnKSB7XHJcbiAgICAgICAgYXdhaXQgZG93bmxvYWRQREYodGVtcGxhdGUsICdwcmV2aWV3Jyk7XHJcbiAgICAgIH0gZWxzZSBpZiAoYWN0aW9uID09PSAnZG93bmxvYWQnKSB7XHJcbiAgICAgICAgYXdhaXQgZG93bmxvYWRQREYodGVtcGxhdGUsICdkb3dubG9hZCcpO1xyXG4gICAgICB9IGVsc2UgaWYgKGFjdGlvbiA9PT0gJ2VtYWlsJykge1xyXG4gICAgICAgIGFsZXJ0KCdFbWFpbCBmZWF0dXJlIGNvbWluZyBzb29uIScpO1xyXG4gICAgICB9IGVsc2UgaWYgKGFjdGlvbiA9PT0gJ3ByaW50Jykge1xyXG4gICAgICAgIGF3YWl0IGRvd25sb2FkUERGKHRlbXBsYXRlLCAncHJpbnQnKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgc2V0U2hvd1ByaW50TWVudShmYWxzZSk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgcHJlcGFyaW5nIHByaW50IGFjdGlvbjonLCBlcnIpO1xyXG4gICAgICBhbGVydCgnVW5hYmxlIHRvIGxvYWQgcHJpbnQgdGVtcGxhdGUuIFBsZWFzZSB2ZXJpZnkgdGVtcGxhdGUgc2V0dGluZ3MuJyk7XHJcbiAgICB9IGZpbmFsbHkge1xyXG4gICAgICBzZXRQcmludExvYWRpbmcoZmFsc2UpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IHByZXZpZXdRdW90YXRpb24gPSBhc3luYyAodGVtcGxhdGUpID0+IHtcclxuICAgIHNldFByZXZpZXdUZW1wbGF0ZSh0ZW1wbGF0ZSk7XHJcbiAgICBzZXRQcmV2aWV3TW9kYWxPcGVuKHRydWUpO1xyXG4gICAgc2V0UHJldmlld0xvYWRpbmcodHJ1ZSk7XHJcblxyXG4gICAgY29uc3QgZ2VuZXJhdGVQcmV2aWV3SFRNTCA9IGFzeW5jICh0bXBsKSA9PiB7XHJcbiAgICAgIGlmICh0bXBsPy5jb2x1bW5fc2V0dGluZ3M/LnByaW50Py5zdHlsZSA9PT0gJ3NhYXMnKSB7XHJcbiAgICAgICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgY29udGFpbmVyLnN0eWxlLndpZHRoID0gJzIxMG1tJztcclxuICAgICAgICBjb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAnZml4ZWQnO1xyXG4gICAgICAgIGNvbnRhaW5lci5zdHlsZS5sZWZ0ID0gJy05OTk5cHgnO1xyXG4gICAgICAgIGNvbnRhaW5lci5zdHlsZS50b3AgPSAnMCc7XHJcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjb250YWluZXIpO1xyXG5cclxuICAgICAgICBjb25zdCByb290ID0gY3JlYXRlUm9vdChjb250YWluZXIpO1xyXG4gICAgICAgIGZsdXNoU3luYygoKSA9PiB7XHJcbiAgICAgICAgICBjb25zdCBxdW90YXRpb25XaXRoVGVybXMgPSB7XHJcbiAgICAgICAgICAgIC4uLnF1b3RhdGlvbixcclxuICAgICAgICAgICAgdGVybXNfY29uZGl0aW9uczogdGVybXNDb25kaXRpb25zUXVlcnkuZGF0YT8uY3VzdG9tX2NvbnRlbnQgfHwgbnVsbFxyXG4gICAgICAgICAgfTtcclxuICAgICAgICAgIHJvb3QucmVuZGVyKFxyXG4gICAgICAgICAgICA8U2FhU1RlbXBsYXRlXHJcbiAgICAgICAgICAgICAgZGF0YT17cXVvdGF0aW9uV2l0aFRlcm1zfVxyXG4gICAgICAgICAgICAgIG9yZ2FuaXNhdGlvbj17b3JnYW5pc2F0aW9ufVxyXG4gICAgICAgICAgICAgIHRlbXBsYXRlQ29uZmlnPXt0bXBsLmNvbHVtbl9zZXR0aW5nc31cclxuICAgICAgICAgICAgLz5cclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCA1MDApKTtcclxuICAgICAgICBjb25zdCBodG1sID0gY29udGFpbmVyLmlubmVySFRNTDtcclxuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGNvbnRhaW5lcik7XHJcbiAgICAgICAgcmV0dXJuIGh0bWw7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICh0bXBsPy5jb2x1bW5fc2V0dGluZ3M/LnByaW50Py5zdHlsZSA9PT0gJ3ZlcnRpY2FsJyB8fCB0bXBsPy50ZW1wbGF0ZV9jb2RlID09PSAnUVROX1ZFUlRJQ0FMJykge1xyXG4gICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgIGNvbnRhaW5lci5zdHlsZS53aWR0aCA9ICcyMTBtbSc7XHJcbiAgICAgICAgY29udGFpbmVyLnN0eWxlLnBvc2l0aW9uID0gJ2ZpeGVkJztcclxuICAgICAgICBjb250YWluZXIuc3R5bGUubGVmdCA9ICctOTk5OXB4JztcclxuICAgICAgICBjb250YWluZXIuc3R5bGUudG9wID0gJzAnO1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY29udGFpbmVyKTtcclxuXHJcbiAgICAgICAgY29uc3Qgcm9vdCA9IGNyZWF0ZVJvb3QoY29udGFpbmVyKTtcclxuICAgICAgICBmbHVzaFN5bmMoKCkgPT4ge1xyXG4gICAgICAgICAgY29uc3QgcXVvdGF0aW9uV2l0aFRlcm1zID0ge1xyXG4gICAgICAgICAgICAuLi5xdW90YXRpb24sXHJcbiAgICAgICAgICAgIHRlcm1zX2NvbmRpdGlvbnM6IHRlcm1zQ29uZGl0aW9uc1F1ZXJ5LmRhdGE/LmN1c3RvbV9jb250ZW50IHx8IG51bGxcclxuICAgICAgICAgIH07XHJcbiAgICAgICAgICByb290LnJlbmRlcihcclxuICAgICAgICAgICAgPFZlcnRpY2FsVGVtcGxhdGVcclxuICAgICAgICAgICAgICBkYXRhPXtxdW90YXRpb25XaXRoVGVybXN9XHJcbiAgICAgICAgICAgICAgb3JnYW5pc2F0aW9uPXtvcmdhbmlzYXRpb259XHJcbiAgICAgICAgICAgICAgdGVtcGxhdGVDb25maWc9e3RtcGwuY29sdW1uX3NldHRpbmdzfVxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDUwMCkpO1xyXG4gICAgICAgIGNvbnN0IGh0bWwgPSBjb250YWluZXIuaW5uZXJIVE1MO1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoY29udGFpbmVyKTtcclxuICAgICAgICByZXR1cm4gaHRtbDtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHRtcGw/LnRlbXBsYXRlX2NvZGUgPT09ICdRVE5fRU5URVJQUklTRScpIHtcclxuICAgICAgICBjb25zdCBxdW90YXRpb25XaXRoVGVybXMgPSB7XHJcbiAgICAgICAgICAuLi5xdW90YXRpb24sXHJcbiAgICAgICAgICB0ZXJtc19jb25kaXRpb25zOiB0ZXJtc0NvbmRpdGlvbnNRdWVyeS5kYXRhPy5jdXN0b21fY29udGVudCB8fCBudWxsXHJcbiAgICAgICAgfTtcclxuICAgICAgICBjb25zdCBpc0ludGVyU3RhdGUgPSBxdW90YXRpb24uc3RhdGUgJiYgb3JnYW5pc2F0aW9uPy5zdGF0ZSAmJlxyXG4gICAgICAgICAgcXVvdGF0aW9uLnN0YXRlLnRyaW0oKS50b0xvd2VyQ2FzZSgpICE9PSBvcmdhbmlzYXRpb24uc3RhdGUudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRTaWduYXRvcnkgPSAob3JnYW5pc2F0aW9uPy5zaWduYXR1cmVzIHx8IFtdKS5maW5kKHMgPT4gcy5pZCA9PSBxdW90YXRpb24uYXV0aG9yaXplZF9zaWduYXRvcnlfaWQpO1xyXG5cclxuICAgICAgICBjb25zdCBvcHRzID0ge1xyXG4gICAgICAgICAgb3JnOiB7XHJcbiAgICAgICAgICAgIG5hbWU6IG9yZ2FuaXNhdGlvbj8ubmFtZSB8fCAnJyxcclxuICAgICAgICAgICAgYWRkcmVzczogb3JnYW5pc2F0aW9uPy5hZGRyZXNzIHx8ICcnLFxyXG4gICAgICAgICAgICBjaXR5OiBvcmdhbmlzYXRpb24/LmNpdHkgfHwgJycsXHJcbiAgICAgICAgICAgIHN0YXRlOiBvcmdhbmlzYXRpb24/LnN0YXRlIHx8ICcnLFxyXG4gICAgICAgICAgICBwaW5jb2RlOiBvcmdhbmlzYXRpb24/LnBpbmNvZGUgfHwgJycsXHJcbiAgICAgICAgICAgIGdzdGluOiBvcmdhbmlzYXRpb24/LmdzdGluIHx8ICcnLFxyXG4gICAgICAgICAgICBwaG9uZTogb3JnYW5pc2F0aW9uPy5waG9uZSB8fCAnJyxcclxuICAgICAgICAgICAgZW1haWw6IG9yZ2FuaXNhdGlvbj8uZW1haWwgfHwgJycsXHJcbiAgICAgICAgICAgIGxvZ29fdXJsOiBvcmdhbmlzYXRpb24/LmxvZ29fdXJsIHx8ICcnXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgY2xpZW50OiB7XHJcbiAgICAgICAgICAgIGRpc3BsYXlfbmFtZTogcXVvdGF0aW9uLmNsaWVudD8uY2xpZW50X25hbWUgfHwgcXVvdGF0aW9uLmNsaWVudD8ubmFtZSB8fCAnJyxcclxuICAgICAgICAgICAgYmlsbGluZ19hZGRyZXNzOiBxdW90YXRpb24uYmlsbGluZ19hZGRyZXNzIHx8ICcnLFxyXG4gICAgICAgICAgICBnc3RpbjogcXVvdGF0aW9uLmNsaWVudD8uZ3N0aW4gfHwgcXVvdGF0aW9uLmdzdGluIHx8ICcnLFxyXG4gICAgICAgICAgICBzdGF0ZTogcXVvdGF0aW9uLmNsaWVudD8uc3RhdGUgfHwgcXVvdGF0aW9uLnN0YXRlIHx8ICcnXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgaGVhZGVyOiB7XHJcbiAgICAgICAgICAgIHF1b3RhdGlvbl9ubzogcXVvdGF0aW9uLnF1b3RhdGlvbl9ubyB8fCAnJyxcclxuICAgICAgICAgICAgcmV2aXNpb25fbm86IHF1b3RhdGlvbi5yZXZpc2lvbl9ubyA/IHBhcnNlSW50KHF1b3RhdGlvbi5yZXZpc2lvbl9ubykgOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgIGRhdGU6IGZvcm1hdERhdGUocXVvdGF0aW9uLmRhdGUpLFxyXG4gICAgICAgICAgICB2YWxpZF90aWxsOiBmb3JtYXREYXRlKHF1b3RhdGlvbi52YWxpZF90aWxsKSxcclxuICAgICAgICAgICAgcGF5bWVudF90ZXJtczogcXVvdGF0aW9uLnBheW1lbnRfdGVybXMgfHwgJycsXHJcbiAgICAgICAgICAgIHJlZmVyZW5jZTogcXVvdGF0aW9uLnJlZmVyZW5jZSB8fCAnJyxcclxuICAgICAgICAgICAgcHJlcGFyZWRfYnk6IHF1b3RhdGlvbi5wcmVwYXJlZF9ieSB8fCAnJyxcclxuICAgICAgICAgICAgcmVtYXJrczogcXVvdGF0aW9uLnJlbWFya3MgfHwgJycsXHJcbiAgICAgICAgICAgIHByb2plY3RfbmFtZTogcXVvdGF0aW9uLnByb2plY3Q/LnByb2plY3RfbmFtZSB8fCBxdW90YXRpb24ucHJvamVjdD8ucHJvamVjdF9jb2RlIHx8ICcnXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgaXRlbXM6IChxdW90YXRpb24uaXRlbXMgfHwgW10pLm1hcCgoaXRlbTogYW55KSA9PiAoe1xyXG4gICAgICAgICAgICBpc19oZWFkZXI6IGl0ZW0uaXNfaGVhZGVyLFxyXG4gICAgICAgICAgICBpc19zdWJ0b3RhbDogaXRlbS5pc19zdWJ0b3RhbCxcclxuICAgICAgICAgICAgc3VidG90YWxfbGFiZWw6IGl0ZW0uc3VidG90YWxfbGFiZWwsXHJcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBpdGVtLmRlc2NyaXB0aW9uIHx8IGl0ZW0uaXRlbT8ubmFtZSB8fCBpdGVtLml0ZW0/LmRpc3BsYXlfbmFtZSB8fCAnJyxcclxuICAgICAgICAgICAgaXRlbV9jb2RlOiBpdGVtLml0ZW1fY29kZSB8fCBpdGVtLml0ZW0/Lml0ZW1fY29kZSB8fCAnJyxcclxuICAgICAgICAgICAgaHNuX2NvZGU6IGl0ZW0uc2FjX2NvZGUgfHwgaXRlbS5pdGVtPy5oc25fY29kZSB8fCAnJyxcclxuICAgICAgICAgICAgdmFyaWFudF9uYW1lOiBpdGVtLnZhcmlhbnQ/LnZhcmlhbnRfbmFtZSB8fCAnJyxcclxuICAgICAgICAgICAgcXR5OiBpdGVtLnF0eSxcclxuICAgICAgICAgICAgdW9tOiBpdGVtLnVvbSxcclxuICAgICAgICAgICAgYmFzZV9yYXRlX3NuYXBzaG90OiBpdGVtLmJhc2VfcmF0ZV9zbmFwc2hvdCB8fCBpdGVtLnJhdGUsXHJcbiAgICAgICAgICAgIGRpc2NvdW50X3BlcmNlbnQ6IGl0ZW0uZGlzY291bnRfcGVyY2VudCxcclxuICAgICAgICAgICAgcmF0ZTogaXRlbS5yYXRlLFxyXG4gICAgICAgICAgICB0YXhfcGVyY2VudDogaXRlbS50YXhfcGVyY2VudCxcclxuICAgICAgICAgICAgbGluZV90b3RhbDogaXRlbS5saW5lX3RvdGFsLFxyXG4gICAgICAgICAgICBjdXN0b20xOiBpdGVtLmN1c3RvbTEsXHJcbiAgICAgICAgICAgIGN1c3RvbTI6IGl0ZW0uY3VzdG9tMlxyXG4gICAgICAgICAgfSkpLFxyXG4gICAgICAgICAgY2FsY3VsYXRpb25zOiB7XHJcbiAgICAgICAgICAgIHN1YnRvdGFsOiBxdW90YXRpb24uc3VidG90YWwgfHwgMCxcclxuICAgICAgICAgICAgdG90YWxJdGVtRGlzY291bnQ6IHF1b3RhdGlvbi50b3RhbF9pdGVtX2Rpc2NvdW50IHx8IDAsXHJcbiAgICAgICAgICAgIGV4dHJhRGlzY291bnRBbW91bnQ6IHF1b3RhdGlvbi5leHRyYV9kaXNjb3VudF9hbW91bnQgfHwgMCxcclxuICAgICAgICAgICAgY2dzdDogaXNJbnRlclN0YXRlID8gMCA6IChxdW90YXRpb24udG90YWxfdGF4IHx8IDApIC8gMixcclxuICAgICAgICAgICAgc2dzdDogaXNJbnRlclN0YXRlID8gMCA6IChxdW90YXRpb24udG90YWxfdGF4IHx8IDApIC8gMixcclxuICAgICAgICAgICAgaWdzdDogaXNJbnRlclN0YXRlID8gKHF1b3RhdGlvbi50b3RhbF90YXggfHwgMCkgOiAwLFxyXG4gICAgICAgICAgICBpc0ludGVyU3RhdGU6IGlzSW50ZXJTdGF0ZSxcclxuICAgICAgICAgICAgdG90YWxUYXg6IHF1b3RhdGlvbi50b3RhbF90YXggfHwgMCxcclxuICAgICAgICAgICAgcm91bmRPZmY6IHF1b3RhdGlvbi5yb3VuZF9vZmYgfHwgMCxcclxuICAgICAgICAgICAgZ3JhbmRUb3RhbDogcXVvdGF0aW9uLmdyYW5kX3RvdGFsIHx8IDAsXHJcbiAgICAgICAgICAgIGFtb3VudEluV29yZHM6IHF1b3RhdGlvbi5hbW91bnRfaW5fd29yZHMgfHwgJydcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBjb2x1bW5TZXR0aW5nczogdG1wbC5jb2x1bW5fc2V0dGluZ3MsXHJcbiAgICAgICAgICBzaWduYXRvcnk6IHtcclxuICAgICAgICAgICAgbmFtZTogc2VsZWN0ZWRTaWduYXRvcnk/Lm5hbWUgfHwgJycsXHJcbiAgICAgICAgICAgIGRlc2lnbmF0aW9uOiBvcmdhbmlzYXRpb24/LnNpZ25hdG9yeV9kZXNpZ25hdGlvbiB8fCAnQXV0aG9yaXNlZCBTaWduYXRvcnknLFxyXG4gICAgICAgICAgICBmb3JfY29tcGFueTogb3JnYW5pc2F0aW9uPy5uYW1lIHx8ICcnXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgYmFua0RldGFpbHM6IHtcclxuICAgICAgICAgICAgYmFua19uYW1lOiBvcmdhbmlzYXRpb24/LmJhbmtfbmFtZSxcclxuICAgICAgICAgICAgYnJhbmNoOiBvcmdhbmlzYXRpb24/LmJhbmtfYnJhbmNoLFxyXG4gICAgICAgICAgICBhY2NvdW50X25hbWU6IG9yZ2FuaXNhdGlvbj8uYmFua19hY2NvdW50X25hbWUgfHwgb3JnYW5pc2F0aW9uPy5uYW1lLFxyXG4gICAgICAgICAgICBhY2NvdW50X25vOiBvcmdhbmlzYXRpb24/LmJhbmtfYWNjb3VudF9ubyxcclxuICAgICAgICAgICAgaWZzYzogb3JnYW5pc2F0aW9uPy5iYW5rX2lmc2MsXHJcbiAgICAgICAgICAgIGFjY291bnRfdHlwZTogb3JnYW5pc2F0aW9uPy5iYW5rX2FjY291bnRfdHlwZSxcclxuICAgICAgICAgICAgc3dpZnQ6IG9yZ2FuaXNhdGlvbj8uYmFua19zd2lmdFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHRlcm1zQW5kQ29uZGl0aW9uczogKCgpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgcmF3VGVybXMgPSBxdW90YXRpb25XaXRoVGVybXMudGVybXNfY29uZGl0aW9ucztcclxuICAgICAgICAgICAgbGV0IHBhcnNlZFRlcm1zOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgICAgICBpZiAocmF3VGVybXMpIHtcclxuICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gdHlwZW9mIHJhd1Rlcm1zID09PSAnc3RyaW5nJyA/IEpTT04ucGFyc2UocmF3VGVybXMpIDogcmF3VGVybXM7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBleHRyYWN0U2VjdGlvbnMgPSAob2JqOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgaWYgKCFvYmopIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIG9iai5mb3JFYWNoKGV4dHJhY3RTZWN0aW9ucyk7XHJcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAob2JqLnNlY3Rpb25zICYmIEFycmF5LmlzQXJyYXkob2JqLnNlY3Rpb25zKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIG9iai5zZWN0aW9ucy5mb3JFYWNoKChzZWM6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHNlYy5pdGVtcyAmJiBBcnJheS5pc0FycmF5KHNlYy5pdGVtcykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2VjLml0ZW1zLmZvckVhY2goKGl0ZW06IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpdGVtLmNvbnRlbnQpIHBhcnNlZFRlcm1zLnB1c2goaXRlbS5jb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICBleHRyYWN0U2VjdGlvbnMocGFyc2VkKTtcclxuICAgICAgICAgICAgICAgIGlmIChwYXJzZWRUZXJtcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgcGFyc2VkVGVybXMgPSB0eXBlb2YgcmF3VGVybXMgPT09ICdzdHJpbmcnID8gcmF3VGVybXMuc3BsaXQoJ1xcbicpIDogW107XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgcGFyc2VkVGVybXMgPSB0eXBlb2YgcmF3VGVybXMgPT09ICdzdHJpbmcnID8gcmF3VGVybXMuc3BsaXQoJ1xcbicpIDogW107XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbmFsVGVybXMgPSBwYXJzZWRUZXJtcy5maWx0ZXIodCA9PiB0ICYmIHQudHJpbSgpLmxlbmd0aCA+IDApO1xyXG4gICAgICAgICAgICByZXR1cm4gZmluYWxUZXJtcy5sZW5ndGggPiAwID8gZmluYWxUZXJtcyA6IFsnUGF5bWVudCBhcyBwZXIgdGVybXMgbWVudGlvbmVkIGFib3ZlLicsICdUaGlzIGlzIGEgc3lzdGVtLWdlbmVyYXRlZCBkb2N1bWVudC4nXTtcclxuICAgICAgICAgIH0pKCksXHJcbiAgICAgICAgICBjb21wYW55TG9nb0Jhc2U2NDogb3JnYW5pc2F0aW9uPy5sb2dvX3VybCBcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgY29uc3QgZW50ZXJwcmlzZURvYyA9IGdlbmVyYXRlUXVvdGF0aW9uUGRmKG9wdHMgYXMgYW55KTtcclxuICAgICAgICAgIGNvbnN0IHBkZkJsb2IgPSBlbnRlcnByaXNlRG9jLm91dHB1dCgnYmxvYicpO1xyXG4gICAgICAgICAgY29uc3QgYmxvYlVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwocGRmQmxvYik7XHJcbiAgICAgICAgICByZXR1cm4gYDxpZnJhbWUgc3JjPVwiJHtibG9iVXJsfSN2aWV3PUZpdEhcIiB3aWR0aD1cIjEwMCVcIiBoZWlnaHQ9XCI4MDBweFwiIHN0eWxlPVwiYm9yZGVyOiBub25lOyBib3JkZXItcmFkaXVzOiA4cHg7XCI+PC9pZnJhbWU+YDtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRW50ZXJwcmlzZSBQcmV2aWV3IEVycm9yXCIsIGUpO1xyXG4gICAgICAgICAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwicC04IHRleHQtY2VudGVyIHRleHQtcmVkLTUwMFwiPkVycm9yIGdlbmVyYXRpbmcgUERGIHByZXZpZXc8L2Rpdj5gO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gRGVmYXVsdCBIVE1MIHRlbXBsYXRlXHJcbiAgICAgIHJldHVybiBnZW5lcmF0ZVF1b3RhdGlvbkhUTUwodG1wbCk7XHJcbiAgICB9O1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGh0bWwgPSBhd2FpdCBnZW5lcmF0ZVByZXZpZXdIVE1MKHRlbXBsYXRlKTtcclxuICAgICAgc2V0UHJldmlld0hUTUwoaHRtbCk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignUHJldmlldyBlcnJvcjonLCBlcnIpO1xyXG4gICAgICBzZXRQcmV2aWV3SFRNTCgnPGRpdiBjbGFzcz1cInAtOCB0ZXh0LWNlbnRlciB0ZXh0LXJlZC01MDBcIj5FcnJvciBnZW5lcmF0aW5nIHByZXZpZXc8L2Rpdj4nKTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIHNldFByZXZpZXdMb2FkaW5nKGZhbHNlKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICAvLyBEb3dubG9hZCBmcm9tIHByZXZpZXcgbW9kYWxcclxuICBjb25zdCBkb3dubG9hZEZyb21QcmV2aWV3ID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKCFwcmV2aWV3VGVtcGxhdGUgfHwgIXF1b3RhdGlvbikgcmV0dXJuO1xyXG4gICAgXHJcbiAgICBjb25zdCBzYWZlRmlsZU5hbWUgPSBTdHJpbmcocXVvdGF0aW9uLnF1b3RhdGlvbl9ubyB8fCAncXVvdGF0aW9uJylcclxuICAgICAgLnJlcGxhY2UoL1s8PjpcIi9cXFxcfD8qXFx4MDAtXFx4MUZdL2csICdfJylcclxuICAgICAgLnJlcGxhY2UoL1xccysvZywgJ18nKTtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBpZiAocHJldmlld1RlbXBsYXRlPy5jb2x1bW5fc2V0dGluZ3M/LnByaW50Py5zdHlsZSA9PT0gJ3NhYXMnKSB7XHJcbiAgICAgICAgY29uc3QgYmxvYiA9IGF3YWl0IGh0bWxUb1BkZihkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJldmlldy1tb2RhbC1jb250ZW50JyksIGAke3NhZmVGaWxlTmFtZX0ucGRmYCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChwcmV2aWV3VGVtcGxhdGU/LmNvbHVtbl9zZXR0aW5ncz8ucHJpbnQ/LnN0eWxlID09PSAndmVydGljYWwnIHx8IHByZXZpZXdUZW1wbGF0ZT8udGVtcGxhdGVfY29kZSA9PT0gJ1FUTl9WRVJUSUNBTCcpIHtcclxuICAgICAgICBjb25zdCBibG9iID0gYXdhaXQgaHRtbFRvUGRmKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcmV2aWV3LW1vZGFsLWNvbnRlbnQnKSwgYCR7c2FmZUZpbGVOYW1lfS5wZGZgKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgLy8gRmFsbGJhY2sgZm9yIG90aGVyIHRlbXBsYXRlc1xyXG4gICAgICBkb3dubG9hZFBERihwcmV2aWV3VGVtcGxhdGUpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Rvd25sb2FkIGVycm9yOicsIGVycik7XHJcbiAgICAgIGRvd25sb2FkUERGKHByZXZpZXdUZW1wbGF0ZSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgLy8gUHJpbnQgZnJvbSBwcmV2aWV3IG1vZGFsXHJcbiAgY29uc3QgcHJpbnRGcm9tUHJldmlldyA9ICgpID0+IHtcclxuICAgIGNvbnN0IHByaW50Q29udGVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcmV2aWV3LW1vZGFsLWNvbnRlbnQnKTtcclxuICAgIGlmICghcHJpbnRDb250ZW50KSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgcHJpbnRXaW5kb3cgPSB3aW5kb3cub3BlbignJywgJ19ibGFuaycpO1xyXG4gICAgaWYgKCFwcmludFdpbmRvdykgcmV0dXJuO1xyXG5cclxuICAgIHByaW50V2luZG93LmRvY3VtZW50LndyaXRlKGBcclxuICAgICAgPGh0bWw+XHJcbiAgICAgICAgPGhlYWQ+XHJcbiAgICAgICAgICA8dGl0bGU+UHJpbnQgLSAke3F1b3RhdGlvbj8ucXVvdGF0aW9uX25vIHx8ICdRdW90YXRpb24nfTwvdGl0bGU+XHJcbiAgICAgICAgICA8c2NyaXB0IHNyYz1cImh0dHBzOi8vY2RuLnRhaWx3aW5kY3NzLmNvbVwiPjwvc2NyaXB0PlxyXG4gICAgICAgICAgPHN0eWxlPlxyXG4gICAgICAgICAgICBAbWVkaWEgcHJpbnQge1xyXG4gICAgICAgICAgICAgIGJvZHkgeyAtd2Via2l0LXByaW50LWNvbG9yLWFkanVzdDogZXhhY3Q7IHByaW50LWNvbG9yLWFkanVzdDogZXhhY3Q7IH1cclxuICAgICAgICAgICAgICBAcGFnZSB7IG1hcmdpbjogMDsgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJvZHkgeyBtYXJnaW46IDA7IHBhZGRpbmc6IDA7IH1cclxuICAgICAgICAgICAgI3ByaW50LWNvbnRhaW5lciB7IHdpZHRoOiAyMTBtbTsgbWFyZ2luOiAwIGF1dG87IGJhY2tncm91bmQ6IHdoaXRlOyB9XHJcbiAgICAgICAgICA8L3N0eWxlPlxyXG4gICAgICAgIDwvaGVhZD5cclxuICAgICAgICA8Ym9keT5cclxuICAgICAgICAgIDxkaXYgaWQ9XCJwcmludC1jb250YWluZXJcIj5cclxuICAgICAgICAgICAgJHtwcmludENvbnRlbnQuaW5uZXJIVE1MfVxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8c2NyaXB0PlxyXG4gICAgICAgICAgICB3aW5kb3cub25sb2FkID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5wcmludCgpO1xyXG4gICAgICAgICAgICAgICAgd2luZG93LmNsb3NlKCk7XHJcbiAgICAgICAgICAgICAgfSwgNTAwKTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgIDwvc2NyaXB0PlxyXG4gICAgICAgIDwvYm9keT5cclxuICAgICAgPC9odG1sPlxyXG4gICAgYCk7XHJcbiAgICBwcmludFdpbmRvdy5kb2N1bWVudC5jbG9zZSgpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGRvd25sb2FkUERGID0gYXN5bmMgKHRlbXBsYXRlLCBhY3Rpb24gPSAnZG93bmxvYWQnKSA9PiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBpZiAoIXF1b3RhdGlvbikgdGhyb3cgbmV3IEVycm9yKCdRdW90YXRpb24gZGF0YSBpcyBtaXNzaW5nJyk7XHJcblxyXG4gICAgICBjb25zdCBzYWZlRmlsZU5hbWUgPSBTdHJpbmcocXVvdGF0aW9uLnF1b3RhdGlvbl9ubyB8fCAncXVvdGF0aW9uJylcclxuICAgICAgICAucmVwbGFjZSgvWzw+OlwiL1xcXFx8PypcXHgwMC1cXHgxRl0vZywgJ18nKVxyXG4gICAgICAgIC5yZXBsYWNlKC9cXHMrL2csICdfJyk7XHJcblxyXG4gICAgICBjb25zdCBoYW5kbGVPdXRwdXQgPSAoYmxvYikgPT4ge1xyXG4gICAgICAgIGNvbnN0IHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XHJcbiAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ3ByZXZpZXcnKSB7XHJcbiAgICAgICAgICBzZXRQZGZQcmV2aWV3VXJsKHVybCk7XHJcbiAgICAgICAgICBzZXRTaG93UGRmUHJldmlld01vZGFsKHRydWUpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoYWN0aW9uID09PSAncHJpbnQnKSB7XHJcbiAgICAgICAgICBjb25zdCBwcmludFdpbmRvdyA9IHdpbmRvdy5vcGVuKHVybCwgJ19ibGFuaycpO1xyXG4gICAgICAgICAgaWYgKHByaW50V2luZG93KSB7XHJcbiAgICAgICAgICAgIHByaW50V2luZG93Lm9ubG9hZCA9ICgpID0+IHtcclxuICAgICAgICAgICAgICBwcmludFdpbmRvdy5wcmludCgpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBjb25zdCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG4gICAgICAgICAgYS5ocmVmID0gdXJsO1xyXG4gICAgICAgICAgYS5kb3dubG9hZCA9IGAke3NhZmVGaWxlTmFtZX0ucGRmYDtcclxuICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XHJcbiAgICAgICAgICBhLmNsaWNrKCk7XHJcbiAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGEpO1xyXG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiBVUkwucmV2b2tlT2JqZWN0VVJMKHVybCksIDEwMCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG5cclxuICAgICAgLy8gSGFuZGxlIEhUTUwgdGVtcGxhdGVzXHJcbiAgICAgIGlmICh0ZW1wbGF0ZS50ZW1wbGF0ZV90eXBlID09PSAnaHRtbCcpIHtcclxuICAgICAgICBjb25zdCBodG1sRGF0YSA9IHtcclxuICAgICAgICAgIGRvY3VtZW50X3R5cGU6ICdRVU9UQVRJT04nLFxyXG4gICAgICAgICAgcXVvdGF0aW9uX25vOiBxdW90YXRpb24ucXVvdGF0aW9uX25vIHx8ICcnLFxyXG4gICAgICAgICAgcmV2aXNpb25fbm86IHF1b3RhdGlvbi5yZXZpc2lvbl9ubyB8fCAnMDAnLFxyXG4gICAgICAgICAgZGF0ZTogcXVvdGF0aW9uLmRhdGUgfHwgJycsXHJcbiAgICAgICAgICB2YWxpZF90aWxsOiBxdW90YXRpb24udmFsaWRfdGlsbCB8fCAnJyxcclxuICAgICAgICAgIHJlbWFya3M6IHF1b3RhdGlvbi5yZW1hcmtzIHx8ICcnLFxyXG4gICAgICAgICAgcGF5bWVudF90ZXJtczogcXVvdGF0aW9uLnBheW1lbnRfdGVybXMgfHwgJycsXHJcblxyXG4gICAgICAgICAgLy8gT3JnYW5pc2F0aW9uIGRldGFpbHNcclxuICAgICAgICAgIG9yZ2FuaXNhdGlvbl9uYW1lOiBvcmdhbmlzYXRpb24ubmFtZSB8fCAnJyxcclxuICAgICAgICAgIG9yZ2FuaXNhdGlvbl9hZGRyZXNzOiBvcmdhbmlzYXRpb24uYWRkcmVzcyB8fCAnJyxcclxuICAgICAgICAgIG9yZ2FuaXNhdGlvbl9waG9uZTogb3JnYW5pc2F0aW9uLnBob25lIHx8ICcnLFxyXG4gICAgICAgICAgb3JnYW5pc2F0aW9uX2VtYWlsOiBvcmdhbmlzYXRpb24uZW1haWwgfHwgJycsXHJcbiAgICAgICAgICBvcmdhbmlzYXRpb25fZ3N0aW46IG9yZ2FuaXNhdGlvbi5nc3RpbiB8fCAnJyxcclxuICAgICAgICAgIG9yZ2FuaXNhdGlvbl9jaW46IG9yZ2FuaXNhdGlvbi5jaW4gfHwgJycsXHJcbiAgICAgICAgICBvcmdhbmlzYXRpb25fcGFuOiBvcmdhbmlzYXRpb24ucGFuIHx8ICcnLFxyXG4gICAgICAgICAgb3JnYW5pc2F0aW9uX2llX2NvZGU6IG9yZ2FuaXNhdGlvbi5pZV9jb2RlIHx8ICcnLFxyXG5cclxuICAgICAgICAgIC8vIENsaWVudCBkZXRhaWxzXHJcbiAgICAgICAgICBjbGllbnRfbmFtZTogcXVvdGF0aW9uLmNsaWVudD8uY2xpZW50X25hbWUgfHwgcXVvdGF0aW9uLmNsaWVudD8ubmFtZSB8fCAnJyxcclxuICAgICAgICAgIGNsaWVudF9jb250YWN0X3BlcnNvbjogcXVvdGF0aW9uLmNvbnRhY3RfcGVyc29uIHx8ICcnLFxyXG4gICAgICAgICAgY2xpZW50X2FkZHJlc3M6IHF1b3RhdGlvbi5iaWxsaW5nX2FkZHJlc3MgfHwgcXVvdGF0aW9uLmNsaWVudD8uYWRkcmVzcyB8fCAnJyxcclxuICAgICAgICAgIGNsaWVudF9jaXR5OiBxdW90YXRpb24uY2xpZW50Py5jaXR5IHx8ICcnLFxyXG4gICAgICAgICAgY2xpZW50X3BpbmNvZGU6IHF1b3RhdGlvbi5jbGllbnQ/LnBpbmNvZGUgfHwgJycsXHJcbiAgICAgICAgICBjbGllbnRfZ3N0aW46IHF1b3RhdGlvbi5jbGllbnQ/LmdzdGluIHx8IHF1b3RhdGlvbi5nc3RpbiB8fCAnJyxcclxuICAgICAgICAgIGNsaWVudF9waG9uZTogcXVvdGF0aW9uLmNsaWVudD8ucGhvbmUgfHwgJycsXHJcblxyXG4gICAgICAgICAgLy8gU2hpcHBpbmcgZGV0YWlsc1xyXG4gICAgICAgICAgc2hpcHBpbmdfY29tcGFueV9uYW1lOiBxdW90YXRpb24uc2hpcHBpbmdfY29tcGFueV9uYW1lIHx8IHF1b3RhdGlvbi5jbGllbnQ/LmNsaWVudF9uYW1lIHx8ICcnLFxyXG4gICAgICAgICAgc2hpcHBpbmdfYWRkcmVzczogcXVvdGF0aW9uLnNoaXBwaW5nX2FkZHJlc3MgfHwgcXVvdGF0aW9uLmJpbGxpbmdfYWRkcmVzcyB8fCAnJyxcclxuICAgICAgICAgIHNoaXBwaW5nX2NpdHk6IHF1b3RhdGlvbi5zaGlwcGluZ19jaXR5IHx8IHF1b3RhdGlvbi5jbGllbnQ/LmNpdHkgfHwgJycsXHJcbiAgICAgICAgICBzaGlwcGluZ19waW5jb2RlOiBxdW90YXRpb24uc2hpcHBpbmdfcGluY29kZSB8fCBxdW90YXRpb24uY2xpZW50Py5waW5jb2RlIHx8ICcnLFxyXG4gICAgICAgICAgc2hpcHBpbmdfcGhvbmU6IHF1b3RhdGlvbi5zaGlwcGluZ19waG9uZSB8fCBxdW90YXRpb24uY2xpZW50Py5waG9uZSB8fCAnJyxcclxuXHJcbiAgICAgICAgICAvLyBJdGVtc1xyXG4gICAgICAgICAgaXRlbXM6IChxdW90YXRpb24uaXRlbXMgfHwgW10pLm1hcCgoaXRlbTogYW55LCBpZHg6IG51bWJlcikgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBjbGllbnRJZCA9IHF1b3RhdGlvbi5jbGllbnRfaWQgfHwgcXVvdGF0aW9uLmNsaWVudD8uaWQ7XHJcbiAgICAgICAgICAgIGNvbnN0IG1hcHBpbmcgPSBjbGllbnRJZCAmJiBpdGVtLml0ZW0/Lm1hcHBpbmdzPy5maW5kKChtOiBhbnkpID0+IG0uY2xpZW50X2lkID09PSBjbGllbnRJZCk7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgaW5kZXg6IGlkeCArIDEsXHJcbiAgICAgICAgICAgICAgaHNuOiBpdGVtLnNhY19jb2RlIHx8IGl0ZW0uaXRlbT8uaHNuX2NvZGUgfHwgJycsXHJcbiAgICAgICAgICAgICAgaXRlbV9jb2RlOiBtYXBwaW5nPy5jbGllbnRfcGFydF9ubyB8fCBpdGVtLml0ZW0/Lml0ZW1fY29kZSB8fCAnJyxcclxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogbWFwcGluZz8uY2xpZW50X2Rlc2NyaXB0aW9uIHx8IGl0ZW0uZGVzY3JpcHRpb24gfHwgaXRlbS5pdGVtPy5kaXNwbGF5X25hbWUgfHwgaXRlbS5pdGVtPy5uYW1lIHx8ICcnLFxyXG4gICAgICAgICAgICAgIHF0eTogU3RyaW5nKGl0ZW0ucXR5IHx8ICcnKSxcclxuICAgICAgICAgICAgICB1b206IGl0ZW0udW9tIHx8ICcnLFxyXG4gICAgICAgICAgICAgIHJhdGU6IGZvcm1hdEN1cnJlbmN5KGl0ZW0ucmF0ZSB8fCAwKSxcclxuICAgICAgICAgICAgICBnc3RfcGVyY2VudDogaXRlbS50YXhfcGVyY2VudCA/IGAke2l0ZW0udGF4X3BlcmNlbnR9JWAgOiAnMTglJyxcclxuICAgICAgICAgICAgICBhbW91bnQ6IGZvcm1hdEN1cnJlbmN5KGl0ZW0ubGluZV90b3RhbCB8fCAwKVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgfSksXHJcblxyXG4gICAgICAgICAgLy8gVG90YWxzXHJcbiAgICAgICAgICBzdWJ0b3RhbDogZm9ybWF0Q3VycmVuY3kocXVvdGF0aW9uLnN1YnRvdGFsIHx8IDApLFxyXG4gICAgICAgICAgY2dzdF9hbW91bnQ6IGZvcm1hdEN1cnJlbmN5KHF1b3RhdGlvbi5jZ3N0X2Ftb3VudCB8fCAwKSxcclxuICAgICAgICAgIHNnc3RfYW1vdW50OiBmb3JtYXRDdXJyZW5jeShxdW90YXRpb24uc2dzdF9hbW91bnQgfHwgMCksXHJcbiAgICAgICAgICByb3VuZF9vZmY6IHF1b3RhdGlvbi5yb3VuZF9vZmYgPyBmb3JtYXRDdXJyZW5jeShxdW90YXRpb24ucm91bmRfb2ZmKSA6ICcwLjAwJyxcclxuICAgICAgICAgIGdyYW5kX3RvdGFsOiBmb3JtYXRDdXJyZW5jeShxdW90YXRpb24uZ3JhbmRfdG90YWwgfHwgMCksXHJcbiAgICAgICAgICBhbW91bnRfaW5fd29yZHM6IHF1b3RhdGlvbi5hbW91bnRfaW5fd29yZHMgfHwgJycsXHJcblxyXG4gICAgICAgICAgLy8gQmFuayBkZXRhaWxzXHJcbiAgICAgICAgICBiYW5rX25hbWU6IG9yZ2FuaXNhdGlvbi5iYW5rX25hbWUgfHwgJycsXHJcbiAgICAgICAgICBiYW5rX2JyYW5jaDogb3JnYW5pc2F0aW9uLmJhbmtfYnJhbmNoIHx8ICcnLFxyXG4gICAgICAgICAgYmFua19hY2NvdW50X25vOiBvcmdhbmlzYXRpb24uYmFua19hY2NvdW50X25vIHx8ICcnLFxyXG4gICAgICAgICAgYmFua19hY2NvdW50X3R5cGU6IG9yZ2FuaXNhdGlvbi5iYW5rX2FjY291bnRfdHlwZSB8fCAnJyxcclxuICAgICAgICAgIGJhbmtfaWZzYzogb3JnYW5pc2F0aW9uLmJhbmtfaWZzYyB8fCAnJyxcclxuICAgICAgICAgIGJhbmtfbWljcjogb3JnYW5pc2F0aW9uLmJhbmtfbWljciB8fCAnJyxcclxuICAgICAgICAgIGJhbmtfc3dpZnQ6IG9yZ2FuaXNhdGlvbi5iYW5rX3N3aWZ0IHx8ICcnLFxyXG4gICAgICAgICAgYmFua191cGk6IG9yZ2FuaXNhdGlvbi5iYW5rX3VwaSB8fCAnJyxcclxuXHJcbiAgICAgICAgICAvLyBTaWduYXRvcnlcclxuICAgICAgICAgIHNpZ25hdG9yeV9kZXNpZ25hdGlvbjogb3JnYW5pc2F0aW9uLnNpZ25hdG9yeV9kZXNpZ25hdGlvbiB8fCAnRGlyZWN0b3IgLyBNYW5hZ2VyJyxcclxuXHJcbiAgICAgICAgICAvLyBUZXJtcyAmIGNvbmRpdGlvbnNcclxuICAgICAgICAgIHRlcm1zX2NvbmRpdGlvbnM6IHF1b3RhdGlvbi50ZXJtc19jb25kaXRpb25zIHx8IG9yZ2FuaXNhdGlvbi50ZXJtc19jb25kaXRpb25zIHx8ICcnXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgY29uc3Qgc2FmZUZpbGVOYW1lID0gU3RyaW5nKHF1b3RhdGlvbi5xdW90YXRpb25fbm8gfHwgJ3F1b3RhdGlvbicpXHJcbiAgICAgICAgICAucmVwbGFjZSgvWzw+OlwiL1xcXFx8PypcXHgwMC1cXHgxRl0vZywgJ18nKVxyXG4gICAgICAgICAgLnJlcGxhY2UoL1xccysvZywgJ18nKTtcclxuXHJcbiAgICAgICAgY29uc3QgYmxvYiA9IGF3YWl0IHJlbmRlclRlbXBsYXRlVG9QZGYodGVtcGxhdGUudGVtcGxhdGVfY29udGVudCB8fCAnJywgaHRtbERhdGEsIGAke3NhZmVGaWxlTmFtZX0ucGRmYCk7XHJcbiAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ2Jsb2InKSByZXR1cm4gYmxvYjtcclxuICAgICAgICBoYW5kbGVPdXRwdXQoYmxvYik7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBTcGVjaWFsIGhhbmRsaW5nIGZvciBTYWFTIFN0eWxlXHJcbiAgICAgIGlmICh0ZW1wbGF0ZT8uY29sdW1uX3NldHRpbmdzPy5wcmludD8uc3R5bGUgPT09ICdzYWFzJykge1xyXG4gICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgIGNvbnRhaW5lci5pZCA9ICdwZGYtY2FwdHVyZS1jb250YWluZXInO1xyXG4gICAgICAgIGNvbnRhaW5lci5zdHlsZS5wb3NpdGlvbiA9ICdmaXhlZCc7XHJcbiAgICAgICAgY29udGFpbmVyLnN0eWxlLmxlZnQgPSAnMCc7XHJcbiAgICAgICAgY29udGFpbmVyLnN0eWxlLnRvcCA9ICcwJztcclxuICAgICAgICBjb250YWluZXIuc3R5bGUud2lkdGggPSAnMjEwbW0nO1xyXG4gICAgICAgIGNvbnRhaW5lci5zdHlsZS5iYWNrZ3JvdW5kID0gJ3doaXRlJztcclxuICAgICAgICBjb250YWluZXIuc3R5bGUuekluZGV4ID0gJy05OTk5JztcclxuICAgICAgICBjb250YWluZXIuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcclxuXHJcbiAgICAgICAgLy8gSW5qZWN0IGZvbnRzIGZvciBjYXB0dXJlXHJcbiAgICAgICAgY29uc3QgZm9udExpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XHJcbiAgICAgICAgZm9udExpbmsucmVsID0gJ3N0eWxlc2hlZXQnO1xyXG4gICAgICAgIGZvbnRMaW5rLmhyZWYgPSAnaHR0cHM6Ly9mb250cy5nb29nbGVhcGlzLmNvbS9jc3MyP2ZhbWlseT1NYW5yb3BlOndnaHRANDAwOzUwMDs2MDA7NzAwOzgwMCZkaXNwbGF5PXN3YXAnO1xyXG4gICAgICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZm9udExpbmspO1xyXG5cclxuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XHJcblxyXG4gICAgICAgIGNvbnN0IHJvb3QgPSBjcmVhdGVSb290KGNvbnRhaW5lcik7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIC8vIEluY2x1ZGUgVGVybXMgJiBDb25kaXRpb25zIGRhdGFcclxuICAgICAgICAgIGNvbnN0IHF1b3RhdGlvbldpdGhUZXJtcyA9IHtcclxuICAgICAgICAgICAgLi4ucXVvdGF0aW9uLFxyXG4gICAgICAgICAgICB0ZXJtc19jb25kaXRpb25zOiB0ZXJtc0NvbmRpdGlvbnNRdWVyeS5kYXRhPy5jdXN0b21fY29udGVudCB8fCBudWxsXHJcbiAgICAgICAgICB9O1xyXG4gICAgICAgICAgZmx1c2hTeW5jKCgpID0+IHtcclxuICAgICAgICAgICAgcm9vdC5yZW5kZXIoPFNhYVNUZW1wbGF0ZSBkYXRhPXtxdW90YXRpb25XaXRoVGVybXN9IG9yZ2FuaXNhdGlvbj17b3JnYW5pc2F0aW9ufSB0ZW1wbGF0ZUNvbmZpZz17dGVtcGxhdGUuY29sdW1uX3NldHRpbmdzfSAvPik7XHJcbiAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAvLyBXYWl0IGxvbmdlciBmb3IgZm9udHMgYW5kIGxheW91dFxyXG4gICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDIwMDApKTtcclxuICAgICAgICAgIGNvbnN0IGJsb2IgPSBhd2FpdCBodG1sVG9QZGYoY29udGFpbmVyLCBgJHtzYWZlRmlsZU5hbWV9LnBkZmApO1xyXG4gICAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ2Jsb2InKSByZXR1cm4gYmxvYjtcclxuICAgICAgICAgIGhhbmRsZU91dHB1dChibG9iKTtcclxuICAgICAgICB9IGNhdGNoIChjYXB0dXJlRXJyKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdTYWFTIFBERiBDYXB0dXJlIEVycm9yOicsIGNhcHR1cmVFcnIpO1xyXG4gICAgICAgICAgdGhyb3cgY2FwdHVyZUVycjtcclxuICAgICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgICAgcm9vdC51bm1vdW50KCk7XHJcbiAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGNvbnRhaW5lcik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gU3BlY2lhbCBoYW5kbGluZyBmb3IgVmVydGljYWwgU3R5bGVcclxuICAgICAgaWYgKHRlbXBsYXRlPy5jb2x1bW5fc2V0dGluZ3M/LnByaW50Py5zdHlsZSA9PT0gJ3ZlcnRpY2FsJyB8fCB0ZW1wbGF0ZT8udGVtcGxhdGVfY29kZSA9PT0gJ1FUTl9WRVJUSUNBTCcpIHtcclxuICAgICAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICBjb250YWluZXIuaWQgPSAncGRmLWNhcHR1cmUtY29udGFpbmVyJztcclxuICAgICAgICBjb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xyXG4gICAgICAgIGNvbnRhaW5lci5zdHlsZS5sZWZ0ID0gJy05OTk5cHgnO1xyXG4gICAgICAgIGNvbnRhaW5lci5zdHlsZS50b3AgPSAnMCc7XHJcbiAgICAgICAgY29udGFpbmVyLnN0eWxlLndpZHRoID0gJzIxMG1tJztcclxuICAgICAgICBjb250YWluZXIuc3R5bGUuYmFja2dyb3VuZCA9ICd3aGl0ZSc7XHJcbiAgICAgICAgY29udGFpbmVyLnN0eWxlLnpJbmRleCA9ICctOTk5OSc7XHJcbiAgICAgICAgY29udGFpbmVyLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XHJcblxyXG4gICAgICAgIC8vIEluamVjdCBmb250cyBmb3IgY2FwdHVyZVxyXG4gICAgICAgIGNvbnN0IGZvbnRMaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGluaycpO1xyXG4gICAgICAgIGZvbnRMaW5rLnJlbCA9ICdzdHlsZXNoZWV0JztcclxuICAgICAgICBmb250TGluay5ocmVmID0gJ2h0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20vY3NzMj9mYW1pbHk9Um9ib3RvOndnaHRANDAwOzUwMDs3MDA7OTAwJmRpc3BsYXk9c3dhcCc7XHJcbiAgICAgICAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChmb250TGluayk7XHJcblxyXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY29udGFpbmVyKTtcclxuXHJcbiAgICAgICAgY29uc3Qgcm9vdCA9IGNyZWF0ZVJvb3QoY29udGFpbmVyKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgLy8gSW5jbHVkZSBUZXJtcyAmIENvbmRpdGlvbnMgZGF0YVxyXG4gICAgICAgICAgY29uc3QgcXVvdGF0aW9uV2l0aFRlcm1zID0ge1xyXG4gICAgICAgICAgICAuLi5xdW90YXRpb24sXHJcbiAgICAgICAgICAgIHRlcm1zX2NvbmRpdGlvbnM6IHRlcm1zQ29uZGl0aW9uc1F1ZXJ5LmRhdGE/LmN1c3RvbV9jb250ZW50IHx8IG51bGxcclxuICAgICAgICAgIH07XHJcbiAgICAgICAgICBmbHVzaFN5bmMoKCkgPT4ge1xyXG4gICAgICAgICAgICByb290LnJlbmRlcig8VmVydGljYWxUZW1wbGF0ZSBkYXRhPXtxdW90YXRpb25XaXRoVGVybXN9IG9yZ2FuaXNhdGlvbj17b3JnYW5pc2F0aW9ufSB0ZW1wbGF0ZUNvbmZpZz17dGVtcGxhdGUuY29sdW1uX3NldHRpbmdzfSAvPik7XHJcbiAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAvLyBXYWl0IGxvbmdlciBmb3IgZm9udHMgYW5kIGxheW91dFxyXG4gICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDMwMDApKTtcclxuICAgICAgICAgIGNvbnN0IGJsb2IgPSBhd2FpdCBodG1sVG9QZGYoY29udGFpbmVyLCBgJHtzYWZlRmlsZU5hbWV9LnBkZmApO1xyXG4gICAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ2Jsb2InKSByZXR1cm4gYmxvYjtcclxuICAgICAgICAgIGhhbmRsZU91dHB1dChibG9iKTtcclxuICAgICAgICB9IGNhdGNoIChjYXB0dXJlRXJyKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdWZXJ0aWNhbCBQREYgQ2FwdHVyZSBFcnJvcjonLCBjYXB0dXJlRXJyKTtcclxuICAgICAgICAgIHRocm93IGNhcHR1cmVFcnI7XHJcbiAgICAgICAgfSBmaW5hbGx5IHtcclxuICAgICAgICAgIHJvb3QudW5tb3VudCgpO1xyXG4gICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChjb250YWluZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIFNwZWNpYWwgaGFuZGxpbmcgZm9yIFpvaG8gVGVtcGxhdGVcclxuICAgICAgaWYgKHRlbXBsYXRlLnRlbXBsYXRlX2NvZGUgPT09ICdRVE5fWk9ITycpIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgY29uc3QgcXVvdGF0aW9uV2l0aFRlcm1zID0ge1xyXG4gICAgICAgICAgICAuLi5xdW90YXRpb24sXHJcbiAgICAgICAgICAgIHRlcm1zX2NvbmRpdGlvbnM6IHRlcm1zQ29uZGl0aW9uc1F1ZXJ5LmRhdGE/LmN1c3RvbV9jb250ZW50IHx8IG51bGxcclxuICAgICAgICAgIH07XHJcbiAgICAgICAgICBjb25zdCB6b2hvRG9jID0gZ2VuZXJhdGVab2hvVGVtcGxhdGUocXVvdGF0aW9uV2l0aFRlcm1zLCBvcmdhbmlzYXRpb24sIHRlbXBsYXRlKTtcclxuICAgICAgICAgIGNvbnN0IGJsb2IgPSB6b2hvRG9jLm91dHB1dCgnYmxvYicpO1xyXG4gICAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ2Jsb2InKSByZXR1cm4gYmxvYjtcclxuICAgICAgICAgIGhhbmRsZU91dHB1dChibG9iKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2VuZXJhdGluZyBab2hvIHRlbXBsYXRlOicsIGVycm9yKTtcclxuICAgICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gU3BlY2lhbCBoYW5kbGluZyBmb3IgQ2xhc3NpYyBUZW1wbGF0ZVxyXG4gICAgICBpZiAodGVtcGxhdGUudGVtcGxhdGVfY29kZSA9PT0gJ1FUTl9DTEFTU0lDJykge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdDbGFzc2ljIHRlbXBsYXRlIGRldGVjdGVkLCB0ZW1wbGF0ZTonLCB0ZW1wbGF0ZSk7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGNvbnN0IHF1b3RhdGlvbldpdGhUZXJtcyA9IHtcclxuICAgICAgICAgICAgLi4ucXVvdGF0aW9uLFxyXG4gICAgICAgICAgICB0ZXJtc19jb25kaXRpb25zOiB0ZXJtc0NvbmRpdGlvbnNRdWVyeS5kYXRhPy5jdXN0b21fY29udGVudCB8fCBudWxsXHJcbiAgICAgICAgICB9O1xyXG4gICAgICAgICAgY29uc29sZS5sb2coJ0dlbmVyYXRpbmcgQ2xhc3NpYyBQREYgd2l0aCB0ZXJtczonLCBxdW90YXRpb25XaXRoVGVybXMudGVybXNfY29uZGl0aW9ucyk7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZygnT3JnYW5pc2F0aW9uIGRhdGE6Jywgb3JnYW5pc2F0aW9uKTtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKCdUZW1wbGF0ZSBzZXR0aW5nczonLCB0ZW1wbGF0ZSk7XHJcbiAgICAgICAgICBjb25zdCBjbGFzc2ljRG9jID0gZ2VuZXJhdGVDbGFzc2ljUXVvdGF0aW9uVGVtcGxhdGUocXVvdGF0aW9uV2l0aFRlcm1zLCBvcmdhbmlzYXRpb24sIHRlbXBsYXRlKTtcclxuICAgICAgICAgIGNvbnN0IHNhZmVGaWxlTmFtZSA9IFN0cmluZyhxdW90YXRpb24ucXVvdGF0aW9uX25vIHx8ICdxdW90YXRpb24nKVxyXG4gICAgICAgICAgICAucmVwbGFjZSgvWzw+OlwiL1xcXFx8PypcXHgwMC1cXHgxRl0vZywgJ18nKVxyXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxzKy9nLCAnXycpO1xyXG4gICAgICAgICAgY29uc3QgYmxvYiA9IGNsYXNzaWNEb2Mub3V0cHV0KCdibG9iJyk7XHJcbiAgICAgICAgICBpZiAoYWN0aW9uID09PSAnYmxvYicpIHJldHVybiBibG9iO1xyXG4gICAgICAgICAgaGFuZGxlT3V0cHV0KGJsb2IpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZW5lcmF0aW5nIENsYXNzaWMgdGVtcGxhdGU6JywgZXJyb3IpO1xyXG4gICAgICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBTcGVjaWFsIGhhbmRsaW5nIGZvciBHcmlkIFBybyBUZW1wbGF0ZVxyXG4gICAgICBpZiAodGVtcGxhdGUudGVtcGxhdGVfY29kZSA9PT0gJ1FUTl9HUklEX1BSTycpIHtcclxuICAgICAgICAvLyBJbmNsdWRlIFRlcm1zICYgQ29uZGl0aW9ucyBkYXRhIGluIHRoZSBxdW90YXRpb24gb2JqZWN0XHJcbiAgICAgICAgY29uc3QgcXVvdGF0aW9uV2l0aFRlcm1zID0ge1xyXG4gICAgICAgICAgLi4ucXVvdGF0aW9uLFxyXG4gICAgICAgICAgdGVybXNfY29uZGl0aW9uczogdGVybXNDb25kaXRpb25zUXVlcnkuZGF0YT8uY3VzdG9tX2NvbnRlbnQgfHwgbnVsbFxyXG4gICAgICAgIH07XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0dlbmVyYXRpbmcgR3JpZCBQcm8gUERGIHdpdGggdGVybXM6JywgcXVvdGF0aW9uV2l0aFRlcm1zLnRlcm1zX2NvbmRpdGlvbnMpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdUZXJtcyBjb25kaXRpb25zIHF1ZXJ5IGRhdGE6JywgdGVybXNDb25kaXRpb25zUXVlcnkuZGF0YSk7XHJcbiAgICAgICAgY29uc3QgZ3JpZERvYyA9IGdlbmVyYXRlUHJvR3JpZFF1b3RhdGlvblBkZihxdW90YXRpb25XaXRoVGVybXMsIG9yZ2FuaXNhdGlvbiwgdGVtcGxhdGUpO1xyXG4gICAgICAgIGNvbnN0IHNhZmVGaWxlTmFtZSA9IFN0cmluZyhxdW90YXRpb24ucXVvdGF0aW9uX25vIHx8ICdxdW90YXRpb24nKVxyXG4gICAgICAgICAgLnJlcGxhY2UoL1s8PjpcIi9cXFxcfD8qXFx4MDAtXFx4MUZdL2csICdfJylcclxuICAgICAgICAgIC5yZXBsYWNlKC9cXHMrL2csICdfJyk7XHJcbiAgICAgICAgY29uc3QgYmxvYiA9IGdyaWREb2Mub3V0cHV0KCdibG9iJyk7XHJcbiAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ2Jsb2InKSByZXR1cm4gYmxvYjtcclxuICAgICAgICBoYW5kbGVPdXRwdXQoYmxvYik7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBTcGVjaWFsIGhhbmRsaW5nIGZvciBFbnRlcnByaXNlIFF1b3RhdGlvbiBUZW1wbGF0ZVxyXG4gICAgICBpZiAodGVtcGxhdGUudGVtcGxhdGVfY29kZSA9PT0gJ1FUTl9FTlRFUlBSSVNFJykge1xyXG4gICAgICAgIGNvbnN0IHF1b3RhdGlvbldpdGhUZXJtcyA9IHtcclxuICAgICAgICAgIC4uLnF1b3RhdGlvbixcclxuICAgICAgICAgIHRlcm1zX2NvbmRpdGlvbnM6IHRlcm1zQ29uZGl0aW9uc1F1ZXJ5LmRhdGE/LmN1c3RvbV9jb250ZW50IHx8IG51bGxcclxuICAgICAgICB9O1xyXG4gICAgICAgIGNvbnN0IGlzSW50ZXJTdGF0ZSA9IHF1b3RhdGlvbi5zdGF0ZSAmJiBvcmdhbmlzYXRpb24/LnN0YXRlICYmXHJcbiAgICAgICAgICBxdW90YXRpb24uc3RhdGUudHJpbSgpLnRvTG93ZXJDYXNlKCkgIT09IG9yZ2FuaXNhdGlvbi5zdGF0ZS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBzZWxlY3RlZFNpZ25hdG9yeSA9IChvcmdhbmlzYXRpb24/LnNpZ25hdHVyZXMgfHwgW10pLmZpbmQocyA9PiBzLmlkID09IHF1b3RhdGlvbi5hdXRob3JpemVkX3NpZ25hdG9yeV9pZCk7XHJcblxyXG4gICAgICAgIGNvbnN0IG9wdHMgPSB7XHJcbiAgICAgICAgICBvcmc6IHtcclxuICAgICAgICAgICAgbmFtZTogb3JnYW5pc2F0aW9uPy5uYW1lIHx8ICcnLFxyXG4gICAgICAgICAgICBhZGRyZXNzOiBvcmdhbmlzYXRpb24/LmFkZHJlc3MgfHwgJycsXHJcbiAgICAgICAgICAgIGNpdHk6IG9yZ2FuaXNhdGlvbj8uY2l0eSB8fCAnJyxcclxuICAgICAgICAgICAgc3RhdGU6IG9yZ2FuaXNhdGlvbj8uc3RhdGUgfHwgJycsXHJcbiAgICAgICAgICAgIHBpbmNvZGU6IG9yZ2FuaXNhdGlvbj8ucGluY29kZSB8fCAnJyxcclxuICAgICAgICAgICAgZ3N0aW46IG9yZ2FuaXNhdGlvbj8uZ3N0aW4gfHwgJycsXHJcbiAgICAgICAgICAgIHBob25lOiBvcmdhbmlzYXRpb24/LnBob25lIHx8ICcnLFxyXG4gICAgICAgICAgICBlbWFpbDogb3JnYW5pc2F0aW9uPy5lbWFpbCB8fCAnJyxcclxuICAgICAgICAgICAgbG9nb191cmw6IG9yZ2FuaXNhdGlvbj8ubG9nb191cmwgfHwgJydcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBjbGllbnQ6IHtcclxuICAgICAgICAgICAgZGlzcGxheV9uYW1lOiBxdW90YXRpb24uY2xpZW50Py5jbGllbnRfbmFtZSB8fCBxdW90YXRpb24uY2xpZW50Py5uYW1lIHx8ICcnLFxyXG4gICAgICAgICAgICBiaWxsaW5nX2FkZHJlc3M6IHF1b3RhdGlvbi5iaWxsaW5nX2FkZHJlc3MgfHwgJycsXHJcbiAgICAgICAgICAgIGdzdGluOiBxdW90YXRpb24uY2xpZW50Py5nc3RpbiB8fCBxdW90YXRpb24uZ3N0aW4gfHwgJycsXHJcbiAgICAgICAgICAgIHN0YXRlOiBxdW90YXRpb24uY2xpZW50Py5zdGF0ZSB8fCBxdW90YXRpb24uc3RhdGUgfHwgJydcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBoZWFkZXI6IHtcclxuICAgICAgICAgICAgcXVvdGF0aW9uX25vOiBxdW90YXRpb24ucXVvdGF0aW9uX25vIHx8ICcnLFxyXG4gICAgICAgICAgICByZXZpc2lvbl9ubzogcXVvdGF0aW9uLnJldmlzaW9uX25vID8gcGFyc2VJbnQocXVvdGF0aW9uLnJldmlzaW9uX25vKSA6IHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgZGF0ZTogZm9ybWF0RGF0ZShxdW90YXRpb24uZGF0ZSksXHJcbiAgICAgICAgICAgIHZhbGlkX3RpbGw6IGZvcm1hdERhdGUocXVvdGF0aW9uLnZhbGlkX3RpbGwpLFxyXG4gICAgICAgICAgICBwYXltZW50X3Rlcm1zOiBxdW90YXRpb24ucGF5bWVudF90ZXJtcyB8fCAnJyxcclxuICAgICAgICAgICAgcmVmZXJlbmNlOiBxdW90YXRpb24ucmVmZXJlbmNlIHx8ICcnLFxyXG4gICAgICAgICAgICBwcmVwYXJlZF9ieTogcXVvdGF0aW9uLnByZXBhcmVkX2J5IHx8ICcnLFxyXG4gICAgICAgICAgICByZW1hcmtzOiBxdW90YXRpb24ucmVtYXJrcyB8fCAnJyxcclxuICAgICAgICAgICAgcHJvamVjdF9uYW1lOiBxdW90YXRpb24ucHJvamVjdD8ucHJvamVjdF9uYW1lIHx8IHF1b3RhdGlvbi5wcm9qZWN0Py5wcm9qZWN0X2NvZGUgfHwgJydcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBpdGVtczogKHF1b3RhdGlvbi5pdGVtcyB8fCBbXSkubWFwKChpdGVtOiBhbnkpID0+ICh7XHJcbiAgICAgICAgICAgIGlzX2hlYWRlcjogaXRlbS5pc19oZWFkZXIsXHJcbiAgICAgICAgICAgIGlzX3N1YnRvdGFsOiBpdGVtLmlzX3N1YnRvdGFsLFxyXG4gICAgICAgICAgICBzdWJ0b3RhbF9sYWJlbDogaXRlbS5zdWJ0b3RhbF9sYWJlbCxcclxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGl0ZW0uZGVzY3JpcHRpb24gfHwgaXRlbS5pdGVtPy5uYW1lIHx8IGl0ZW0uaXRlbT8uZGlzcGxheV9uYW1lIHx8ICcnLFxyXG4gICAgICAgICAgICBpdGVtX2NvZGU6IGl0ZW0uaXRlbV9jb2RlIHx8IGl0ZW0uaXRlbT8uaXRlbV9jb2RlIHx8ICcnLFxyXG4gICAgICAgICAgICBoc25fY29kZTogaXRlbS5zYWNfY29kZSB8fCBpdGVtLml0ZW0/Lmhzbl9jb2RlIHx8ICcnLFxyXG4gICAgICAgICAgICB2YXJpYW50X25hbWU6IGl0ZW0udmFyaWFudD8udmFyaWFudF9uYW1lIHx8ICcnLFxyXG4gICAgICAgICAgICBxdHk6IGl0ZW0ucXR5LFxyXG4gICAgICAgICAgICB1b206IGl0ZW0udW9tLFxyXG4gICAgICAgICAgICBiYXNlX3JhdGVfc25hcHNob3Q6IGl0ZW0uYmFzZV9yYXRlX3NuYXBzaG90IHx8IGl0ZW0ucmF0ZSxcclxuICAgICAgICAgICAgZGlzY291bnRfcGVyY2VudDogaXRlbS5kaXNjb3VudF9wZXJjZW50LFxyXG4gICAgICAgICAgICByYXRlOiBpdGVtLnJhdGUsXHJcbiAgICAgICAgICAgIHRheF9wZXJjZW50OiBpdGVtLnRheF9wZXJjZW50LFxyXG4gICAgICAgICAgICBsaW5lX3RvdGFsOiBpdGVtLmxpbmVfdG90YWwsXHJcbiAgICAgICAgICAgIGN1c3RvbTE6IGl0ZW0uY3VzdG9tMSxcclxuICAgICAgICAgICAgY3VzdG9tMjogaXRlbS5jdXN0b20yXHJcbiAgICAgICAgICB9KSksXHJcbiAgICAgICAgICBjYWxjdWxhdGlvbnM6IHtcclxuICAgICAgICAgICAgc3VidG90YWw6IHF1b3RhdGlvbi5zdWJ0b3RhbCB8fCAwLFxyXG4gICAgICAgICAgICB0b3RhbEl0ZW1EaXNjb3VudDogcXVvdGF0aW9uLnRvdGFsX2l0ZW1fZGlzY291bnQgfHwgMCxcclxuICAgICAgICAgICAgZXh0cmFEaXNjb3VudEFtb3VudDogcXVvdGF0aW9uLmV4dHJhX2Rpc2NvdW50X2Ftb3VudCB8fCAwLFxyXG4gICAgICAgICAgICBjZ3N0OiBpc0ludGVyU3RhdGUgPyAwIDogKHF1b3RhdGlvbi50b3RhbF90YXggfHwgMCkgLyAyLFxyXG4gICAgICAgICAgICBzZ3N0OiBpc0ludGVyU3RhdGUgPyAwIDogKHF1b3RhdGlvbi50b3RhbF90YXggfHwgMCkgLyAyLFxyXG4gICAgICAgICAgICBpZ3N0OiBpc0ludGVyU3RhdGUgPyAocXVvdGF0aW9uLnRvdGFsX3RheCB8fCAwKSA6IDAsXHJcbiAgICAgICAgICAgIGlzSW50ZXJTdGF0ZTogaXNJbnRlclN0YXRlLFxyXG4gICAgICAgICAgICB0b3RhbFRheDogcXVvdGF0aW9uLnRvdGFsX3RheCB8fCAwLFxyXG4gICAgICAgICAgICByb3VuZE9mZjogcXVvdGF0aW9uLnJvdW5kX29mZiB8fCAwLFxyXG4gICAgICAgICAgICBncmFuZFRvdGFsOiBxdW90YXRpb24uZ3JhbmRfdG90YWwgfHwgMCxcclxuICAgICAgICAgICAgYW1vdW50SW5Xb3JkczogcXVvdGF0aW9uLmFtb3VudF9pbl93b3JkcyB8fCAnJ1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIGNvbHVtblNldHRpbmdzOiB0ZW1wbGF0ZS5jb2x1bW5fc2V0dGluZ3MsXHJcbiAgICAgICAgICBzaWduYXRvcnk6IHtcclxuICAgICAgICAgICAgbmFtZTogc2VsZWN0ZWRTaWduYXRvcnk/Lm5hbWUgfHwgJycsXHJcbiAgICAgICAgICAgIGRlc2lnbmF0aW9uOiBvcmdhbmlzYXRpb24/LnNpZ25hdG9yeV9kZXNpZ25hdGlvbiB8fCAnQXV0aG9yaXNlZCBTaWduYXRvcnknLFxyXG4gICAgICAgICAgICBmb3JfY29tcGFueTogb3JnYW5pc2F0aW9uPy5uYW1lIHx8ICcnXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgYmFua0RldGFpbHM6IHtcclxuICAgICAgICAgICAgYmFua19uYW1lOiBvcmdhbmlzYXRpb24/LmJhbmtfbmFtZSxcclxuICAgICAgICAgICAgYnJhbmNoOiBvcmdhbmlzYXRpb24/LmJhbmtfYnJhbmNoLFxyXG4gICAgICAgICAgICBhY2NvdW50X25hbWU6IG9yZ2FuaXNhdGlvbj8uYmFua19hY2NvdW50X25hbWUgfHwgb3JnYW5pc2F0aW9uPy5uYW1lLFxyXG4gICAgICAgICAgICBhY2NvdW50X25vOiBvcmdhbmlzYXRpb24/LmJhbmtfYWNjb3VudF9ubyxcclxuICAgICAgICAgICAgaWZzYzogb3JnYW5pc2F0aW9uPy5iYW5rX2lmc2MsXHJcbiAgICAgICAgICAgIGFjY291bnRfdHlwZTogb3JnYW5pc2F0aW9uPy5iYW5rX2FjY291bnRfdHlwZSxcclxuICAgICAgICAgICAgc3dpZnQ6IG9yZ2FuaXNhdGlvbj8uYmFua19zd2lmdFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHRlcm1zQW5kQ29uZGl0aW9uczogcXVvdGF0aW9uV2l0aFRlcm1zLnRlcm1zX2NvbmRpdGlvbnMgXHJcbiAgICAgICAgICAgID8gcXVvdGF0aW9uV2l0aFRlcm1zLnRlcm1zX2NvbmRpdGlvbnMuc3BsaXQoJ1xcbicpLmZpbHRlcigodDogc3RyaW5nKSA9PiB0LnRyaW0oKS5sZW5ndGggPiAwKVxyXG4gICAgICAgICAgICA6IFsnUGF5bWVudCBhcyBwZXIgdGVybXMgbWVudGlvbmVkIGFib3ZlLicsICdUaGlzIGlzIGEgc3lzdGVtLWdlbmVyYXRlZCBkb2N1bWVudC4nXSxcclxuICAgICAgICAgIGNvbXBhbnlMb2dvQmFzZTY0OiBvcmdhbmlzYXRpb24/LmxvZ29fdXJsIFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGNvbnN0IGVudGVycHJpc2VEb2MgPSBnZW5lcmF0ZVF1b3RhdGlvblBkZihvcHRzIGFzIGFueSk7XHJcbiAgICAgICAgY29uc3Qgc2FmZUZpbGVOYW1lID0gU3RyaW5nKHF1b3RhdGlvbi5xdW90YXRpb25fbm8gfHwgJ3F1b3RhdGlvbicpXHJcbiAgICAgICAgICAucmVwbGFjZSgvWzw+OlwiL1xcXFx8PypcXHgwMC1cXHgxRl0vZywgJ18nKVxyXG4gICAgICAgICAgLnJlcGxhY2UoL1xccysvZywgJ18nKTtcclxuICAgICAgICBjb25zdCBibG9iID0gZW50ZXJwcmlzZURvYy5vdXRwdXQoJ2Jsb2InKTtcclxuICAgICAgICBpZiAoYWN0aW9uID09PSAnYmxvYicpIHJldHVybiBibG9iO1xyXG4gICAgICAgIGhhbmRsZU91dHB1dChibG9iKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIFNwZWNpYWwgaGFuZGxpbmcgZm9yIFNha3RoaSBUZW1wbGF0ZVxyXG4gICAgICBpZiAodGVtcGxhdGU/LmNvbHVtbl9zZXR0aW5ncz8ucHJpbnQ/LnN0eWxlID09PSAnc2FrdGhpJyB8fCB0ZW1wbGF0ZT8udGVtcGxhdGVfY29kZSA9PT0gJ1FUTl9TQUtUSEknKSB7XHJcbiAgICAgICAgY29uc3QgcXVvdGF0aW9uV2l0aFRlcm1zID0ge1xyXG4gICAgICAgICAgLi4ucXVvdGF0aW9uLFxyXG4gICAgICAgICAgdGVybXNfY29uZGl0aW9uczogdGVybXNDb25kaXRpb25zUXVlcnkuZGF0YT8uY3VzdG9tX2NvbnRlbnQgfHwgbnVsbFxyXG4gICAgICAgIH07XHJcbiAgICAgICAgY29uc3Qgc2FrdGhpRG9jID0gYXdhaXQgZ2VuZXJhdGVTYWt0aGlQZGYocXVvdGF0aW9uV2l0aFRlcm1zLCBvcmdhbmlzYXRpb24sICdRdW90YXRpb24nLCB0ZW1wbGF0ZSk7XHJcbiAgICAgICAgY29uc3QgYmxvYiA9IHNha3RoaURvYy5vdXRwdXQoJ2Jsb2InKTtcclxuICAgICAgICBpZiAoYWN0aW9uID09PSAnYmxvYicpIHJldHVybiBibG9iO1xyXG4gICAgICAgIGhhbmRsZU91dHB1dChibG9iKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IGlzTGFuZHNjYXBlID0gdGVtcGxhdGUub3JpZW50YXRpb24gPT09ICdMYW5kc2NhcGUnO1xyXG4gICAgICBjb25zdCBkb2MgPSBuZXcganNQREYoe1xyXG4gICAgICAgIG9yaWVudGF0aW9uOiBpc0xhbmRzY2FwZSA/ICdsYW5kc2NhcGUnIDogJ3BvcnRyYWl0JyxcclxuICAgICAgICB1bml0OiAnbW0nLFxyXG4gICAgICAgIGZvcm1hdDogdGVtcGxhdGUucGFnZV9zaXplID09PSAnTGV0dGVyJyA/ICdsZXR0ZXInIDogJ2E0J1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNvbnN0IGNvbFNldHRpbmdzID0gKHRlbXBsYXRlICYmIHR5cGVvZiB0ZW1wbGF0ZS5jb2x1bW5fc2V0dGluZ3MgPT09ICdvYmplY3QnICYmIHRlbXBsYXRlLmNvbHVtbl9zZXR0aW5ncykgfHwge307XHJcbiAgICAgIGNvbnN0IG9wdGlvbmFsQ29scyA9IGNvbFNldHRpbmdzLm9wdGlvbmFsIHx8IHt9O1xyXG4gICAgICBjb25zdCBsYWJlbHMgPSBjb2xTZXR0aW5ncy5sYWJlbHMgfHwge307XHJcblxyXG4gICAgICBjb25zdCBjb2x1bW5Db25maWcgPSBbXTtcclxuICAgICAgaWYgKG9wdGlvbmFsQ29scy5zbm8gIT09IGZhbHNlKSBjb2x1bW5Db25maWcucHVzaCh7IGhlYWRlcjogJyMnLCBrZXk6ICdzbm8nLCB3aWR0aDogMTAgfSk7XHJcbiAgICAgIGlmIChvcHRpb25hbENvbHMuaHNuX2NvZGUpIGNvbHVtbkNvbmZpZy5wdXNoKHsgaGVhZGVyOiAnSFNOL1NBQycsIGtleTogJ2hzbl9jb2RlJywgd2lkdGg6IDIwIH0pO1xyXG4gICAgICBpZiAob3B0aW9uYWxDb2xzLml0ZW0gIT09IGZhbHNlKSBjb2x1bW5Db25maWcucHVzaCh7IGhlYWRlcjogJ0l0ZW0nLCBrZXk6ICdpdGVtJywgd2lkdGg6IDQ1IH0pO1xyXG4gICAgICBpZiAob3B0aW9uYWxDb2xzLml0ZW1fY29kZSkgY29sdW1uQ29uZmlnLnB1c2goeyBoZWFkZXI6ICdQYXJ0IE5vJywga2V5OiAnaXRlbV9jb2RlJywgd2lkdGg6IDI1IH0pO1xyXG4gICAgICBpZiAob3B0aW9uYWxDb2xzLm1ha2UpIGNvbHVtbkNvbmZpZy5wdXNoKHsgaGVhZGVyOiAnTWFrZScsIGtleTogJ21ha2UnLCB3aWR0aDogMjUgfSk7XHJcbiAgICAgIGlmIChvcHRpb25hbENvbHMudmFyaWFudCkgY29sdW1uQ29uZmlnLnB1c2goeyBoZWFkZXI6ICdEaXNjb3VudCBDYXRlZ29yeScsIGtleTogJ3ZhcmlhbnQnLCB3aWR0aDogMjUgfSk7XHJcbiAgICAgIGlmIChvcHRpb25hbENvbHMuZGVzY3JpcHRpb24pIGNvbHVtbkNvbmZpZy5wdXNoKHsgaGVhZGVyOiAnRGVzY3JpcHRpb24nLCBrZXk6ICdkZXNjcmlwdGlvbicsIHdpZHRoOiA0MCB9KTtcclxuICAgICAgaWYgKG9wdGlvbmFsQ29scy5xdHkgIT09IGZhbHNlKSBjb2x1bW5Db25maWcucHVzaCh7IGhlYWRlcjogJ1F0eScsIGtleTogJ3F0eScsIHdpZHRoOiAxMiwgYWxpZ246ICdyaWdodCcgfSk7XHJcbiAgICAgIGlmIChvcHRpb25hbENvbHMudW9tICE9PSBmYWxzZSkgY29sdW1uQ29uZmlnLnB1c2goeyBoZWFkZXI6ICdVbml0Jywga2V5OiAndW9tJywgd2lkdGg6IDE1IH0pO1xyXG5cclxuICAgICAgLy8gUmF0ZSAoQmVmb3JlIERpc2NvdW50KVxyXG4gICAgICBpZiAob3B0aW9uYWxDb2xzLnJhdGUpIHtcclxuICAgICAgICBjb2x1bW5Db25maWcucHVzaCh7IGhlYWRlcjogJ1JhdGUnLCBrZXk6ICdiYXNlX3JhdGUnLCB3aWR0aDogMjIsIGFsaWduOiAncmlnaHQnIH0pO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBEaXNjb3VudCAlXHJcbiAgICAgIGlmIChvcHRpb25hbENvbHMuZGlzY291bnRfcGVyY2VudCkge1xyXG4gICAgICAgIGNvbHVtbkNvbmZpZy5wdXNoKHsgaGVhZGVyOiAnRGlzYyAlJywga2V5OiAnZGlzY291bnRfcGVyY2VudCcsIHdpZHRoOiAxNSwgYWxpZ246ICdyaWdodCcgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIFJhdGUvVW5pdCAoQWZ0ZXIgRGlzY291bnQpXHJcbiAgICAgIGlmIChvcHRpb25hbENvbHMucmF0ZV9hZnRlcl9kaXNjb3VudCkge1xyXG4gICAgICAgIGNvbHVtbkNvbmZpZy5wdXNoKHtcclxuICAgICAgICAgIGhlYWRlcjogbGFiZWxzLnJhdGVfYWZ0ZXJfZGlzY291bnQgfHwgJ1JhdGUvVW5pdCcsXHJcbiAgICAgICAgICBrZXk6ICdyYXRlX2FmdGVyX2Rpc2NvdW50JyxcclxuICAgICAgICAgIHdpZHRoOiAyMixcclxuICAgICAgICAgIGFsaWduOiAncmlnaHQnXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChvcHRpb25hbENvbHMudGF4X3BlcmNlbnQpIGNvbHVtbkNvbmZpZy5wdXNoKHsgaGVhZGVyOiAnVGF4ICUnLCBrZXk6ICd0YXhfcGVyY2VudCcsIHdpZHRoOiAxNSwgYWxpZ246ICdyaWdodCcgfSk7XHJcblxyXG4gICAgICAvLyBDdXN0b20gY29sdW1uc1xyXG4gICAgICBpZiAob3B0aW9uYWxDb2xzLmN1c3RvbTEpIHtcclxuICAgICAgICBjb2x1bW5Db25maWcucHVzaCh7IGhlYWRlcjogbGFiZWxzLmN1c3RvbTEgfHwgJ0N1c3RvbSAxJywga2V5OiAnY3VzdG9tMScsIHdpZHRoOiAyMiB9KTtcclxuICAgICAgfVxyXG4gICAgICBpZiAob3B0aW9uYWxDb2xzLmN1c3RvbTIpIHtcclxuICAgICAgICBjb2x1bW5Db25maWcucHVzaCh7IGhlYWRlcjogbGFiZWxzLmN1c3RvbTIgfHwgJ0N1c3RvbSAyJywga2V5OiAnY3VzdG9tMicsIHdpZHRoOiAyMiB9KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29sdW1uQ29uZmlnLnB1c2goeyBoZWFkZXI6ICdBbW91bnQnLCBrZXk6ICdsaW5lX3RvdGFsJywgd2lkdGg6IDI4LCBhbGlnbjogJ3JpZ2h0JyB9KTtcclxuXHJcbiAgICAgIGxldCBzdGFydFkgPSA0MDtcclxuXHJcbiAgICAgIGlmICh0ZW1wbGF0ZS5zaG93X2xvZ28gIT09IGZhbHNlKSB7XHJcbiAgICAgICAgZG9jLnNldEZvbnRTaXplKDIwKTtcclxuICAgICAgICBkb2Muc2V0Rm9udCgnaGVsdmV0aWNhJywgJ2JvbGQnKTtcclxuICAgICAgICBkb2MudGV4dCgnUXVvdGF0aW9uJywgMTA1LCAyMCwgeyBhbGlnbjogJ2NlbnRlcicgfSk7XHJcbiAgICAgICAgc3RhcnRZID0gMzU7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZG9jLnNldEZvbnRTaXplKDIwKTtcclxuICAgICAgICBkb2Muc2V0Rm9udCgnaGVsdmV0aWNhJywgJ2JvbGQnKTtcclxuICAgICAgICBkb2MudGV4dCgnUXVvdGF0aW9uJywgMTA1LCAxNSwgeyBhbGlnbjogJ2NlbnRlcicgfSk7XHJcbiAgICAgICAgc3RhcnRZID0gMjU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGRvYy5zZXRGb250U2l6ZSgxMCk7XHJcbiAgICAgIGRvYy5zZXRGb250KCdoZWx2ZXRpY2EnLCAnbm9ybWFsJyk7XHJcbiAgICAgIGRvYy50ZXh0KGBObzogJHtxdW90YXRpb24ucXVvdGF0aW9uX25vfWAsIDE0LCBzdGFydFkpO1xyXG4gICAgICBkb2MudGV4dChgRGF0ZTogJHtmb3JtYXREYXRlKHF1b3RhdGlvbi5kYXRlKX1gLCAxNCwgc3RhcnRZICsgNik7XHJcbiAgICAgIGRvYy50ZXh0KGBWYWxpZCBUaWxsOiAke2Zvcm1hdERhdGUocXVvdGF0aW9uLnZhbGlkX3RpbGwpfWAsIDE0LCBzdGFydFkgKyAxMik7XHJcblxyXG4gICAgICBkb2MudGV4dCgnVG86JywgMTQsIHN0YXJ0WSArIDIyKTtcclxuICAgICAgZG9jLnNldEZvbnQoJ2hlbHZldGljYScsICdib2xkJyk7XHJcbiAgICAgIGRvYy50ZXh0KHF1b3RhdGlvbi5jbGllbnQ/LmNsaWVudF9uYW1lIHx8ICcnLCAxNCwgc3RhcnRZICsgMjgpO1xyXG5cclxuICAgICAgZG9jLnNldEZvbnQoJ2hlbHZldGljYScsICdub3JtYWwnKTtcclxuICAgICAgZG9jLnNldEZvbnRTaXplKDkpO1xyXG4gICAgICBpZiAocXVvdGF0aW9uLmJpbGxpbmdfYWRkcmVzcykge1xyXG4gICAgICAgIGNvbnN0IGFkZHJlc3NMaW5lcyA9IGRvYy5zcGxpdFRleHRUb1NpemUocXVvdGF0aW9uLmJpbGxpbmdfYWRkcmVzcywgNzApO1xyXG4gICAgICAgIGRvYy50ZXh0KGFkZHJlc3NMaW5lcywgMTQsIHN0YXJ0WSArIDM0KTtcclxuICAgICAgfVxyXG4gICAgICBkb2MudGV4dChgR1NUSU46ICR7cXVvdGF0aW9uLmdzdGluIHx8ICctJ31gLCAxNCwgc3RhcnRZICsgNDgpO1xyXG4gICAgICBkb2MudGV4dChgU3RhdGU6ICR7cXVvdGF0aW9uLnN0YXRlIHx8ICctJ31gLCAxNCwgc3RhcnRZICsgNTQpO1xyXG5cclxuICAgICAgY29uc3QgcmlnaHRDb2wgPSBpc0xhbmRzY2FwZSA/IDE0MCA6IDEyMDtcclxuICAgICAgaWYgKHF1b3RhdGlvbi5wcm9qZWN0KSB7XHJcbiAgICAgICAgZG9jLnRleHQoYFByb2plY3Q6ICR7cXVvdGF0aW9uLnByb2plY3QucHJvamVjdF9uYW1lIHx8IHF1b3RhdGlvbi5wcm9qZWN0LnByb2plY3RfY29kZSB8fCAnLSd9YCwgcmlnaHRDb2wsIHN0YXJ0WSArIDIyKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgdGFibGVEYXRhID0gKHF1b3RhdGlvbi5pdGVtcyB8fCBbXSkubWFwKChpdGVtLCBpbmRleCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gaXRlbS5pdGVtIHx8IHt9O1xyXG4gICAgICAgIGNvbnN0IHJvdyA9IHt9O1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMuc25vICE9PSBmYWxzZSkgcm93LnNubyA9IGluZGV4ICsgMTtcclxuICAgICAgICBjb25zdCBjbGllbnRJZCA9IHF1b3RhdGlvbi5jbGllbnRfaWQgfHwgcXVvdGF0aW9uLmNsaWVudD8uaWQ7XHJcbiAgICAgICAgY29uc3QgbWFwcGluZyA9IGNsaWVudElkICYmIG1hdGVyaWFsPy5tYXBwaW5ncz8uZmluZCgobTogYW55KSA9PiBtLmNsaWVudF9pZCA9PT0gY2xpZW50SWQpO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMuaHNuX2NvZGUpIHJvdy5oc25fY29kZSA9IGl0ZW0uc2FjX2NvZGUgfHwgbWF0ZXJpYWwuaHNuX2NvZGUgfHwgJy0nO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMuaXRlbSAhPT0gZmFsc2UpIHJvdy5pdGVtID0gbWFwcGluZz8uY2xpZW50X2Rlc2NyaXB0aW9uIHx8IGl0ZW0uZGVzY3JpcHRpb24gfHwgbWF0ZXJpYWwubmFtZSB8fCAnLSc7XHJcbiAgICAgICAgaWYgKG9wdGlvbmFsQ29scy5pdGVtX2NvZGUpIHJvdy5pdGVtX2NvZGUgPSBtYXBwaW5nPy5jbGllbnRfcGFydF9ubyB8fCBtYXRlcmlhbC5pdGVtX2NvZGUgfHwgJy0nO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMubWFrZSkgcm93Lm1ha2UgPSBpdGVtLm1ha2UgfHwgJy0nO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMudmFyaWFudCkgcm93LnZhcmlhbnQgPSBpdGVtLnZhcmlhbnQ/LnZhcmlhbnRfbmFtZSB8fCAnLSc7XHJcbiAgICAgICAgaWYgKG9wdGlvbmFsQ29scy5kZXNjcmlwdGlvbikgcm93LmRlc2NyaXB0aW9uID0gbWFwcGluZz8uY2xpZW50X2Rlc2NyaXB0aW9uIHx8IGl0ZW0uZGVzY3JpcHRpb24gfHwgJy0nO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMucXR5ICE9PSBmYWxzZSkgcm93LnF0eSA9IGl0ZW0ucXR5O1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMudW9tICE9PSBmYWxzZSkgcm93LnVvbSA9IGl0ZW0udW9tO1xyXG5cclxuICAgICAgICBpZiAob3B0aW9uYWxDb2xzLnJhdGUpIHJvdy5iYXNlX3JhdGUgPSBmb3JtYXRDdXJyZW5jeU5vU3ltYm9sKGl0ZW0uYmFzZV9yYXRlX3NuYXBzaG90IHx8IGl0ZW0ucmF0ZSk7XHJcbiAgICAgICAgaWYgKG9wdGlvbmFsQ29scy5kaXNjb3VudF9wZXJjZW50KSByb3cuZGlzY291bnRfcGVyY2VudCA9IGAke2l0ZW0uZGlzY291bnRfcGVyY2VudH0lYDtcclxuICAgICAgICBpZiAob3B0aW9uYWxDb2xzLnJhdGVfYWZ0ZXJfZGlzY291bnQpIHJvdy5yYXRlX2FmdGVyX2Rpc2NvdW50ID0gZm9ybWF0Q3VycmVuY3lOb1N5bWJvbChpdGVtLnJhdGUpO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMudGF4X3BlcmNlbnQpIHJvdy50YXhfcGVyY2VudCA9IGAke2l0ZW0udGF4X3BlcmNlbnR9JWA7XHJcblxyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMuY3VzdG9tMSkgcm93LmN1c3RvbTEgPSBpdGVtLmN1c3RvbTEgfHwgJy0nO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMuY3VzdG9tMikgcm93LmN1c3RvbTIgPSBpdGVtLmN1c3RvbTIgfHwgJy0nO1xyXG5cclxuICAgICAgICByb3cubGluZV90b3RhbCA9IGZvcm1hdEN1cnJlbmN5Tm9TeW1ib2woaXRlbS5saW5lX3RvdGFsKTtcclxuICAgICAgICByZXR1cm4gcm93O1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNvbnN0IHRhYmxlU3RhcnRZID0gc3RhcnRZICsgNjA7XHJcblxyXG4gICAgICBhdXRvVGFibGUoZG9jLCB7XHJcbiAgICAgICAgc3RhcnRZOiB0YWJsZVN0YXJ0WSxcclxuICAgICAgICBoZWFkOiBbY29sdW1uQ29uZmlnLm1hcCgoY29sKSA9PiBjb2wuaGVhZGVyKV0sXHJcbiAgICAgICAgYm9keTogdGFibGVEYXRhLm1hcCgocm93KSA9PiBjb2x1bW5Db25maWcubWFwKChjb2wpID0+IHJvd1tjb2wua2V5XSkpLFxyXG4gICAgICAgIHRoZW1lOiAnZ3JpZCcsXHJcbiAgICAgICAgaGVhZFN0eWxlczogeyBmaWxsQ29sb3I6IFs2NiwgNjYsIDY2XSwgZm9udFNpemU6IDggfSxcclxuICAgICAgICBzdHlsZXM6IHsgZm9udFNpemU6IDgsIGNlbGxQYWRkaW5nOiAyIH0sXHJcbiAgICAgICAgY29sdW1uU3R5bGVzOiBjb2x1bW5Db25maWcucmVkdWNlKChhY2MsIGNvbCwgaWR4KSA9PiB7XHJcbiAgICAgICAgICBpZiAoY29sLmFsaWduID09PSAncmlnaHQnKSBhY2NbaWR4XSA9IHsgaGFsaWduOiAncmlnaHQnIH07XHJcbiAgICAgICAgICByZXR1cm4gYWNjO1xyXG4gICAgICAgIH0sIHt9KVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNvbnN0IGZpbmFsWSA9IChkb2MubGFzdEF1dG9UYWJsZT8uZmluYWxZIHx8IHRhYmxlU3RhcnRZICsgMTApICsgMTA7XHJcbiAgICAgIGNvbnN0IHN1bW1hcnlYID0gaXNMYW5kc2NhcGUgPyAyMDAgOiAxNjA7XHJcblxyXG4gICAgICBkb2Muc2V0Rm9udFNpemUoOSk7XHJcbiAgICAgIGRvYy50ZXh0KCdTdWJ0b3RhbDonLCBzdW1tYXJ5WCwgZmluYWxZKTtcclxuICAgICAgZG9jLnRleHQoZm9ybWF0Q3VycmVuY3kocXVvdGF0aW9uLnN1YnRvdGFsKSwgc3VtbWFyeVggKyAzNSwgZmluYWxZLCB7IGFsaWduOiAncmlnaHQnIH0pO1xyXG5cclxuICAgICAgZG9jLnRleHQoJ0l0ZW0gRGlzY291bnQ6Jywgc3VtbWFyeVgsIGZpbmFsWSArIDYpO1xyXG4gICAgICBkb2MudGV4dChgLSR7Zm9ybWF0Q3VycmVuY3kocXVvdGF0aW9uLnRvdGFsX2l0ZW1fZGlzY291bnQpfWAsIHN1bW1hcnlYICsgMzUsIGZpbmFsWSArIDYsIHsgYWxpZ246ICdyaWdodCcgfSk7XHJcblxyXG4gICAgICBkb2MudGV4dCgnRXh0cmEgRGlzY291bnQ6Jywgc3VtbWFyeVgsIGZpbmFsWSArIDEyKTtcclxuICAgICAgZG9jLnRleHQoYC0ke2Zvcm1hdEN1cnJlbmN5KHF1b3RhdGlvbi5leHRyYV9kaXNjb3VudF9hbW91bnQpfWAsIHN1bW1hcnlYICsgMzUsIGZpbmFsWSArIDEyLCB7IGFsaWduOiAncmlnaHQnIH0pO1xyXG5cclxuICAgICAgY29uc3QgaXNJbnRlclN0YXRlID0gcXVvdGF0aW9uLnN0YXRlICYmIG9yZ2FuaXNhdGlvbj8uc3RhdGUgJiZcclxuICAgICAgICBxdW90YXRpb24uc3RhdGUudHJpbSgpLnRvTG93ZXJDYXNlKCkgIT09IG9yZ2FuaXNhdGlvbi5zdGF0ZS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuICAgICAgaWYgKGlzSW50ZXJTdGF0ZSkge1xyXG4gICAgICAgIGRvYy50ZXh0KCdJR1NUOicsIHN1bW1hcnlYLCBmaW5hbFkgKyAxOCk7XHJcbiAgICAgICAgZG9jLnRleHQoZm9ybWF0Q3VycmVuY3kocXVvdGF0aW9uLnRvdGFsX3RheCksIHN1bW1hcnlYICsgMzUsIGZpbmFsWSArIDE4LCB7IGFsaWduOiAncmlnaHQnIH0pO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGRvYy50ZXh0KCdDR1NUOicsIHN1bW1hcnlYLCBmaW5hbFkgKyAxOCk7XHJcbiAgICAgICAgZG9jLnRleHQoZm9ybWF0Q3VycmVuY3kocXVvdGF0aW9uLnRvdGFsX3RheCAvIDIpLCBzdW1tYXJ5WCArIDM1LCBmaW5hbFkgKyAxOCwgeyBhbGlnbjogJ3JpZ2h0JyB9KTtcclxuICAgICAgICBkb2MudGV4dCgnU0dTVDonLCBzdW1tYXJ5WCwgZmluYWxZICsgMjQpO1xyXG4gICAgICAgIGRvYy50ZXh0KGZvcm1hdEN1cnJlbmN5KHF1b3RhdGlvbi50b3RhbF90YXggLyAyKSwgc3VtbWFyeVggKyAzNSwgZmluYWxZICsgMjQsIHsgYWxpZ246ICdyaWdodCcgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IG9mZnNldCA9IGlzSW50ZXJTdGF0ZSA/IDI0IDogMzA7XHJcbiAgICAgIGRvYy50ZXh0KCdSb3VuZCBPZmY6Jywgc3VtbWFyeVgsIGZpbmFsWSArIG9mZnNldCk7XHJcbiAgICAgIGRvYy50ZXh0KGZvcm1hdEN1cnJlbmN5KHF1b3RhdGlvbi5yb3VuZF9vZmYpLCBzdW1tYXJ5WCArIDM1LCBmaW5hbFkgKyBvZmZzZXQsIHsgYWxpZ246ICdyaWdodCcgfSk7XHJcblxyXG4gICAgICBkb2Muc2V0Rm9udFNpemUoMTEpO1xyXG4gICAgICBkb2Muc2V0Rm9udCgnaGVsdmV0aWNhJywgJ2JvbGQnKTtcclxuICAgICAgY29uc3QgZ3JhbmRUb3RhbE9mZnNldCA9IGlzSW50ZXJTdGF0ZSA/IDM0IDogNDA7XHJcbiAgICAgIGRvYy50ZXh0KCdHcmFuZCBUb3RhbDonLCBzdW1tYXJ5WCwgZmluYWxZICsgZ3JhbmRUb3RhbE9mZnNldCk7XHJcbiAgICAgIGRvYy50ZXh0KGZvcm1hdEN1cnJlbmN5KHF1b3RhdGlvbi5ncmFuZF90b3RhbCksIHN1bW1hcnlYICsgMzUsIGZpbmFsWSArIGdyYW5kVG90YWxPZmZzZXQsIHsgYWxpZ246ICdyaWdodCcgfSk7XHJcblxyXG4gICAgICBkb2Muc2V0Rm9udCgnaGVsdmV0aWNhJywgJ25vcm1hbCcpO1xyXG4gICAgICBkb2Muc2V0Rm9udFNpemUoOSk7XHJcbiAgICAgIGRvYy50ZXh0KGBQYXltZW50IFRlcm1zOiAke3F1b3RhdGlvbi5wYXltZW50X3Rlcm1zIHx8ICctJ31gLCAxNCwgZmluYWxZICsgZ3JhbmRUb3RhbE9mZnNldCk7XHJcblxyXG4gICAgICBpZiAocXVvdGF0aW9uLmNvbnRhY3Rfbm8pIHtcclxuICAgICAgICBkb2MudGV4dChgQ29udGFjdCBObzogJHtxdW90YXRpb24uY29udGFjdF9ub31gLCAxNCwgZmluYWxZICsgKGlzSW50ZXJTdGF0ZSA/IDQyIDogNDgpKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgcmVtYXJrc1RleHQgPSBxdW90YXRpb24ucmVtYXJrcyB8fCBxdW90YXRpb24ucmVmZXJlbmNlO1xyXG4gICAgICBpZiAocmVtYXJrc1RleHQpIHtcclxuICAgICAgICBkb2MudGV4dChgUmVtYXJrczogJHtyZW1hcmtzVGV4dH1gLCAxNCwgZmluYWxZICsgKGlzSW50ZXJTdGF0ZSA/IDUwIDogNTYpKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHRlbXBsYXRlLnNob3dfdGVybXMgIT09IGZhbHNlKSB7XHJcbiAgICAgICAgZG9jLnNldEZvbnRTaXplKDgpO1xyXG4gICAgICAgIGNvbnN0IHRlcm1zU3RhcnQgPSBmaW5hbFkgKyAoaXNJbnRlclN0YXRlID8gNTggOiA2NCk7XHJcbiAgICAgICAgZG9jLnRleHQoJ1Rlcm1zICYgQ29uZGl0aW9uczonLCAxNCwgdGVybXNTdGFydCk7XHJcbiAgICAgICAgZG9jLnRleHQoJzEuIFBheW1lbnQgYXMgcGVyIHRlcm1zIG1lbnRpb25lZCBhYm92ZS4nLCAxNCwgdGVybXNTdGFydCArIDYpO1xyXG4gICAgICAgIGRvYy50ZXh0KCcyLiBUaGlzIGlzIGEgc3lzdGVtLWdlbmVyYXRlZCBkb2N1bWVudC4nLCAxNCwgdGVybXNTdGFydCArIDEyKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHRlbXBsYXRlLnNob3dfc2lnbmF0dXJlICE9PSBmYWxzZSkge1xyXG4gICAgICAgIGNvbnN0IHNpZ25TdGFydCA9IGZpbmFsWSArIChpc0ludGVyU3RhdGUgPyA1OCA6IDY0KTtcclxuICAgICAgICBkb2MudGV4dChgRm9yLCAke29yZ2FuaXNhdGlvbj8ubmFtZSB8fCAnQ29tcGFueSBOYW1lJ31gLCAxNDAsIHNpZ25TdGFydCk7XHJcblxyXG4gICAgICAgIC8vIEZpbmQgc2VsZWN0ZWQgc2lnbmF0dXJlXHJcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRTaWduYXRvcnkgPSAob3JnYW5pc2F0aW9uPy5zaWduYXR1cmVzIHx8IFtdKS5maW5kKHMgPT4gcy5pZCA9PSBxdW90YXRpb24uYXV0aG9yaXplZF9zaWduYXRvcnlfaWQpO1xyXG4gICAgICAgIGlmIChzZWxlY3RlZFNpZ25hdG9yeT8udXJsKSB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAvLyBOZWVkIHRvIGNvbnZlcnQgdG8gYmFzZTY0IG9yIGVuc3VyZSBDT1JTIGZvciBhZGRJbWFnZVxyXG4gICAgICAgICAgICBkb2MuYWRkSW1hZ2Uoc2VsZWN0ZWRTaWduYXRvcnkudXJsLCAnUE5HJywgMTQwLCBzaWduU3RhcnQgKyAyLCAzMCwgMTUpO1xyXG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1NpZ24gaW1hZ2UgZXJyb3I6JywgZSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBkb2MudGV4dChzZWxlY3RlZFNpZ25hdG9yeT8ubmFtZSB8fCAnQXV0aG9yaXplZCBTaWduYXR1cmUnLCAxNDAsIHNpZ25TdGFydCArIDIwKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgYmxvYiA9IGRvYy5vdXRwdXQoJ2Jsb2InKTtcclxuICAgICAgaWYgKGFjdGlvbiA9PT0gJ2Jsb2InKSByZXR1cm4gYmxvYjtcclxuICAgICAgaGFuZGxlT3V0cHV0KGJsb2IpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdlbmVyYXRpbmcgUERGOicsIGVycik7XHJcbiAgICAgIGFsZXJ0KCdQREYgZXhwb3J0IGZhaWxlZC4gUGxlYXNlIGNoZWNrIHRlbXBsYXRlIHNldHRpbmdzIGFuZCB0cnkgYWdhaW4uJyk7XHJcbiAgICB9IGZpbmFsbHkge1xyXG4gICAgICBzZXRQcmludExvYWRpbmcoZmFsc2UpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IGdlbmVyYXRlUXVvdGF0aW9uSFRNTCA9ICh0ZW1wbGF0ZSkgPT4ge1xyXG4gICAgY29uc3QgY29sU2V0dGluZ3MgPSB0ZW1wbGF0ZS5jb2x1bW5fc2V0dGluZ3MgfHwge307XHJcbiAgICBjb25zdCBvcHRpb25hbENvbHMgPSBjb2xTZXR0aW5ncy5vcHRpb25hbCB8fCB7fTtcclxuICAgIGNvbnN0IGxhYmVscyA9IGNvbFNldHRpbmdzLmxhYmVscyB8fCB7fTtcclxuXHJcbiAgICBsZXQgY29sdW1uc0hUTUwgPSAnJztcclxuICAgIGlmIChvcHRpb25hbENvbHMuc25vICE9PSBmYWxzZSkgY29sdW1uc0hUTUwgKz0gJzx0aD4jPC90aD4nO1xyXG4gICAgaWYgKG9wdGlvbmFsQ29scy5oc25fY29kZSkgY29sdW1uc0hUTUwgKz0gJzx0aD5IU04vU0FDPC90aD4nO1xyXG4gICAgaWYgKG9wdGlvbmFsQ29scy5pdGVtICE9PSBmYWxzZSkgY29sdW1uc0hUTUwgKz0gJzx0aD5JdGVtPC90aD4nO1xyXG4gICAgaWYgKG9wdGlvbmFsQ29scy52YXJpYW50KSBjb2x1bW5zSFRNTCArPSAnPHRoPkRpc2NvdW50IENhdGVnb3J5PC90aD4nO1xyXG4gICAgaWYgKG9wdGlvbmFsQ29scy5kZXNjcmlwdGlvbikgY29sdW1uc0hUTUwgKz0gJzx0aD5EZXNjcmlwdGlvbjwvdGg+JztcclxuICAgIGlmIChvcHRpb25hbENvbHMucXR5ICE9PSBmYWxzZSkgY29sdW1uc0hUTUwgKz0gJzx0aD5RdHk8L3RoPic7XHJcbiAgICBpZiAob3B0aW9uYWxDb2xzLnVvbSAhPT0gZmFsc2UpIGNvbHVtbnNIVE1MICs9ICc8dGg+VW5pdDwvdGg+JztcclxuICAgIGlmIChvcHRpb25hbENvbHMucmF0ZSkgY29sdW1uc0hUTUwgKz0gJzx0aD5SYXRlPC90aD4nO1xyXG4gICAgaWYgKG9wdGlvbmFsQ29scy5kaXNjb3VudF9wZXJjZW50KSBjb2x1bW5zSFRNTCArPSAnPHRoPkRpc2MgJTwvdGg+JztcclxuICAgIGlmIChvcHRpb25hbENvbHMucmF0ZV9hZnRlcl9kaXNjb3VudCkgY29sdW1uc0hUTUwgKz0gYDx0aD4ke2xhYmVscy5yYXRlX2FmdGVyX2Rpc2NvdW50IHx8ICdSYXRlL1VuaXQnfTwvdGg+YDtcclxuICAgIGlmIChvcHRpb25hbENvbHMudGF4X3BlcmNlbnQpIGNvbHVtbnNIVE1MICs9ICc8dGg+VGF4ICU8L3RoPic7XHJcbiAgICBpZiAob3B0aW9uYWxDb2xzLmN1c3RvbTEpIGNvbHVtbnNIVE1MICs9IGA8dGg+JHtsYWJlbHMuY3VzdG9tMSB8fCAnQ3VzdG9tIDEnfTwvdGg+YDtcclxuICAgIGlmIChvcHRpb25hbENvbHMuY3VzdG9tMikgY29sdW1uc0hUTUwgKz0gYDx0aD4ke2xhYmVscy5jdXN0b20yIHx8ICdDdXN0b20gMid9PC90aD5gO1xyXG4gICAgY29sdW1uc0hUTUwgKz0gJzx0aD5Ub3RhbDwvdGg+JztcclxuXHJcbiAgICBsZXQgcm93c0hUTUwgPSAnJztcclxuICAgIHF1b3RhdGlvbi5pdGVtcy5mb3JFYWNoKChpdGVtLCBpbmRleCkgPT4ge1xyXG4gICAgICBpZiAoaXRlbS5pc19oZWFkZXIpIHtcclxuICAgICAgICBsZXQgY29sQ291bnQgPSAwO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMuc25vICE9PSBmYWxzZSkgY29sQ291bnQrKztcclxuICAgICAgICBpZiAob3B0aW9uYWxDb2xzLmhzbl9jb2RlKSBjb2xDb3VudCsrO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMuaXRlbSAhPT0gZmFsc2UpIGNvbENvdW50Kys7XHJcbiAgICAgICAgaWYgKG9wdGlvbmFsQ29scy52YXJpYW50KSBjb2xDb3VudCsrO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMuZGVzY3JpcHRpb24pIGNvbENvdW50Kys7XHJcbiAgICAgICAgaWYgKG9wdGlvbmFsQ29scy5xdHkgIT09IGZhbHNlKSBjb2xDb3VudCsrO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMudW9tICE9PSBmYWxzZSkgY29sQ291bnQrKztcclxuICAgICAgICBpZiAob3B0aW9uYWxDb2xzLnJhdGUpIGNvbENvdW50Kys7XHJcbiAgICAgICAgaWYgKG9wdGlvbmFsQ29scy5kaXNjb3VudF9wZXJjZW50KSBjb2xDb3VudCsrO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMucmF0ZV9hZnRlcl9kaXNjb3VudCkgY29sQ291bnQrKztcclxuICAgICAgICBpZiAob3B0aW9uYWxDb2xzLnRheF9wZXJjZW50KSBjb2xDb3VudCsrO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMuY3VzdG9tMSkgY29sQ291bnQrKztcclxuICAgICAgICBpZiAob3B0aW9uYWxDb2xzLmN1c3RvbTIpIGNvbENvdW50Kys7XHJcbiAgICAgICAgY29sQ291bnQrKztcclxuICAgICAgICByb3dzSFRNTCArPSBgPHRyPjx0ZCBjb2xzcGFuPVwiJHtjb2xDb3VudH1cIiBzdHlsZT1cInBhZGRpbmc6MTBweCAxNHB4O2ZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zaXplOjEzcHg7YmFja2dyb3VuZDojZjhmYWZjXCI+JHtpdGVtLmRlc2NyaXB0aW9uIHx8ICdTZWN0aW9uJ308L3RkPjwvdHI+YDtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGl0ZW0uaXNfc3VidG90YWwpIHtcclxuICAgICAgICBsZXQgc3VidG90YWxBbW91bnQgPSAwO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSBpbmRleCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICAgICAgICBjb25zdCBwcmV2ID0gcXVvdGF0aW9uLml0ZW1zW2ldO1xyXG4gICAgICAgICAgaWYgKHByZXYuaXNfc3VidG90YWwgfHwgcHJldi5pc19oZWFkZXIpIGJyZWFrO1xyXG4gICAgICAgICAgc3VidG90YWxBbW91bnQgKz0gcGFyc2VGbG9hdChwcmV2LmxpbmVfdG90YWwpIHx8IDA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxldCBjb2xDb3VudCA9IDA7XHJcbiAgICAgICAgaWYgKG9wdGlvbmFsQ29scy5zbm8gIT09IGZhbHNlKSBjb2xDb3VudCsrO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMuaHNuX2NvZGUpIGNvbENvdW50Kys7XHJcbiAgICAgICAgaWYgKG9wdGlvbmFsQ29scy5pdGVtICE9PSBmYWxzZSkgY29sQ291bnQrKztcclxuICAgICAgICBpZiAob3B0aW9uYWxDb2xzLnZhcmlhbnQpIGNvbENvdW50Kys7XHJcbiAgICAgICAgaWYgKG9wdGlvbmFsQ29scy5kZXNjcmlwdGlvbikgY29sQ291bnQrKztcclxuICAgICAgICBpZiAob3B0aW9uYWxDb2xzLnF0eSAhPT0gZmFsc2UpIGNvbENvdW50Kys7XHJcbiAgICAgICAgaWYgKG9wdGlvbmFsQ29scy51b20gIT09IGZhbHNlKSBjb2xDb3VudCsrO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMucmF0ZSkgY29sQ291bnQrKztcclxuICAgICAgICBpZiAob3B0aW9uYWxDb2xzLmRpc2NvdW50X3BlcmNlbnQpIGNvbENvdW50Kys7XHJcbiAgICAgICAgaWYgKG9wdGlvbmFsQ29scy5yYXRlX2FmdGVyX2Rpc2NvdW50KSBjb2xDb3VudCsrO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMudGF4X3BlcmNlbnQpIGNvbENvdW50Kys7XHJcbiAgICAgICAgaWYgKG9wdGlvbmFsQ29scy5jdXN0b20xKSBjb2xDb3VudCsrO1xyXG4gICAgICAgIGlmIChvcHRpb25hbENvbHMuY3VzdG9tMikgY29sQ291bnQrKztcclxuICAgICAgICBjb2xDb3VudCsrO1xyXG4gICAgICAgIHJvd3NIVE1MICs9IGA8dHIgc3R5bGU9XCJiYWNrZ3JvdW5kOiNmZWY5YzM7Ym9yZGVyLXRvcDoycHggc29saWQgI2VhYjMwOFwiPjx0ZCBjb2xzcGFuPVwiJHtjb2xDb3VudH1cIiBzdHlsZT1cInBhZGRpbmc6MTBweCAxNHB4XCI+PGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6ZmxleC1lbmQ7d2lkdGg6MTAwJTtnYXA6MTZweFwiPjxzcGFuIHN0eWxlPVwiZm9udC13ZWlnaHQ6Ym9sZDtmb250LXNpemU6MTNweDtjb2xvcjojYjQ1MzA5O3RleHQtYWxpZ246cmlnaHRcIj4ke2l0ZW0uc3VidG90YWxfbGFiZWwgfHwgJ1N1Yi10b3RhbDonfTwvc3Bhbj48c3BhbiBzdHlsZT1cImZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zaXplOjEzcHg7Y29sb3I6I2I0NTMwOTttaW4td2lkdGg6MTAwcHg7dGV4dC1hbGlnbjpyaWdodFwiPiR7Zm9ybWF0Q3VycmVuY3koc3VidG90YWxBbW91bnQpfTwvc3Bhbj48L2Rpdj48L3RkPjwvdHI+YDtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgbWF0ZXJpYWwgPSBpdGVtLml0ZW0gfHwge307XHJcbiAgICAgIGxldCByb3dIVE1MID0gJzx0cj4nO1xyXG4gICAgICBpZiAob3B0aW9uYWxDb2xzLnNubyAhPT0gZmFsc2UpIHJvd0hUTUwgKz0gYDx0ZD4ke2luZGV4ICsgMX08L3RkPmA7XHJcbiAgICAgIGlmIChvcHRpb25hbENvbHMuaHNuX2NvZGUpIHJvd0hUTUwgKz0gYDx0ZD4ke2l0ZW0uc2FjX2NvZGUgfHwgbWF0ZXJpYWwuaHNuX2NvZGUgfHwgJy0nfTwvdGQ+YDtcclxuICAgICAgaWYgKG9wdGlvbmFsQ29scy5pdGVtICE9PSBmYWxzZSkgcm93SFRNTCArPSBgPHRkPiR7aXRlbS5kZXNjcmlwdGlvbiB8fCAnLSd9PC90ZD5gO1xyXG4gICAgICBpZiAob3B0aW9uYWxDb2xzLnZhcmlhbnQpIHJvd0hUTUwgKz0gYDx0ZD4ke2l0ZW0udmFyaWFudD8udmFyaWFudF9uYW1lIHx8ICctJ308L3RkPmA7XHJcbiAgICAgIGlmIChvcHRpb25hbENvbHMuZGVzY3JpcHRpb24pIHJvd0hUTUwgKz0gYDx0ZD4ke2l0ZW0uZGVzY3JpcHRpb24gfHwgJy0nfTwvdGQ+YDtcclxuICAgICAgaWYgKG9wdGlvbmFsQ29scy5xdHkgIT09IGZhbHNlKSByb3dIVE1MICs9IGA8dGQgc3R5bGU9XCJ0ZXh0LWFsaWduOnJpZ2h0XCI+JHtpdGVtLnF0eX08L3RkPmA7XHJcbiAgICAgIGlmIChvcHRpb25hbENvbHMudW9tICE9PSBmYWxzZSkgcm93SFRNTCArPSBgPHRkPiR7aXRlbS51b219PC90ZD5gO1xyXG4gICAgICBpZiAob3B0aW9uYWxDb2xzLnJhdGUpIHJvd0hUTUwgKz0gYDx0ZCBzdHlsZT1cInRleHQtYWxpZ246cmlnaHRcIj4ke2Zvcm1hdEN1cnJlbmN5KGl0ZW0uYmFzZV9yYXRlX3NuYXBzaG90IHx8IGl0ZW0ucmF0ZSl9PC90ZD5gO1xyXG4gICAgICBpZiAob3B0aW9uYWxDb2xzLmRpc2NvdW50X3BlcmNlbnQpIHJvd0hUTUwgKz0gYDx0ZCBzdHlsZT1cInRleHQtYWxpZ246cmlnaHRcIj4ke2l0ZW0uZGlzY291bnRfcGVyY2VudH0lPC90ZD5gO1xyXG4gICAgICBpZiAob3B0aW9uYWxDb2xzLnJhdGVfYWZ0ZXJfZGlzY291bnQpIHJvd0hUTUwgKz0gYDx0ZCBzdHlsZT1cInRleHQtYWxpZ246cmlnaHRcIj4ke2Zvcm1hdEN1cnJlbmN5KGl0ZW0ucmF0ZSl9PC90ZD5gO1xyXG4gICAgICBpZiAob3B0aW9uYWxDb2xzLnRheF9wZXJjZW50KSByb3dIVE1MICs9IGA8dGQgc3R5bGU9XCJ0ZXh0LWFsaWduOnJpZ2h0XCI+JHtpdGVtLnRheF9wZXJjZW50fSU8L3RkPmA7XHJcbiAgICAgIGlmIChvcHRpb25hbENvbHMuY3VzdG9tMSkgcm93SFRNTCArPSBgPHRkPiR7aXRlbS5jdXN0b20xIHx8ICctJ308L3RkPmA7XHJcbiAgICAgIGlmIChvcHRpb25hbENvbHMuY3VzdG9tMikgcm93SFRNTCArPSBgPHRkPiR7aXRlbS5jdXN0b20yIHx8ICctJ308L3RkPmA7XHJcbiAgICAgIHJvd0hUTUwgKz0gYDx0ZCBzdHlsZT1cInRleHQtYWxpZ246cmlnaHQ7Zm9udC13ZWlnaHQ6Ym9sZFwiPiR7Zm9ybWF0Q3VycmVuY3koaXRlbS5saW5lX3RvdGFsKX08L3RkPmA7XHJcbiAgICAgIHJvd0hUTUwgKz0gJzwvdHI+JztcclxuICAgICAgcm93c0hUTUwgKz0gcm93SFRNTDtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBgXHJcbiAgICAgIDwhRE9DVFlQRSBodG1sPlxyXG4gICAgICA8aHRtbD5cclxuICAgICAgPGhlYWQ+XHJcbiAgICAgICAgPHRpdGxlPlF1b3RhdGlvbiAtICR7cXVvdGF0aW9uLnF1b3RhdGlvbl9ub308L3RpdGxlPlxyXG4gICAgICAgIDxzdHlsZT5cclxuICAgICAgICAgIGJvZHkgeyBmb250LWZhbWlseTogQXJpYWwsIHNhbnMtc2VyaWY7IHBhZGRpbmc6IDIwcHg7IGNvbG9yOiAjMzMzOyB9XHJcbiAgICAgICAgICBoMSB7IHRleHQtYWxpZ246IGNlbnRlcjsgY29sb3I6ICMwMDA7IH1cclxuICAgICAgICAgIC5pbmZvLWdyaWQgeyBkaXNwbGF5OiBncmlkOyBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDFmciAxZnI7IGdhcDogNDBweDsgbWFyZ2luLWJvdHRvbTogMzBweDsgfVxyXG4gICAgICAgICAgLmluZm8tYm94IHsgbGluZS1oZWlnaHQ6IDEuNjsgfVxyXG4gICAgICAgICAgdGFibGUgeyB3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgbWFyZ2luLWJvdHRvbTogMzBweDsgfVxyXG4gICAgICAgICAgdGgsIHRkIHsgYm9yZGVyOiAxcHggc29saWQgI2RkZDsgcGFkZGluZzogMTBweDsgdGV4dC1hbGlnbjogbGVmdDsgZm9udC1zaXplOiAxM3B4OyB9XHJcbiAgICAgICAgICB0aCB7IGJhY2tncm91bmQtY29sb3I6ICNmM2Y0ZjY7IGNvbG9yOiAjMzc0MTUxOyBmb250LXdlaWdodDogNjAwOyB9XHJcbiAgICAgICAgICAuc3VtbWFyeSB7IGZsb2F0OiByaWdodDsgd2lkdGg6IDMwMHB4OyB9XHJcbiAgICAgICAgICAuc3VtbWFyeS1yb3cgeyBkaXNwbGF5OiBmbGV4OyBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47IHBhZGRpbmc6IDVweCAwOyBib3JkZXItYm90dG9tOiAxcHggc29saWQgI2YzZjRmNjsgfVxyXG4gICAgICAgICAgLnRvdGFsIHsgZm9udC13ZWlnaHQ6IGJvbGQ7IGZvbnQtc2l6ZTogMS4yZW07IGJvcmRlci10b3A6IDJweCBzb2xpZCAjMzc0MTUxOyBtYXJnaW4tdG9wOiAxMHB4OyBwYWRkaW5nLXRvcDogMTBweDsgfVxyXG4gICAgICAgICAgLmZvb3RlciB7IG1hcmdpbi10b3A6IDUwcHg7IGNsZWFyOiBib3RoOyB9XHJcbiAgICAgICAgPC9zdHlsZT5cclxuICAgICAgPC9oZWFkPlxyXG4gICAgICA8Ym9keT5cclxuICAgICAgICA8aDE+UVVPVEFUSU9OPC9oMT5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiaW5mby1ncmlkXCI+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5mby1ib3hcIj5cclxuICAgICAgICAgICAgPHN0cm9uZz5Ubzo8L3N0cm9uZz48YnI+XHJcbiAgICAgICAgICAgICR7cXVvdGF0aW9uLmNsaWVudD8uY2xpZW50X25hbWUgfHwgJy0nfTxicj5cclxuICAgICAgICAgICAgJHtxdW90YXRpb24uYmlsbGluZ19hZGRyZXNzIHx8ICctJ308YnI+XHJcbiAgICAgICAgICAgIEdTVElOOiAke3F1b3RhdGlvbi5nc3RpbiB8fCAnLSd9PGJyPlxyXG4gICAgICAgICAgICBTdGF0ZTogJHtxdW90YXRpb24uc3RhdGUgfHwgJy0nfVxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiaW5mby1ib3hcIiBzdHlsZT1cInRleHQtYWxpZ246IHJpZ2h0O1wiPlxyXG4gICAgICAgICAgICA8c3Ryb25nPlF1b3RhdGlvbiBObzo8L3N0cm9uZz4gJHtxdW90YXRpb24ucXVvdGF0aW9uX25vfTxicj5cclxuICAgICAgICAgICAgPHN0cm9uZz5EYXRlOjwvc3Ryb25nPiAke2Zvcm1hdERhdGUocXVvdGF0aW9uLmRhdGUpfTxicj5cclxuICAgICAgICAgICAgPHN0cm9uZz5WYWxpZCBUaWxsOjwvc3Ryb25nPiAke2Zvcm1hdERhdGUocXVvdGF0aW9uLnZhbGlkX3RpbGwpfTxicj5cclxuICAgICAgICAgICAgPHN0cm9uZz5Qcm9qZWN0Ojwvc3Ryb25nPiAke3F1b3RhdGlvbi5wcm9qZWN0Py5wcm9qZWN0X25hbWUgfHwgcXVvdGF0aW9uLnByb2plY3Q/LnByb2plY3RfY29kZSB8fCAnLSd9XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8dGFibGU+XHJcbiAgICAgICAgICA8dGhlYWQ+PHRyPiR7Y29sdW1uc0hUTUx9PC90cj48L3RoZWFkPlxyXG4gICAgICAgICAgPHRib2R5PiR7cm93c0hUTUx9PC90Ym9keT5cclxuICAgICAgICA8L3RhYmxlPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJzdW1tYXJ5XCI+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwic3VtbWFyeS1yb3dcIj48c3Bhbj5TdWJ0b3RhbDwvc3Bhbj48c3Bhbj4ke2Zvcm1hdEN1cnJlbmN5KHF1b3RhdGlvbi5zdWJ0b3RhbCl9PC9zcGFuPjwvZGl2PlxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cInN1bW1hcnktcm93XCI+PHNwYW4+RGlzY291bnQ8L3NwYW4+PHNwYW4+LSR7Zm9ybWF0Q3VycmVuY3kocXVvdGF0aW9uLnRvdGFsX2l0ZW1fZGlzY291bnQgKyBxdW90YXRpb24uZXh0cmFfZGlzY291bnRfYW1vdW50KX08L3NwYW4+PC9kaXY+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwic3VtbWFyeS1yb3dcIj48c3Bhbj5UYXg8L3NwYW4+PHNwYW4+JHtmb3JtYXRDdXJyZW5jeShxdW90YXRpb24udG90YWxfdGF4KX08L3NwYW4+PC9kaXY+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwic3VtbWFyeS1yb3cgdG90YWxcIj48c3Bhbj5HcmFuZCBUb3RhbDwvc3Bhbj48c3Bhbj4ke2Zvcm1hdEN1cnJlbmN5KHF1b3RhdGlvbi5ncmFuZF90b3RhbCl9PC9zcGFuPjwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJmb290ZXJcIj5cclxuICAgICAgICAgIDxwPjxzdHJvbmc+UGF5bWVudCBUZXJtczo8L3N0cm9uZz4gJHtxdW90YXRpb24ucGF5bWVudF90ZXJtcyB8fCAnLSd9PC9wPlxyXG4gICAgICAgICAgPHA+PHN0cm9uZz5SZW1hcmtzOjwvc3Ryb25nPiAke3F1b3RhdGlvbi5yZW1hcmtzIHx8IHF1b3RhdGlvbi5yZWZlcmVuY2UgfHwgJy0nfTwvcD5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9ib2R5PlxyXG4gICAgICA8L2h0bWw+XHJcbiAgICBgO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGdldFN0YXR1c0JhZGdlID0gKHN0YXR1cykgPT4ge1xyXG4gICAgY29uc3QgY29sb3JzID0ge1xyXG4gICAgICAnRHJhZnQnOiB7IGJnOiAnI2YzZjRmNicsIGNvbG9yOiAnIzZiNzI4MCcgfSxcclxuICAgICAgJ1NlbnQnOiB7IGJnOiAnI2RiZWFmZScsIGNvbG9yOiAnIzFlNDBhZicgfSxcclxuICAgICAgJ1VuZGVyIE5lZ290aWF0aW9uJzogeyBiZzogJyNmZWYzYzcnLCBjb2xvcjogJyNiNDUzMDknIH0sXHJcbiAgICAgICdBcHByb3ZlZCc6IHsgYmc6ICcjZDFmYWU1JywgY29sb3I6ICcjMDQ3ODU3JyB9LFxyXG4gICAgICAnUEVORElOR19BUFBST1ZBTCc6IHsgYmc6ICcjZmVmM2M3JywgY29sb3I6ICcjZDk3NzA2JyB9LFxyXG4gICAgICAnUmVqZWN0ZWQnOiB7IGJnOiAnI2ZlZTJlMicsIGNvbG9yOiAnI2RjMjYyNicgfSxcclxuICAgICAgJ0NvbnZlcnRlZCc6IHsgYmc6ICcjZGJlYWZlJywgY29sb3I6ICcjMWU0MGFmJyB9LFxyXG4gICAgICAnQ2FuY2VsbGVkJzogeyBiZzogJyNmZWUyZTInLCBjb2xvcjogJyM5OTFiMWInIH0sXHJcbiAgICAgICdFeHBpcmVkJzogeyBiZzogJyNmM2Y0ZjYnLCBjb2xvcjogJyM5Y2EzYWYnIH1cclxuICAgIH07XHJcbiAgICBjb25zdCBzdHlsZSA9IGNvbG9yc1tzdGF0dXNdIHx8IGNvbG9yc1snRHJhZnQnXTtcclxuICAgIHJldHVybiAoXHJcbiAgICAgIDxzcGFuIHN0eWxlPXt7IFxyXG4gICAgICAgIGJhY2tncm91bmQ6IHN0eWxlLmJnLCBcclxuICAgICAgICBjb2xvcjogc3R5bGUuY29sb3IsIFxyXG4gICAgICAgIHBhZGRpbmc6ICc0cHggMTJweCcsIFxyXG4gICAgICAgIGJvcmRlclJhZGl1czogJzEycHgnLFxyXG4gICAgICAgIGZvbnRTaXplOiAnMTNweCcsXHJcbiAgICAgICAgZm9udFdlaWdodDogNjAwXHJcbiAgICAgIH19PlxyXG4gICAgICAgIHtzdGF0dXN9XHJcbiAgICAgIDwvc3Bhbj5cclxuICAgICk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgZ2V0U2VsZWN0ZWRUZW1wbGF0ZU5hbWUgPSAoKSA9PiB7XHJcbiAgICBpZiAoIXNlbGVjdGVkVGVtcGxhdGVJZCkgcmV0dXJuICdEZWZhdWx0JztcclxuICAgIGNvbnN0IHRlbXBsYXRlID0gdGVtcGxhdGVzLmZpbmQodCA9PiB0LmlkID09PSBzZWxlY3RlZFRlbXBsYXRlSWQpO1xyXG4gICAgcmV0dXJuIHRlbXBsYXRlPy50ZW1wbGF0ZV9uYW1lIHx8ICdEZWZhdWx0JztcclxuICB9O1xyXG5cclxuICBjb25zdCBpc0VkaXRhYmxlID0gcXVvdGF0aW9uPy5zdGF0dXMgIT09ICdDb252ZXJ0ZWQnICYmIHF1b3RhdGlvbj8uc3RhdHVzICE9PSAnQ2FuY2VsbGVkJztcclxuICBjb25zdCBpc0RlbGV0YWJsZSA9IHF1b3RhdGlvbj8uc3RhdHVzID09PSAnRHJhZnQnO1xyXG4gIGNvbnN0IGlzQ2FuY2VsbGFibGUgPSBxdW90YXRpb24/LnN0YXR1cyAhPT0gJ0NhbmNlbGxlZCcgJiYgcXVvdGF0aW9uPy5zdGF0dXMgIT09ICdDb252ZXJ0ZWQnICYmIHF1b3RhdGlvbj8uc3RhdHVzICE9PSAnRHJhZnQnO1xyXG4gIGNvbnN0IGNhbkFwcHJvdmUgPSBxdW90YXRpb24/LnN0YXR1cyA9PT0gJ1BFTkRJTkdfQVBQUk9WQUwnO1xyXG5cclxuICBpZiAobG9hZGluZykge1xyXG4gICAgcmV0dXJuIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogJzQwcHgnLCB0ZXh0QWxpZ246ICdjZW50ZXInIH19PkxvYWRpbmcuLi48L2Rpdj47XHJcbiAgfVxyXG5cclxuICBpZiAoIXF1b3RhdGlvbklkKSB7XHJcbiAgICByZXR1cm4gPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAnNDBweCcsIHRleHRBbGlnbjogJ2NlbnRlcicgfX0+UXVvdGF0aW9uIElEIGlzIG1pc3NpbmcuPC9kaXY+O1xyXG4gIH1cclxuXHJcbiAgaWYgKHF1b3RhdGlvblF1ZXJ5LmlzRXJyb3IpIHtcclxuICAgIHJldHVybiAoXHJcbiAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogJzQwcHgnLCB0ZXh0QWxpZ246ICdjZW50ZXInIH19PlxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3sgZm9udFdlaWdodDogNjAwLCBjb2xvcjogJyNiOTFjMWMnLCBtYXJnaW5Cb3R0b206ICcxMnB4JyB9fT5cclxuICAgICAgICAgIHsocXVvdGF0aW9uUXVlcnkuZXJyb3IgYXMgRXJyb3IpPy5tZXNzYWdlIHx8ICdVbmFibGUgdG8gbG9hZCBxdW90YXRpb24uJ31cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzc05hbWU9XCJidG4gYnRuLXByaW1hcnlcIiBvbkNsaWNrPXsoKSA9PiBxdW90YXRpb25RdWVyeS5yZWZldGNoKCl9PlxyXG4gICAgICAgICAgUmV0cnlcclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgPC9kaXY+XHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgaWYgKCFxdW90YXRpb24pIHtcclxuICAgIHJldHVybiA8ZGl2IHN0eWxlPXt7IHBhZGRpbmc6ICc0MHB4JywgdGV4dEFsaWduOiAnY2VudGVyJyB9fT5RdW90YXRpb24gbm90IGZvdW5kPC9kaXY+O1xyXG4gIH1cclxuXHJcbiAgaWYgKGlzRW1iZWQpIHtcclxuICAgIGlmIChlbWJlZExvYWRpbmcgfHwgIWVtYmVkUGRmVXJsKSB7XHJcbiAgICAgIHJldHVybiAoXHJcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBtaW4taC1zY3JlZW4gYmctemluYy01MCBwLTZcIj5cclxuICAgICAgICAgIDxMb2FkZXIyIGNsYXNzTmFtZT1cInctOCBoLTggYW5pbWF0ZS1zcGluIHRleHQtc2t5LTUwMCBtYi00XCIgLz5cclxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LXppbmMtNjAwXCI+R2VuZXJhdGluZyBxdW90YXRpb24gUERGLi4uPC9wPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gICAgaWYgKGVtYmVkRXJyb3IpIHtcclxuICAgICAgcmV0dXJuIChcclxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIG1pbi1oLXNjcmVlbiBiZy16aW5jLTUwIHAtNiB0ZXh0LWNlbnRlclwiPlxyXG4gICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC0zeGwgbWItM1wiPuKaoO+4jzwvc3Bhbj5cclxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LXJlZC01MDAgbWItMlwiPkZhaWxlZCB0byBnZW5lcmF0ZSBQREY8L3A+XHJcbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtemluYy01MDBcIj57ZW1iZWRFcnJvcn08L3A+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gKFxyXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cInctZnVsbCBoLXNjcmVlbiBiZy16aW5jLTgwMFwiPlxyXG4gICAgICAgIDxpZnJhbWUgXHJcbiAgICAgICAgICBzcmM9e2Ake2VtYmVkUGRmVXJsfSN2aWV3PUZpdEhgfVxyXG4gICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIGgtZnVsbCBib3JkZXItbm9uZVwiIFxyXG4gICAgICAgICAgdGl0bGU9XCJRdW90YXRpb24gUERGXCIgXHJcbiAgICAgICAgLz5cclxuICAgICAgPC9kaXY+XHJcbiAgICApO1xyXG4gIH1cclxuXHJcblxyXG4gIHJldHVybiAoXHJcbiAgICA8PlxyXG4gICAgPFJlc2l6YWJsZVBhbmVsR3JvdXAgZGlyZWN0aW9uPVwiaG9yaXpvbnRhbFwiIGF1dG9TYXZlSWQ9XCJxdW90YXRpb24tc3BsaXRcIiBjbGFzc05hbWU9XCJmbGV4IGgtW2NhbGMoMTAwdmgtNDhweCldIGJnLXppbmMtMTAwIG92ZXJmbG93LWhpZGRlblwiPlxyXG4gICAgICB7LyogU2lkZWJhciBMaXN0ICgzMDBweCkgKi99XHJcbiAgICAgIDxSZXNpemFibGVQYW5lbCBkZWZhdWx0U2l6ZT17MjJ9IG1pblNpemU9ezE2fSBtYXhTaXplPXszOH0gY2xhc3NOYW1lPVwiZmxleCBmbGV4LWNvbCBiZy13aGl0ZSBzaGFkb3ctc21cIj5cclxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInB5LTUgcHgtNiBib3JkZXItYiBib3JkZXItemluYy0xMDAgYmctemluYy01MC81MCBmbGV4IGp1c3RpZnktYmV0d2VlbiBpdGVtcy1jZW50ZXJcIj5cclxuICAgICAgICAgIDxoMiBjbGFzc05hbWU9XCJ0ZXh0LXNtIGZvbnQtYm9sZCB0ZXh0LXppbmMtNzAwXCI+QWxsIFF1b3RlczwvaDI+XHJcbiAgICAgICAgICA8YnV0dG9uIFxyXG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBuYXZpZ2F0ZSgnL3F1b3RhdGlvbi9jcmVhdGUnKX1cclxuICAgICAgICAgICAgY2xhc3NOYW1lPVwicC0xLjUgYmctc2t5LTUwMCB0ZXh0LXdoaXRlIHJvdW5kZWQgaG92ZXI6Ymctc2t5LTYwMCB0cmFuc2l0aW9uLWNvbG9yc1wiXHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIDxQbHVzIGNsYXNzTmFtZT1cInctNCBoLTRcIiAvPlxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTEgb3ZlcmZsb3cteS1hdXRvXCI+XHJcbiAgICAgICAgICB7cXVvdGF0aW9uc1F1ZXJ5LmlzUGVuZGluZyA/IChcclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwLTggdGV4dC1jZW50ZXIgdGV4dC16aW5jLTQwMCB0ZXh0LXNtIGl0YWxpY1wiPkxvYWRpbmcgcXVvdGVzLi4uPC9kaXY+XHJcbiAgICAgICAgICApIDogcXVvdGF0aW9ucy5sZW5ndGggPT09IDAgPyAoXHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicC04IHRleHQtY2VudGVyIHRleHQtemluYy00MDAgdGV4dC1zbSBpdGFsaWNcIj5ObyBxdW90YXRpb25zIGZvdW5kPC9kaXY+XHJcbiAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImRpdmlkZS15IGRpdmlkZS16aW5jLTEwMFwiPlxyXG4gICAgICAgICAgICAgIHtxdW90YXRpb25zLm1hcCgocSkgPT4gKFxyXG4gICAgICAgICAgICAgICAgPGRpdiBcclxuICAgICAgICAgICAgICAgICAga2V5PXtxLmlkfVxyXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBuYXZpZ2F0ZShgL3F1b3RhdGlvbi92aWV3P2lkPSR7cS5pZH1gKX1cclxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgcHgtNCBjdXJzb3ItcG9pbnRlciB0cmFuc2l0aW9uLWNvbG9ycyBob3ZlcjpiZy1za3ktNTAvMzAgJHtxdW90YXRpb25JZCA9PT0gcS5pZCA/ICdiZy1za3ktMTAwJyA6ICdiZy13aGl0ZSd9YH1cclxuICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgcGFkZGluZ1RvcDogJzE0cHgnLCBwYWRkaW5nQm90dG9tOiAnMTRweCcgfX1cclxuICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlbiBpdGVtcy1zdGFydCBtYi0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTNweF0gZm9udC1ib2xkIHRleHQtemluYy05MDAgdHJ1bmNhdGUgcHItMlwiIHN0eWxlPXt7IHBhZGRpbmdMZWZ0OiAnMTBweCcsIHBhZGRpbmdSaWdodDogJzEwcHgnIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAge3EuY2xpZW50Py5jbGllbnRfbmFtZSB8fCAnV2Fsay1pbiBDbGllbnQnfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMnB4XSBmb250LWJvbGQgdGV4dC16aW5jLTkwMFwiIHN0eWxlPXt7IHBhZGRpbmdMZWZ0OiAnMTBweCcsIHBhZGRpbmdSaWdodDogJzEwcHgnIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAge2Zvcm1hdEN1cnJlbmN5KHEuZ3JhbmRfdG90YWwpfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWJldHdlZW4gaXRlbXMtY2VudGVyIG10LTEgZ2FwLTRcIj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtWzExcHhdIGZvbnQtaW50ZXIgZmxleCBpdGVtcy1jZW50ZXJcIiBzdHlsZT17eyBwYWRkaW5nTGVmdDogJzEwcHgnLCBwYWRkaW5nUmlnaHQ6ICcxMHB4JywgbWFyZ2luTGVmdDogJzFweCcsIGdhcDogJzVweCcgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXppbmMtNzAwIGZvbnQtbWVkaXVtXCI+e3EucXVvdGF0aW9uX25vfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtemluYy0zMDBcIj7igKI8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWJsdWUtNTAwXCI+e2Zvcm1hdERhdGUocS5kYXRlKX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gXHJcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSBmb250LWJvbGQgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIHB4LTIgcHktMC41IHJvdW5kZWRcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogcS5zdGF0dXMgPT09ICdBcHByb3ZlZCcgPyAnI2QxZmFlNScgOiBxLnN0YXR1cyA9PT0gJ0RyYWZ0JyA/ICcjZjNmNGY2JyA6ICcjZmZmN2VkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6IHEuc3RhdHVzID09PSAnQXBwcm92ZWQnID8gJyMwNDc4NTcnIDogcS5zdGF0dXMgPT09ICdEcmFmdCcgPyAnIzZiNzI4MCcgOiAnI2MyNDEwYydcclxuICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAge3Euc3RhdHVzfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICApfVxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L1Jlc2l6YWJsZVBhbmVsPlxyXG4gICAgICA8UmVzaXphYmxlSGFuZGxlIHdpdGhIYW5kbGUgLz5cclxuXHJcbiAgICAgIHsvKiBNYWluIENvbnRlbnQgKDcwJSkgKi99XHJcbiAgICAgIDxSZXNpemFibGVQYW5lbCBkZWZhdWx0U2l6ZT17Nzh9IGNsYXNzTmFtZT1cImJnLXppbmMtNTAgb3ZlcmZsb3cteS1hdXRvXCI+XHJcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtYXgtdy01eGwgbXgtYXV0byBweS0xMiBweC04IHNtOnB4LTEyIGxnOnB4LTE2XCI+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBtYi04XCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTRcIj5cclxuICAgICAgICAgICAgICA8aDEgY2xhc3NOYW1lPVwidGV4dC0yeGwgZm9udC1ib2xkIHRleHQtemluYy05MDBcIj57cXVvdGF0aW9uLnF1b3RhdGlvbl9ub308L2gxPlxyXG4gICAgICAgICAgICAgIDxzcGFuIFxyXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicHgtMyBweS0xIHJvdW5kZWQtZnVsbCB0ZXh0LXhzIGZvbnQtYm9sZCB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXIgYm9yZGVyXCJcclxuICAgICAgICAgICAgICAgIHN0eWxlPXt7IFxyXG4gICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IHF1b3RhdGlvbi5zdGF0dXMgPT09ICdBcHByb3ZlZCcgPyAnI2QxZmFlNScgOiAnI2YzZjRmNicsXHJcbiAgICAgICAgICAgICAgICAgIGNvbG9yOiBxdW90YXRpb24uc3RhdHVzID09PSAnQXBwcm92ZWQnID8gJyMwNDc4NTcnIDogJyM2YjcyODAnLFxyXG4gICAgICAgICAgICAgICAgICBib3JkZXJDb2xvcjogcXVvdGF0aW9uLnN0YXR1cyA9PT0gJ0FwcHJvdmVkJyA/ICcjMTBiOTgxJyA6ICcjZTVlN2ViJ1xyXG4gICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICB7cXVvdGF0aW9uLnN0YXR1c31cclxuICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zXCI+XHJcbiAgICAgICAgICAgICAgPGJ1dHRvbiBcclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiBweC0xMCBoLVsyNXB4XSBtaW4tdy1bMTAwcHhdIGJnLWdyYWRpZW50LXRvLWIgZnJvbS1bIzAwMWYzZl0gdG8tWyMwMDMzNjZdIHRleHQtd2hpdGUgcm91bmRlZC1ub25lIGhvdmVyOm9wYWNpdHktOTAgdHJhbnNpdGlvbi1hbGwgdGV4dC1bMTFweF0gZm9udC1ib2xkIHNoYWRvdy1ub25lIGJvcmRlci1ub25lXCJcclxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IGhhbmRsZVByaW50QWN0aW9uKCdkb3dubG9hZCcpfVxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgIDxQcmludGVyIGNsYXNzTmFtZT1cInctWzE0cHhdIGgtWzE0cHhdXCIgLz5cclxuICAgICAgICAgICAgICAgIFByaW50XHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtd3JhcCBpdGVtcy1jZW50ZXIgZ2FwLVsyMHB4XSBtYi02IHB4LTggYm9yZGVyLXQgYm9yZGVyLXppbmMtMjAwXCIgc3R5bGU9e3sgcGFkZGluZ1RvcDogJzE2cHgnLCBwYWRkaW5nQm90dG9tOiAnMTZweCcgfX0+XHJcbiAgICAgICAgICAgIHtpc0VkaXRhYmxlICYmIChcclxuICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzTmFtZT1cImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiBweC0zIHB5LTEuNSB0ZXh0LXppbmMtNjAwIGhvdmVyOnRleHQtemluYy05MDAgaG92ZXI6YmctemluYy0xMDAgcm91bmRlZC1tZCB0cmFuc2l0aW9uLWFsbCB0ZXh0LVsxM3B4XSBmb250LXNlbWlib2xkXCIgb25DbGljaz17aGFuZGxlRWRpdH0+XHJcbiAgICAgICAgICAgICAgICA8RWRpdCBjbGFzc05hbWU9XCJ3LVsxNHB4XSBoLVsxNHB4XVwiIC8+XHJcbiAgICAgICAgICAgICAgICBFZGl0XHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgIHtjYW5BcHByb3ZlICYmIChcclxuICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzTmFtZT1cImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiBweC0zIHB5LTEuNSB0ZXh0LWVtZXJhbGQtNjAwIGhvdmVyOnRleHQtZW1lcmFsZC03MDAgaG92ZXI6YmctZW1lcmFsZC01MCByb3VuZGVkLW1kIHRyYW5zaXRpb24tYWxsIHRleHQtWzEzcHhdIGZvbnQtc2VtaWJvbGRcIiBvbkNsaWNrPXsoKSA9PiBoYW5kbGVBcHByb3ZhbEFjdGlvbignQVBQUk9WRUQnKX0+XHJcbiAgICAgICAgICAgICAgICA8Q2hlY2tDaXJjbGUgY2xhc3NOYW1lPVwidy1bMTRweF0gaC1bMTRweF1cIiAvPlxyXG4gICAgICAgICAgICAgICAgQXBwcm92ZVxyXG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgICA8YnV0dG9uIGNsYXNzTmFtZT1cImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiBweC0zIHB5LTEuNSB0ZXh0LXppbmMtNjAwIGhvdmVyOnRleHQtemluYy05MDAgaG92ZXI6YmctemluYy0xMDAgcm91bmRlZC1tZCB0cmFuc2l0aW9uLWFsbCB0ZXh0LVsxM3B4XSBmb250LXNlbWlib2xkXCIgb25DbGljaz17aGFuZGxlRHVwbGljYXRlfT5cclxuICAgICAgICAgICAgICA8Q29weSBjbGFzc05hbWU9XCJ3LVsxNHB4XSBoLVsxNHB4XVwiIC8+XHJcbiAgICAgICAgICAgICAgRHVwbGljYXRlXHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyZWxhdGl2ZVwiPlxyXG4gICAgICAgICAgICAgIDxidXR0b24gXHJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgcHgtMyBweS0xLjUgdGV4dC16aW5jLTYwMCBob3Zlcjp0ZXh0LXppbmMtOTAwIGhvdmVyOmJnLXppbmMtMTAwIHJvdW5kZWQtbWQgdHJhbnNpdGlvbi1hbGwgdGV4dC1bMTNweF0gZm9udC1zZW1pYm9sZFwiIFxyXG4gICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4geyBzZXRTaG93Q29udmVydE1lbnUoIXNob3dDb252ZXJ0TWVudSk7IHNldFNob3dQcmludE1lbnUoZmFsc2UpOyBzZXRTaG93VGVtcGxhdGVNZW51KGZhbHNlKTsgc2V0U2hvd0FjdGlvbnNNZW51KGZhbHNlKTsgfX1cclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICA8RmlsZVRleHQgY2xhc3NOYW1lPVwidy1bMTRweF0gaC1bMTRweF1cIiAvPlxyXG4gICAgICAgICAgICAgICAgQ29udmVydFxyXG4gICAgICAgICAgICAgICAgPENoZXZyb25Eb3duIGNsYXNzTmFtZT17YHctWzE0cHhdIGgtWzE0cHhdIHRyYW5zaXRpb24tdHJhbnNmb3JtICR7c2hvd0NvbnZlcnRNZW51ID8gJ3JvdGF0ZS0xODAnIDogJyd9YH0gLz5cclxuICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuXHJcbiAgICAgICAgICAgICAge3Nob3dDb252ZXJ0TWVudSAmJiAoXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImFic29sdXRlIGxlZnQtMCB0b3AtZnVsbCBtdC0xIHotNTAgbWluLXctWzIwMHB4XSBiZy13aGl0ZSBib3JkZXIgYm9yZGVyLXppbmMtMjAwIHNoYWRvdy14bCBwLTFcIj5cclxuICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXsoKSA9PiBoYW5kbGVDb252ZXJ0KCdwcm9mb3JtYS1pbnZvaWNlJyl9IGNsYXNzTmFtZT1cImJsb2NrIHctZnVsbCB0ZXh0LWxlZnQgcHgtMyBweS0yIHRleHQteHMgZm9udC1ib2xkIHRleHQtemluYy03MDAgaG92ZXI6Ymctc2t5LTUwXCI+UHJvZm9ybWEgSW52b2ljZTwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICA8YnV0dG9uIG9uQ2xpY2s9eygpID0+IGhhbmRsZUNvbnZlcnQoJ2ludm9pY2UnKX0gY2xhc3NOYW1lPVwiYmxvY2sgdy1mdWxsIHRleHQtbGVmdCBweC0zIHB5LTIgdGV4dC14cyBmb250LWJvbGQgdGV4dC16aW5jLTcwMCBob3ZlcjpiZy1za3ktNTBcIj5UYXggSW52b2ljZTwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJlbGF0aXZlXCI+XHJcbiAgICAgICAgICAgICAgPGJ1dHRvbiBcclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiBweC0zIHB5LTEuNSB0ZXh0LXppbmMtNjAwIGhvdmVyOnRleHQtemluYy05MDAgaG92ZXI6YmctemluYy0xMDAgcm91bmRlZC1tZCB0cmFuc2l0aW9uLWFsbCB0ZXh0LVsxM3B4XSBmb250LXNlbWlib2xkXCIgXHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7IFxyXG4gICAgICAgICAgICAgICAgICBzZXRTaG93UHJpbnRNZW51KCFzaG93UHJpbnRNZW51KTsgXHJcbiAgICAgICAgICAgICAgICAgIHNldFNob3dDb252ZXJ0TWVudShmYWxzZSk7IFxyXG4gICAgICAgICAgICAgICAgICBzZXRTaG93VGVtcGxhdGVNZW51KGZhbHNlKTtcclxuICAgICAgICAgICAgICAgICAgc2V0U2hvd0FjdGlvbnNNZW51KGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICBkaXNhYmxlZD17cHJpbnRMb2FkaW5nfVxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgIHtwcmludExvYWRpbmcgPyAoXHJcbiAgICAgICAgICAgICAgICAgIDxMb2FkZXIyIGNsYXNzTmFtZT1cInctWzE0cHhdIGgtWzE0cHhdIGFuaW1hdGUtc3BpblwiIC8+XHJcbiAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICA8UHJpbnRlciBjbGFzc05hbWU9XCJ3LVsxNHB4XSBoLVsxNHB4XVwiIC8+XHJcbiAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgUHJpbnQgKHtnZXRTZWxlY3RlZFRlbXBsYXRlTmFtZSgpfSlcclxuICAgICAgICAgICAgICAgIDxDaGV2cm9uRG93biBjbGFzc05hbWU9e2B3LVsxNHB4XSBoLVsxNHB4XSB0cmFuc2l0aW9uLXRyYW5zZm9ybSAke3Nob3dQcmludE1lbnUgPyAncm90YXRlLTE4MCcgOiAnJ31gfSAvPlxyXG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG5cclxuICAgICAgICAgICAgICB7c2hvd1ByaW50TWVudSAmJiAoXHJcbiAgICAgICAgICAgICAgICA8ZGl2IHJlZj17cHJpbnRNZW51UmVmfSBjbGFzc05hbWU9XCJhYnNvbHV0ZSBsZWZ0LTAgdG9wLWZ1bGwgbXQtMSB6LTUwIG1pbi13LVsyNDBweF0gYmctd2hpdGUgYm9yZGVyIGJvcmRlci16aW5jLTIwMCBzaGFkb3cteGwgcC0xIHJvdW5kZWQtc21cIj5cclxuICAgICAgICAgICAgICAgICAge3ByaW50TWVudVZpZXcgPT09ICdtYWluJyA/IChcclxuICAgICAgICAgICAgICAgICAgICA8PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBcclxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gaGFuZGxlUHJpbnRBY3Rpb24oJ3ByZXZpZXcnKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTMgdy1mdWxsIHRleHQtbGVmdCB0ZXh0LXhzIGZvbnQtYm9sZCB0ZXh0LXppbmMtNzAwIGhvdmVyOmJnLXNreS01MCB0cmFuc2l0aW9uLWNvbG9yc1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IHBhZGRpbmc6ICcxMnB4JyB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8RXllIGNsYXNzTmFtZT1cInctNCBoLTQgdGV4dC1za3ktNTAwXCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgUHJldmlld1xyXG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBoYW5kbGVQcmludEFjdGlvbignZG93bmxvYWQnKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTMgdy1mdWxsIHRleHQtbGVmdCB0ZXh0LXhzIGZvbnQtYm9sZCB0ZXh0LXppbmMtNzAwIGhvdmVyOmJnLXNreS01MCB0cmFuc2l0aW9uLWNvbG9yc1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IHBhZGRpbmc6ICcxMnB4JyB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8RG93bmxvYWQgY2xhc3NOYW1lPVwidy00IGgtNCB0ZXh0LXNreS01MDBcIiAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBEb3dubG9hZCBQREZcclxuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJoLXB4IGJnLXppbmMtMTAwIG15LTFcIiAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBcclxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0UHJpbnRNZW51VmlldygndGVtcGxhdGVzJyl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiB3LWZ1bGwgdGV4dC1sZWZ0IHRleHQteHMgZm9udC1ib2xkIHRleHQtemluYy03MDAgaG92ZXI6Ymctc2t5LTUwIHRyYW5zaXRpb24tY29sb3JzIGdyb3VwXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgcGFkZGluZzogJzEycHgnIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8RmlsZVRleHQgY2xhc3NOYW1lPVwidy00IGgtNCB0ZXh0LXNreS01MDBcIiAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIENob29zZSBUZW1wbGF0ZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPENoZXZyb25SaWdodCBjbGFzc05hbWU9XCJ3LTQgaC00IHRleHQtemluYy00MDAgZ3JvdXAtaG92ZXI6dGV4dC1za3ktNTAwIHRyYW5zaXRpb24tY29sb3JzXCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvPlxyXG4gICAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHAtMiBtYi0xIGJvcmRlci1iIGJvcmRlci16aW5jLTEwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFByaW50TWVudVZpZXcoJ21haW4nKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJwLTEgaG92ZXI6YmctemluYy0xMDAgcm91bmRlZCB0cmFuc2l0aW9uLWNvbG9yc1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8Q2hldnJvbkxlZnQgY2xhc3NOYW1lPVwidy00IGgtNCB0ZXh0LXppbmMtNTAwXCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzEwcHhdIGZvbnQtYm9sZCB0ZXh0LXppbmMtNDAwIHVwcGVyY2FzZSB0cmFja2luZy13aWRlc3RcIj5TZWxlY3QgVGVtcGxhdGU8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWF4LWgtWzMwMHB4XSBvdmVyZmxvdy15LWF1dG9cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAge3RlbXBsYXRlcy5tYXAodCA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleT17dC5pZH0gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZVNlbGVjdFRlbXBsYXRlKHQuaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRQcmludE1lbnVWaWV3KCdtYWluJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fSBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YGJsb2NrIHctZnVsbCB0ZXh0LWxlZnQgdGV4dC14cyBmb250LWJvbGQgdHJhbnNpdGlvbi1jb2xvcnMgJHtzZWxlY3RlZFRlbXBsYXRlSWQgPT09IHQuaWQgPyAnYmctc2t5LTUwIHRleHQtc2t5LTYwMCcgOiAndGV4dC16aW5jLTcwMCBob3ZlcjpiZy1za3ktNTAvNTAnfWB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHlsZT17eyBwYWRkaW5nOiAnMTBweCAxMnB4JyB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHt0LnRlbXBsYXRlX25hbWV9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7dC5pc19kZWZhdWx0ICYmIDxzcGFuIGNsYXNzTmFtZT1cIm1sLTIgdGV4dC1bMTBweF0gdGV4dC16aW5jLTQwMCBmb250LW5vcm1hbCBpdGFsaWNcIj4oRGVmYXVsdCk8L3NwYW4+fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvPlxyXG4gICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJlbGF0aXZlXCI+XHJcbiAgICAgICAgICAgICAgPGJ1dHRvbiBcclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiBweC0zIHB5LTEuNSB0ZXh0LXppbmMtNjAwIGhvdmVyOnRleHQtemluYy05MDAgaG92ZXI6YmctemluYy0xMDAgcm91bmRlZC1tZCB0cmFuc2l0aW9uLWFsbCB0ZXh0LVsxM3B4XSBmb250LXNlbWlib2xkXCIgXHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7IFxyXG4gICAgICAgICAgICAgICAgICBzZXRTaG93QWN0aW9uc01lbnUoIXNob3dBY3Rpb25zTWVudSk7IFxyXG4gICAgICAgICAgICAgICAgICBzZXRTaG93UHJpbnRNZW51KGZhbHNlKTsgXHJcbiAgICAgICAgICAgICAgICAgIHNldFNob3dDb252ZXJ0TWVudShmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICAgIHNldFNob3dUZW1wbGF0ZU1lbnUoZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICA8TW9yZUhvcml6b250YWwgY2xhc3NOYW1lPVwidy1bMTRweF0gaC1bMTRweF1cIiAvPlxyXG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG5cclxuICAgICAgICAgICAgICB7c2hvd0FjdGlvbnNNZW51ICYmIChcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYWJzb2x1dGUgbGVmdC0wIHRvcC1mdWxsIG10LTEgei01MCBtaW4tdy1bMjAwcHhdIGJnLXdoaXRlIGJvcmRlciBib3JkZXItemluYy0yMDAgc2hhZG93LXhsIHAtMSByb3VuZGVkLXNtXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxidXR0b24gXHJcbiAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgc2V0U2hvd0FjdGlvbnNNZW51KGZhbHNlKTtcclxuICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZUxhdW5jaFN0b2NrQ2hlY2soKTtcclxuICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtsYXVuY2hpbmdTdG9ja0NoZWNrfVxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zIHctZnVsbCB0ZXh0LWxlZnQgdGV4dC14cyBmb250LWJvbGQgdGV4dC16aW5jLTcwMCBob3ZlcjpiZy1za3ktNTAgdHJhbnNpdGlvbi1jb2xvcnMgZGlzYWJsZWQ6b3BhY2l0eS01MCBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWRcIlxyXG4gICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IHBhZGRpbmc6ICcxMnB4JyB9fVxyXG4gICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAge2xhdW5jaGluZ1N0b2NrQ2hlY2sgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8TG9hZGVyMiBjbGFzc05hbWU9XCJ3LTQgaC00IHRleHQtc2t5LTUwMCBhbmltYXRlLXNwaW5cIiAvPlxyXG4gICAgICAgICAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWJhc2VcIj7wn5OmPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXY+U3RvY2sgQ2hlY2s8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gZm9udC1ub3JtYWwgdGV4dC16aW5jLTQwMFwiPkNyZWF0ZSBwcm9jdXJlbWVudCB0cmFja2VyPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgb25DbGljaz17YXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgc2V0U2hvd0FjdGlvbnNNZW51KGZhbHNlKTtcclxuICAgICAgICAgICAgICAgICAgICAgIHNldExhdW5jaGluZ1JldmlzaW9uKHRydWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9yZ2FuaXNhdGlvbj8uaWQgJiYgcXVvdGF0aW9uSWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBpbml0aWF0ZVF1b3RhdGlvblJldmlzaW9uKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JnYW5pc2F0aW9uLmlkLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcXVvdGF0aW9uSWRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRMYXVuY2hpbmdSZXZpc2lvbihmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17bGF1bmNoaW5nUmV2aXNpb259XHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTMgdy1mdWxsIHRleHQtbGVmdCB0ZXh0LXhzIGZvbnQtYm9sZCB0ZXh0LXppbmMtNzAwIGhvdmVyOmJnLWFtYmVyLTUwIHRyYW5zaXRpb24tY29sb3JzIGRpc2FibGVkOm9wYWNpdHktNTAgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkXCJcclxuICAgICAgICAgICAgICAgICAgICBzdHlsZT17eyBwYWRkaW5nOiAnMTJweCcgfX1cclxuICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIHtsYXVuY2hpbmdSZXZpc2lvbiA/IChcclxuICAgICAgICAgICAgICAgICAgICAgIDxMb2FkZXIyIGNsYXNzTmFtZT1cInctNCBoLTQgdGV4dC1hbWJlci01MDAgYW5pbWF0ZS1zcGluXCIgLz5cclxuICAgICAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1iYXNlXCI+8J+Tizwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2PlJlcXVlc3QgUmV2aXNpb248L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gZm9udC1ub3JtYWwgdGV4dC16aW5jLTQwMFwiPkZsYWcgZm9yIHF1b3RhdGlvbiByZXZpc2lvbjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAge2lzQ2FuY2VsbGFibGUgJiYgKFxyXG4gICAgICAgICAgICAgIDxidXR0b24gY2xhc3NOYW1lPVwiaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHB4LTMgcHktMS41IHRleHQtcmVkLTUwMCBob3Zlcjp0ZXh0LXJlZC02MDAgaG92ZXI6YmctcmVkLTUwIHJvdW5kZWQtbWQgdHJhbnNpdGlvbi1hbGwgdGV4dC1bMTNweF0gZm9udC1zZW1pYm9sZFwiIG9uQ2xpY2s9e2hhbmRsZUNhbmNlbH0+XHJcbiAgICAgICAgICAgICAgICA8WENpcmNsZSBjbGFzc05hbWU9XCJ3LVsxNHB4XSBoLVsxNHB4XVwiIC8+XHJcbiAgICAgICAgICAgICAgICBDYW5jZWxcclxuICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHtpc0RlbGV0YWJsZSAmJiAoXHJcbiAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzc05hbWU9XCJpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgcHgtMyBweS0xLjUgdGV4dC1yZWQtNTAwIGhvdmVyOnRleHQtcmVkLTYwMCBob3ZlcjpiZy1yZWQtNTAgcm91bmRlZC1tZCB0cmFuc2l0aW9uLWFsbCB0ZXh0LVsxM3B4XSBmb250LXNlbWlib2xkXCIgb25DbGljaz17aGFuZGxlRGVsZXRlfT5cclxuICAgICAgICAgICAgICAgIDxUcmFzaDIgY2xhc3NOYW1lPVwidy1bMTRweF0gaC1bMTRweF1cIiAvPlxyXG4gICAgICAgICAgICAgICAgRGVsZXRlXHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICl9XHJcbiAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNiBiZy13aGl0ZSBib3JkZXIgYm9yZGVyLXppbmMtMjAwIHNoYWRvdy0yeGwgbWluLWgtWzExMjBweF0gbWItMTIgcm91bmRlZC1ub25lXCIgc3R5bGU9e3sgcGFkZGluZzogJzE0cHgnIH19PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJvcmRlci1iIGJvcmRlci16aW5jLTEwMCBwYi0xMFwiPlxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtNCBnYXAteC04IG1iLTNcIj5cclxuICAgICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LVsxMXB4XSBmb250LWJvbGQgdGV4dC1ibHVlLTYwMCB1cHBlcmNhc2UgdHJhY2tpbmctWzAuMDhlbV1cIj5Eb2N1bWVudDwvaDM+XHJcbiAgICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1bMTFweF0gZm9udC1ib2xkIHRleHQtYmx1ZS02MDAgdXBwZXJjYXNlIHRyYWNraW5nLVswLjA4ZW1dXCI+VGVybXM8L2gzPlxyXG4gICAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtWzExcHhdIGZvbnQtYm9sZCB0ZXh0LWJsdWUtNjAwIHVwcGVyY2FzZSB0cmFja2luZy1bMC4wOGVtXVwiPkNsaWVudDwvaDM+XHJcbiAgICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1bMTFweF0gZm9udC1ib2xkIHRleHQtYmx1ZS02MDAgdXBwZXJjYXNlIHRyYWNraW5nLVswLjA4ZW1dXCI+UHJvamVjdCAmIFNoaXBwaW5nPC9oMz5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJvcmRlci10IGJvcmRlci1ibHVlLTIwMCBtYi02XCI+PC9kaXY+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy00IGdhcC14LThcIj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0zXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGR0IGNsYXNzTmFtZT1cInRleHQtWzExcHhdIHRleHQtemluYy00MDBcIj5RdW90YXRpb24gTm88L2R0PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkZCBjbGFzc05hbWU9XCJ0ZXh0LVsxM3B4XSBmb250LWJvbGQgdGV4dC16aW5jLTkwMCBtdC0wLjVcIj57cXVvdGF0aW9uLnF1b3RhdGlvbl9ubyB8fCAnLSd9PC9kZD5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGR0IGNsYXNzTmFtZT1cInRleHQtWzExcHhdIHRleHQtemluYy00MDBcIj5EYXRlPC9kdD5cclxuICAgICAgICAgICAgICAgICAgICA8ZGQgY2xhc3NOYW1lPVwidGV4dC1bMTNweF0gZm9udC1ib2xkIHRleHQtemluYy05MDAgbXQtMC41XCI+e2Zvcm1hdERhdGUocXVvdGF0aW9uLmRhdGUpfTwvZGQ+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkdCBjbGFzc05hbWU9XCJ0ZXh0LVsxMXB4XSB0ZXh0LXppbmMtNDAwXCI+VmFsaWQgVGlsbDwvZHQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRkIGNsYXNzTmFtZT1cInRleHQtWzEzcHhdIGZvbnQtYm9sZCB0ZXh0LXppbmMtOTAwIG10LTAuNVwiPntmb3JtYXREYXRlKHF1b3RhdGlvbi52YWxpZF90aWxsKX08L2RkPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICA8ZHQgY2xhc3NOYW1lPVwidGV4dC1bMTFweF0gdGV4dC16aW5jLTQwMFwiPlJldmlzaW9uIE5vPC9kdD5cclxuICAgICAgICAgICAgICAgICAgICA8ZGQgY2xhc3NOYW1lPVwidGV4dC1bMTNweF0gZm9udC1ib2xkIHRleHQtemluYy05MDAgbXQtMC41XCI+e3F1b3RhdGlvbi5yZXZpc2lvbl9ubyB8fCAnMDAnfTwvZGQ+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktM1wiPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkdCBjbGFzc05hbWU9XCJ0ZXh0LVsxMXB4XSB0ZXh0LXppbmMtNDAwXCI+UGF5bWVudCBUZXJtczwvZHQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRkIGNsYXNzTmFtZT1cInRleHQtWzEzcHhdIGZvbnQtYm9sZCB0ZXh0LXppbmMtOTAwIG10LTAuNVwiPntxdW90YXRpb24ucGF5bWVudF90ZXJtcyB8fCAnLSd9PC9kZD5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGR0IGNsYXNzTmFtZT1cInRleHQtWzExcHhdIHRleHQtemluYy00MDBcIj5SZWZlcmVuY2U8L2R0PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkZCBjbGFzc05hbWU9XCJ0ZXh0LVsxM3B4XSBmb250LWJvbGQgdGV4dC16aW5jLTkwMCBtdC0wLjVcIj57cXVvdGF0aW9uLnJlZmVyZW5jZSB8fCAnLSd9PC9kZD5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGR0IGNsYXNzTmFtZT1cInRleHQtWzExcHhdIHRleHQtemluYy00MDBcIj5QcmVwYXJlZCBCeTwvZHQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRkIGNsYXNzTmFtZT1cInRleHQtWzEzcHhdIGZvbnQtYm9sZCB0ZXh0LXppbmMtOTAwIG10LTAuNVwiPntxdW90YXRpb24ucHJlcGFyZWRfYnkgfHwgJy0nfTwvZGQ+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkdCBjbGFzc05hbWU9XCJ0ZXh0LVsxMXB4XSB0ZXh0LXppbmMtNDAwXCI+UmVtYXJrczwvZHQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRkIGNsYXNzTmFtZT1cInRleHQtWzEzcHhdIGZvbnQtYm9sZCB0ZXh0LXppbmMtOTAwIG10LTAuNSB0cnVuY2F0ZSBtYXgtdy1bMjAwcHhdXCIgdGl0bGU9e3F1b3RhdGlvbi5yZW1hcmtzIHx8IHF1b3RhdGlvbi5yZWZlcmVuY2UgfHwgJy0nfT57cXVvdGF0aW9uLnJlbWFya3MgfHwgcXVvdGF0aW9uLnJlZmVyZW5jZSB8fCAnLSd9PC9kZD5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0zXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGR0IGNsYXNzTmFtZT1cInRleHQtWzExcHhdIHRleHQtemluYy00MDBcIj5OYW1lPC9kdD5cclxuICAgICAgICAgICAgICAgICAgICA8ZGQgY2xhc3NOYW1lPVwidGV4dC1bMTNweF0gZm9udC1ib2xkIHRleHQtemluYy05MDAgbXQtMC41XCI+e3F1b3RhdGlvbi5jbGllbnQ/LmNsaWVudF9uYW1lIHx8IHF1b3RhdGlvbi5jbGllbnQ/Lm5hbWUgfHwgJy0nfTwvZGQ+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkdCBjbGFzc05hbWU9XCJ0ZXh0LVsxMXB4XSB0ZXh0LXppbmMtNDAwXCI+Q29udGFjdCBObzwvZHQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRkIGNsYXNzTmFtZT1cInRleHQtWzEzcHhdIGZvbnQtYm9sZCB0ZXh0LXppbmMtOTAwIG10LTAuNVwiPntxdW90YXRpb24uY29udGFjdF9ubyB8fCBxdW90YXRpb24uY2xpZW50Py5waG9uZSB8fCAnLSd9PC9kZD5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGR0IGNsYXNzTmFtZT1cInRleHQtWzExcHhdIHRleHQtemluYy00MDBcIj5HU1RJTjwvZHQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRkIGNsYXNzTmFtZT1cInRleHQtWzEzcHhdIGZvbnQtYm9sZCB0ZXh0LXppbmMtOTAwIG10LTAuNVwiPntxdW90YXRpb24uZ3N0aW4gfHwgcXVvdGF0aW9uLmNsaWVudD8uZ3N0aW4gfHwgJy0nfTwvZGQ+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkdCBjbGFzc05hbWU9XCJ0ZXh0LVsxMXB4XSB0ZXh0LXppbmMtNDAwXCI+U3RhdGU8L2R0PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkZCBjbGFzc05hbWU9XCJ0ZXh0LVsxM3B4XSBmb250LWJvbGQgdGV4dC16aW5jLTkwMCBtdC0wLjVcIj57cXVvdGF0aW9uLnN0YXRlIHx8IHF1b3RhdGlvbi5jbGllbnQ/LnN0YXRlIHx8ICctJ308L2RkPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTNcIj5cclxuICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICA8ZHQgY2xhc3NOYW1lPVwidGV4dC1bMTFweF0gdGV4dC16aW5jLTQwMFwiPlByb2plY3Q8L2R0PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkZCBjbGFzc05hbWU9XCJ0ZXh0LVsxM3B4XSBmb250LWJvbGQgdGV4dC16aW5jLTkwMCBtdC0wLjVcIj57cXVvdGF0aW9uLnByb2plY3Q/LnByb2plY3RfbmFtZSB8fCAnLSd9PC9kZD5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGR0IGNsYXNzTmFtZT1cInRleHQtWzExcHhdIHRleHQtemluYy00MDBcIj5CaWxsaW5nIEFkZHJlc3M8L2R0PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkZCBjbGFzc05hbWU9XCJ0ZXh0LVsxM3B4XSB0ZXh0LXppbmMtNjAwIG10LTAuNSBsZWFkaW5nLXNudWcgbGluZS1jbGFtcC0yXCI+e3F1b3RhdGlvbi5iaWxsaW5nX2FkZHJlc3MgfHwgJy0nfTwvZGQ+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICB7cXVvdGF0aW9uLnNoaXBwaW5nX2FkZHJlc3MgJiYgcXVvdGF0aW9uLnNoaXBwaW5nX2FkZHJlc3MgIT09IHF1b3RhdGlvbi5iaWxsaW5nX2FkZHJlc3MgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZHQgY2xhc3NOYW1lPVwidGV4dC1bMTFweF0gdGV4dC16aW5jLTQwMFwiPlNoaXBwaW5nIEFkZHJlc3M8L2R0PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRkIGNsYXNzTmFtZT1cInRleHQtWzEzcHhdIHRleHQtemluYy02MDAgbXQtMC41IGxlYWRpbmctc251ZyBsaW5lLWNsYW1wLTJcIj57cXVvdGF0aW9uLnNoaXBwaW5nX2FkZHJlc3N9PC9kZD5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1ib2xkIHRleHQtemluYy05MDAgbWItNlwiPkxpbmUgSXRlbXM8L2gzPlxyXG4gICAgICAgICAgICAgIHshcXVvdGF0aW9uLml0ZW1zIHx8IHF1b3RhdGlvbi5pdGVtcy5sZW5ndGggPT09IDAgPyAoXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtY2VudGVyIHB5LTEyIHRleHQtemluYy01MDBcIj5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZvbnQtbWVkaXVtIG1iLTJcIj5ObyBsaW5lIGl0ZW1zIGZvdW5kPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1zbVwiPlRoaXMgcXVvdGF0aW9uIG1heSBub3QgaGF2ZSBhbnkgaXRlbXMgc2F2ZWQgeWV0LjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgKSA6IChcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwib3ZlcmZsb3cteC1hdXRvIC1teC0xMlwiPlxyXG4gICAgICAgICAgICAgICAgICA8dGFibGUgY2xhc3NOYW1lPVwibWluLXctZnVsbCBib3JkZXIgYm9yZGVyLXppbmMtMjAwXCI+XHJcbiAgICAgICAgICAgICAgICAgIDx0aGVhZCBjbGFzc05hbWU9XCJiZy16aW5jLTEwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0ciBjbGFzc05hbWU9XCJib3JkZXItYiBib3JkZXItemluYy0yMDBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIHt0ZW1wbGF0ZXMuZmluZCh0ID0+IHQuaWQgPT09IHNlbGVjdGVkVGVtcGxhdGVJZCk/LmNvbHVtbl9zZXR0aW5ncz8ub3B0aW9uYWw/LnNubyAhPT0gZmFsc2UgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGggY2xhc3NOYW1lPVwiYm9yZGVyLXIgYm9yZGVyLXppbmMtMjAwXCIgc3R5bGU9e3sgcGFkZGluZzogJzE2cHggMTJweCcgfX0+PHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gZm9udC1ib2xkIHRleHQtemluYy01MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGJsb2NrXCI+Izwvc3Bhbj48L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgIHtxdW90YXRpb24uaXRlbXM/LnNvbWUoaSA9PiBpLnNhY19jb2RlIHx8IGkuaHNuX2NvZGUgfHwgaS5pdGVtPy5oc25fY29kZSkgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGggY2xhc3NOYW1lPVwiYm9yZGVyLXIgYm9yZGVyLXppbmMtMjAwXCIgc3R5bGU9e3sgcGFkZGluZzogJzE2cHggMTJweCcgfX0+PHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gZm9udC1ib2xkIHRleHQtemluYy01MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGJsb2NrXCI+SFNOL1NBQzwvc3Bhbj48L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgIHtxdW90YXRpb24uaXRlbXM/LnNvbWUoaSA9PiBpLml0ZW0/Lml0ZW1fY29kZSkgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGggY2xhc3NOYW1lPVwiYm9yZGVyLXIgYm9yZGVyLXppbmMtMjAwXCIgc3R5bGU9e3sgcGFkZGluZzogJzE2cHggMTJweCcgfX0+PHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gZm9udC1ib2xkIHRleHQtemluYy01MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGJsb2NrXCI+UGFydCBObzwvc3Bhbj48L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgIHtxdW90YXRpb24uaXRlbXM/LnNvbWUoaSA9PiBpLm1ha2UpICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoIGNsYXNzTmFtZT1cImJvcmRlci1yIGJvcmRlci16aW5jLTIwMFwiIHN0eWxlPXt7IHBhZGRpbmc6ICcxNnB4IDEycHgnIH19PjxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzEwcHhdIGZvbnQtYm9sZCB0ZXh0LXppbmMtNTAwIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciBibG9ja1wiPk1ha2U8L3NwYW4+PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8dGggY2xhc3NOYW1lPVwiYm9yZGVyLXIgYm9yZGVyLXppbmMtMjAwXCIgc3R5bGU9e3sgcGFkZGluZzogJzE2cHggMTJweCcgfX0+PHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gZm9udC1ib2xkIHRleHQtemluYy01MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGJsb2NrXCI+RGVzY3JpcHRpb248L3NwYW4+PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgIHtxdW90YXRpb24uaXRlbXM/LnNvbWUoaSA9PiBpLnZhcmlhbnRfaWQpICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoIGNsYXNzTmFtZT1cImJvcmRlci1yIGJvcmRlci16aW5jLTIwMFwiIHN0eWxlPXt7IHBhZGRpbmc6ICcxNnB4IDEycHgnIH19PjxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzEwcHhdIGZvbnQtYm9sZCB0ZXh0LXppbmMtNTAwIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciBibG9ja1wiPkRpc2NvdW50IENhdGVnb3J5PC9zcGFuPjwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgPHRoIGNsYXNzTmFtZT1cImJvcmRlci1yIGJvcmRlci16aW5jLTIwMFwiIHN0eWxlPXt7IHBhZGRpbmc6ICcxNnB4IDEycHgnIH19PjxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzEwcHhdIGZvbnQtYm9sZCB0ZXh0LXppbmMtNTAwIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciBibG9jayB0ZXh0LXJpZ2h0XCI+UXR5PC9zcGFuPjwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8dGggY2xhc3NOYW1lPVwiYm9yZGVyLXIgYm9yZGVyLXppbmMtMjAwXCIgc3R5bGU9e3sgcGFkZGluZzogJzE2cHggMTJweCcgfX0+PHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gZm9udC1ib2xkIHRleHQtemluYy01MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGJsb2NrXCI+VW5pdDwvc3Bhbj48L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHRoIGNsYXNzTmFtZT1cImJvcmRlci1yIGJvcmRlci16aW5jLTIwMFwiIHN0eWxlPXt7IHBhZGRpbmc6ICcxNnB4IDEycHgnIH19PjxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzEwcHhdIGZvbnQtYm9sZCB0ZXh0LXppbmMtNTAwIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciBibG9jayB0ZXh0LXJpZ2h0XCI+UmF0ZTwvc3Bhbj48L3RoPlxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgIHtxdW90YXRpb24uaXRlbXM/LnNvbWUoaSA9PiBpLmRpc2NvdW50X3BlcmNlbnQgPiAwKSAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBjbGFzc05hbWU9XCJib3JkZXItciBib3JkZXItemluYy0yMDBcIiBzdHlsZT17eyBwYWRkaW5nOiAnMTZweCAxMnB4JyB9fT48c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSBmb250LWJvbGQgdGV4dC16aW5jLTUwMCB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXIgYmxvY2sgdGV4dC1yaWdodFwiPkRpc2MgJTwvc3Bhbj48L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgIHtxdW90YXRpb24uaXRlbXM/LnNvbWUoaSA9PiBpLnRheF9wZXJjZW50ID4gMCkgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGggY2xhc3NOYW1lPVwiYm9yZGVyLXIgYm9yZGVyLXppbmMtMjAwXCIgc3R5bGU9e3sgcGFkZGluZzogJzE2cHggMTJweCcgfX0+PHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gZm9udC1ib2xkIHRleHQtemluYy01MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGJsb2NrIHRleHQtcmlnaHRcIj5UYXggJTwvc3Bhbj48L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgIHtxdW90YXRpb24uaXRlbXM/LnNvbWUoaSA9PiBpLmN1c3RvbTEpICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoIGNsYXNzTmFtZT1cImJvcmRlci1yIGJvcmRlci16aW5jLTIwMFwiIHN0eWxlPXt7IHBhZGRpbmc6ICcxNnB4IDEycHgnIH19PjxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzEwcHhdIGZvbnQtYm9sZCB0ZXh0LXppbmMtNTAwIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciBibG9ja1wiPnt0ZW1wbGF0ZXMuZmluZCh0ID0+IHQuaWQgPT09IHNlbGVjdGVkVGVtcGxhdGVJZCk/LmNvbHVtbl9zZXR0aW5ncz8ubGFiZWxzPy5jdXN0b20xIHx8ICdDdXN0b20gMSd9PC9zcGFuPjwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAge3F1b3RhdGlvbi5pdGVtcz8uc29tZShpID0+IGkuY3VzdG9tMikgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGggY2xhc3NOYW1lPVwiYm9yZGVyLXIgYm9yZGVyLXppbmMtMjAwXCIgc3R5bGU9e3sgcGFkZGluZzogJzE2cHggMTJweCcgfX0+PHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gZm9udC1ib2xkIHRleHQtemluYy01MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGJsb2NrXCI+e3RlbXBsYXRlcy5maW5kKHQgPT4gdC5pZCA9PT0gc2VsZWN0ZWRUZW1wbGF0ZUlkKT8uY29sdW1uX3NldHRpbmdzPy5sYWJlbHM/LmN1c3RvbTIgfHwgJ0N1c3RvbSAyJ308L3NwYW4+PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8dGggY2xhc3NOYW1lPVwiYm9yZGVyLXIgYm9yZGVyLXppbmMtMjAwXCIgc3R5bGU9e3sgcGFkZGluZzogJzE2cHggMTJweCcgfX0+PHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gZm9udC1ib2xkIHRleHQtemluYy01MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGJsb2NrIHRleHQtcmlnaHRcIj5Ub3RhbDwvc3Bhbj48L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgIDwvdGhlYWQ+XHJcbiAgICAgICAgICAgICAgICAgICA8dGJvZHkgY2xhc3NOYW1lPVwiYmctd2hpdGVcIj5cclxuICAgICAgICAgICAgICAgICAgICB7cXVvdGF0aW9uLml0ZW1zPy5tYXAoKGl0ZW0sIGluZGV4KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZW1wbGF0ZSA9IHRlbXBsYXRlcy5maW5kKHQgPT4gdC5pZCA9PT0gc2VsZWN0ZWRUZW1wbGF0ZUlkKTtcclxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdENvbHMgPSB0ZW1wbGF0ZT8uY29sdW1uX3NldHRpbmdzPy5vcHRpb25hbCB8fCB7fTtcclxuICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFzSFNOID0gcXVvdGF0aW9uLml0ZW1zPy5zb21lKGkgPT4gaS5zYWNfY29kZSB8fCBpLmhzbl9jb2RlIHx8IGkuaXRlbT8uaHNuX2NvZGUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFzSXRlbUNvZGUgPSBxdW90YXRpb24uaXRlbXM/LnNvbWUoaSA9PiBpLml0ZW0/Lml0ZW1fY29kZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoYXNNYWtlID0gcXVvdGF0aW9uLml0ZW1zPy5zb21lKGkgPT4gaS5tYWtlKTtcclxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhhc1ZhcmlhbnQgPSBxdW90YXRpb24uaXRlbXM/LnNvbWUoaSA9PiBpLnZhcmlhbnRfaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFzRGlzY291bnQgPSBxdW90YXRpb24uaXRlbXM/LnNvbWUoaSA9PiBpLmRpc2NvdW50X3BlcmNlbnQgPiAwKTtcclxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhhc1RheCA9IHF1b3RhdGlvbi5pdGVtcz8uc29tZShpID0+IGkudGF4X3BlcmNlbnQgPiAwKTtcclxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhhc0N1c3RvbTEgPSBxdW90YXRpb24uaXRlbXM/LnNvbWUoaSA9PiBpLmN1c3RvbTEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFzQ3VzdG9tMiA9IHF1b3RhdGlvbi5pdGVtcz8uc29tZShpID0+IGkuY3VzdG9tMik7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGl0ZW0uaXNfaGVhZGVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBjb2xDb3VudCA9IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvcHRDb2xzLnNubyAhPT0gZmFsc2UpIGNvbENvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoYXNIU04pIGNvbENvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoYXNJdGVtQ29kZSkgY29sQ291bnQrKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhhc01ha2UpIGNvbENvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbENvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoYXNWYXJpYW50KSBjb2xDb3VudCsrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xDb3VudCArPSAzO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGFzRGlzY291bnQpIGNvbENvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoYXNUYXgpIGNvbENvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoYXNDdXN0b20xKSBjb2xDb3VudCsrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGFzQ3VzdG9tMikgY29sQ291bnQrKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29sQ291bnQrKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8dHIga2V5PXtpdGVtLmlkfSBzdHlsZT17eyBiYWNrZ3JvdW5kOiAnI2Y4ZmFmYycgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgY29sU3Bhbj17Y29sQ291bnR9IHN0eWxlPXt7IHBhZGRpbmc6ICcxMHB4IDE0cHgnIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxM3B4XSBmb250LWJvbGQgdGV4dC16aW5jLTgwMFwiPntpdGVtLmRlc2NyaXB0aW9uIHx8ICdTZWN0aW9uJ308L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGl0ZW0uaXNfc3VidG90YWwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHN1YnRvdGFsQW1vdW50ID0gMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IGluZGV4IC0gMTsgaSA+PSAwOyBpLS0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmV2ID0gcXVvdGF0aW9uLml0ZW1zW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmV2LmlzX3N1YnRvdGFsIHx8IHByZXYuaXNfaGVhZGVyKSBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJ0b3RhbEFtb3VudCArPSBwYXJzZUZsb2F0KHByZXYubGluZV90b3RhbCkgfHwgMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgY29sQ291bnQgPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob3B0Q29scy5zbm8gIT09IGZhbHNlKSBjb2xDb3VudCsrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGFzSFNOKSBjb2xDb3VudCsrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGFzSXRlbUNvZGUpIGNvbENvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoYXNNYWtlKSBjb2xDb3VudCsrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xDb3VudCsrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGFzVmFyaWFudCkgY29sQ291bnQrKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29sQ291bnQgKz0gMztcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhhc0Rpc2NvdW50KSBjb2xDb3VudCsrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGFzVGF4KSBjb2xDb3VudCsrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGFzQ3VzdG9tMSkgY29sQ291bnQrKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhhc0N1c3RvbTIpIGNvbENvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbENvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHRyIGtleT17aXRlbS5pZH0gc3R5bGU9e3sgYmFja2dyb3VuZDogJyNmZWY5YzMnLCBib3JkZXJUb3A6ICcycHggc29saWQgI2VhYjMwOCcgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgY29sU3Bhbj17Y29sQ291bnR9IHN0eWxlPXt7IHBhZGRpbmc6ICcxMHB4IDE0cHgnIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywgYWxpZ25JdGVtczogJ2NlbnRlcicsIGp1c3RpZnlDb250ZW50OiAnZmxleC1lbmQnLCB3aWR0aDogJzEwMCUnLCBnYXA6ICcxNnB4JyB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxM3B4XSBmb250LWJvbGQgdGV4dC1hbWJlci03MDBcIiBzdHlsZT17eyB0ZXh0QWxpZ246ICdyaWdodCcgfX0+e2l0ZW0uc3VidG90YWxfbGFiZWwgfHwgJ1N1Yi10b3RhbDonfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxM3B4XSBmb250LWJvbGQgdGV4dC1hbWJlci03MDBcIiBzdHlsZT17eyBtaW5XaWR0aDogJzEwMHB4JywgdGV4dEFsaWduOiAncmlnaHQnIH19Pntmb3JtYXRDdXJyZW5jeShzdWJ0b3RhbEFtb3VudCl9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dHIga2V5PXtpdGVtLmlkfSBjbGFzc05hbWU9XCJib3JkZXItYiBib3JkZXItemluYy0xMDAgaG92ZXI6YmctemluYy01MC81MCB0cmFuc2l0aW9uLWNvbG9ycyBhbGlnbi10b3BcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7b3B0Q29scy5zbm8gIT09IGZhbHNlICYmIDx0ZCBjbGFzc05hbWU9XCJib3JkZXItciBib3JkZXItemluYy0xMDBcIiBzdHlsZT17eyBwYWRkaW5nOiAnMTRweCA3cHgnIH19PjxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzExcHhdIHRleHQtemluYy00MDAgZm9udC1tZWRpdW0gYmxvY2tcIj57U3RyaW5nKGluZGV4ICsgMSkucGFkU3RhcnQoMiwgJzAnKX08L3NwYW4+PC90ZD59XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge2hhc0hTTiAmJiA8dGQgY2xhc3NOYW1lPVwiYm9yZGVyLXIgYm9yZGVyLXppbmMtMTAwXCIgc3R5bGU9e3sgcGFkZGluZzogJzE0cHggN3B4JyB9fT48c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSB0ZXh0LXppbmMtNTAwIGZvbnQtbW9ubyBibG9ja1wiPntpdGVtLnNhY19jb2RlIHx8IGl0ZW0uaHNuX2NvZGUgfHwgaXRlbS5pdGVtPy5oc25fY29kZSB8fCAnLSd9PC9zcGFuPjwvdGQ+fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtoYXNJdGVtQ29kZSAmJiA8dGQgY2xhc3NOYW1lPVwiYm9yZGVyLXIgYm9yZGVyLXppbmMtMTAwXCIgc3R5bGU9e3sgcGFkZGluZzogJzE0cHggN3B4JyB9fT48c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSB0ZXh0LXppbmMtNTAwIGJsb2NrXCI+e2l0ZW0uaXRlbT8uaXRlbV9jb2RlIHx8ICctJ308L3NwYW4+PC90ZD59XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge2hhc01ha2UgJiYgPHRkIGNsYXNzTmFtZT1cImJvcmRlci1yIGJvcmRlci16aW5jLTEwMFwiIHN0eWxlPXt7IHBhZGRpbmc6ICcxNHB4IDdweCcgfX0+PHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gdGV4dC16aW5jLTQwMCBpdGFsaWMgYmxvY2tcIj57aXRlbS5tYWtlIHx8ICctJ308L3NwYW4+PC90ZD59XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cImJvcmRlci1yIGJvcmRlci16aW5jLTEwMFwiIHN0eWxlPXt7IHBhZGRpbmc6ICcxNHB4IDdweCcgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtWzEycHhdIGZvbnQtbWVkaXVtIHRleHQtemluYy05MDAgbGVhZGluZy10aWdodFwiPntpdGVtLml0ZW0/LmRpc3BsYXlfbmFtZSB8fCBpdGVtLml0ZW0/Lm5hbWUgfHwgJy0nfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2l0ZW0uZGVzY3JpcHRpb24gJiYgaXRlbS5kZXNjcmlwdGlvbiAhPT0gKGl0ZW0uaXRlbT8uZGlzcGxheV9uYW1lIHx8IGl0ZW0uaXRlbT8ubmFtZSkgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtWzExcHhdIHRleHQtemluYy01MDAgbGVhZGluZy1zbnVnIG10LTFcIj57aXRlbS5kZXNjcmlwdGlvbn08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7aXRlbS5vdmVycmlkZV9mbGFnICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIHB4LTEgcHktMC41IHJvdW5kZWQgdGV4dC1bOXB4XSBmb250LWJvbGQgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGJnLWFtYmVyLTUwIHRleHQtYW1iZXItNjAwIGJvcmRlciBib3JkZXItYW1iZXItMTAwXCI+TW9kaWZpZWQ8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge2hhc1ZhcmlhbnQgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cImJvcmRlci1yIGJvcmRlci16aW5jLTEwMFwiIHN0eWxlPXt7IHBhZGRpbmc6ICcxNHB4IDdweCcgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzExcHhdIHRleHQtemluYy01MDAgYmxvY2tcIj57YWxsVmFyaWFudHMuZmluZCh2ID0+IHYuaWQgPT09IGl0ZW0udmFyaWFudF9pZCk/LnZhcmlhbnRfbmFtZSB8fCAnLSd9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9XCJib3JkZXItciBib3JkZXItemluYy0xMDBcIiBzdHlsZT17eyBwYWRkaW5nOiAnMTRweCA3cHgnIH19PjxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzExcHhdIHRleHQtemluYy05MDAgdGV4dC1yaWdodCBmb250LW1lZGl1bSBibG9ja1wiPntpdGVtLnF0eX08L3NwYW4+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9e3sgcGFkZGluZzogJzE0cHggN3B4JyB9fT48c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSB0ZXh0LXppbmMtNDAwIGJsb2NrXCI+e2l0ZW0udW9tfTwvc3Bhbj48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9XCJib3JkZXItbCBib3JkZXItemluYy0xMDBcIiBzdHlsZT17eyBwYWRkaW5nOiAnMTRweCA3cHgnIH19PjxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzExcHhdIHRleHQtemluYy05MDAgdGV4dC1yaWdodCBibG9ja1wiPntmb3JtYXRDdXJyZW5jeShpdGVtLnJhdGUpfTwvc3Bhbj48L3RkPlxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7aGFzRGlzY291bnQgJiYgPHRkIHN0eWxlPXt7IHBhZGRpbmc6ICcxNHB4IDdweCcgfX0+PHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gdGV4dC1yZWQtNTAwIHRleHQtcmlnaHQgZm9udC1tZWRpdW0gYmxvY2tcIj57aXRlbS5kaXNjb3VudF9wZXJjZW50fSU8L3NwYW4+PC90ZD59XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge2hhc1RheCAmJiA8dGQgc3R5bGU9e3sgcGFkZGluZzogJzE0cHggN3B4JyB9fT48c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSB0ZXh0LXppbmMtNTAwIHRleHQtcmlnaHQgYmxvY2tcIj57aXRlbS50YXhfcGVyY2VudH0lPC9zcGFuPjwvdGQ+fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtoYXNDdXN0b20xICYmIDx0ZCBzdHlsZT17eyBwYWRkaW5nOiAnMTRweCA3cHgnIH19PjxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzEwcHhdIHRleHQtemluYy01MDAgYmxvY2tcIj57aXRlbS5jdXN0b20xIHx8ICctJ308L3NwYW4+PC90ZD59XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge2hhc0N1c3RvbTIgJiYgPHRkIHN0eWxlPXt7IHBhZGRpbmc6ICcxNHB4IDdweCcgfX0+PHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gdGV4dC16aW5jLTUwMCBibG9ja1wiPntpdGVtLmN1c3RvbTIgfHwgJy0nfTwvc3Bhbj48L3RkPn1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgY2xhc3NOYW1lPVwiYmctemluYy01MFwiIHN0eWxlPXt7IHBhZGRpbmc6ICcxNHB4IDdweCcgfX0+PHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTFweF0gZm9udC1ib2xkIHRleHQtemluYy05MDAgdGV4dC1yaWdodCBibG9ja1wiPntmb3JtYXRDdXJyZW5jeShpdGVtLmxpbmVfdG90YWwpfTwvc3Bhbj48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgICB9KX1cclxuICAgICAgICAgICAgICAgICAgPC90Ym9keT5cclxuICAgICAgICAgICAgICAgIDwvdGFibGU+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1lbmQgcHQtMTIgYm9yZGVyLXQgYm9yZGVyLXppbmMtMTAwXCI+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LWZ1bGwgbWF4LXctc20gc3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuIHRleHQtWzEzcHhdIHRleHQtemluYy01MDBcIj5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4+U3VidG90YWw8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZvbnQtYm9sZCB0ZXh0LXppbmMtOTAwXCI+e2Zvcm1hdEN1cnJlbmN5KHF1b3RhdGlvbi5zdWJ0b3RhbCl9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuIHRleHQtWzEzcHhdIHRleHQtemluYy01MDBcIj5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4+VG90YWwgSXRlbSBEaXNjb3VudDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1yZWQtNTAwIGZvbnQtYm9sZFwiPi0ge2Zvcm1hdEN1cnJlbmN5KHF1b3RhdGlvbi50b3RhbF9pdGVtX2Rpc2NvdW50KX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWJldHdlZW4gdGV4dC1bMTNweF0gdGV4dC16aW5jLTUwMFwiPlxyXG4gICAgICAgICAgICAgICAgICA8c3Bhbj5FeHRyYSBEaXNjb3VudCAoe3F1b3RhdGlvbi5leHRyYV9kaXNjb3VudF9wZXJjZW50fSUpPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXJlZC01MDAgZm9udC1ib2xkXCI+LSB7Zm9ybWF0Q3VycmVuY3kocXVvdGF0aW9uLmV4dHJhX2Rpc2NvdW50X2Ftb3VudCl9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHtxdW90YXRpb24uc3RhdGUgJiYgKG9yZ2FuaXNhdGlvbj8uc3RhdGUgfHwgJ01haGFyYXNodHJhJykgJiYgXHJcbiAgICAgICAgICAgICAgICBxdW90YXRpb24uc3RhdGUudHJpbSgpLnRvTG93ZXJDYXNlKCkgIT09IChvcmdhbmlzYXRpb24/LnN0YXRlIHx8ICdNYWhhcmFzaHRyYScpLnRyaW0oKS50b0xvd2VyQ2FzZSgpID8gKFxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuIHRleHQtWzEzcHhdIHRleHQtemluYy01MDBcIj5cclxuICAgICAgICAgICAgICAgICAgICA8c3Bhbj5JR1NUPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZvbnQtYm9sZCB0ZXh0LXppbmMtOTAwXCI+e2Zvcm1hdEN1cnJlbmN5KHF1b3RhdGlvbi50b3RhbF90YXgpfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICA8PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWJldHdlZW4gdGV4dC1bMTNweF0gdGV4dC16aW5jLTUwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4+Q0dTVDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZvbnQtYm9sZCB0ZXh0LXppbmMtOTAwXCI+e2Zvcm1hdEN1cnJlbmN5KHF1b3RhdGlvbi50b3RhbF90YXggLyAyKX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlbiB0ZXh0LVsxM3B4XSB0ZXh0LXppbmMtNTAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj5TR1NUPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1ib2xkIHRleHQtemluYy05MDBcIj57Zm9ybWF0Q3VycmVuY3kocXVvdGF0aW9uLnRvdGFsX3RheCAvIDIpfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPC8+XHJcbiAgICAgICAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWJldHdlZW4gdGV4dC1bMTNweF0gdGV4dC16aW5jLTUwMFwiPlxyXG4gICAgICAgICAgICAgICAgICA8c3Bhbj5Sb3VuZCBPZmY8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZvbnQtYm9sZCB0ZXh0LXppbmMtOTAwXCI+e2Zvcm1hdEN1cnJlbmN5KHF1b3RhdGlvbi5yb3VuZF9vZmYpfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicHQtNCBib3JkZXItdC0yIGJvcmRlci16aW5jLTkwMCBmbGV4IGp1c3RpZnktYmV0d2VlbiBpdGVtcy1jZW50ZXJcIj5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTVweF0gZm9udC1ib2xkIHRleHQtemluYy05MDAgdXBwZXJjYXNlXCI+R3JhbmQgVG90YWw8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtMnhsIGZvbnQtYmxhY2sgdGV4dC16aW5jLTkwMFwiPntmb3JtYXRDdXJyZW5jeShxdW90YXRpb24uZ3JhbmRfdG90YWwpfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICB7LyogVGVybXMgJiBDb25kaXRpb25zIFNlY3Rpb24gKi99XHJcbiAgICAgICAgICB7dGVybXNDb25kaXRpb25zUXVlcnkuZGF0YT8uY3VzdG9tX2NvbnRlbnQgJiYgKFxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTggYm9yZGVyLXQgYm9yZGVyLXppbmMtMjAwIHB0LThcIj5cclxuICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LWJvbGQgdGV4dC16aW5jLTkwMCBtYi00XCI+VGVybXMgJiBDb25kaXRpb25zPC9oMz5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXppbmMtNTAgcm91bmRlZC1sZyBwLTZcIj5cclxuICAgICAgICAgICAgICAgIHsoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRlcm1zRGF0YSA9IHR5cGVvZiB0ZXJtc0NvbmRpdGlvbnNRdWVyeS5kYXRhLmN1c3RvbV9jb250ZW50ID09PSAnc3RyaW5nJyBcclxuICAgICAgICAgICAgICAgICAgICAgID8gSlNPTi5wYXJzZSh0ZXJtc0NvbmRpdGlvbnNRdWVyeS5kYXRhLmN1c3RvbV9jb250ZW50KSBcclxuICAgICAgICAgICAgICAgICAgICAgIDogdGVybXNDb25kaXRpb25zUXVlcnkuZGF0YS5jdXN0b21fY29udGVudDtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGVybXNEYXRhICYmIHRlcm1zRGF0YS5zZWN0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRlcm1zRGF0YS5zZWN0aW9ucy5tYXAoKHNlY3Rpb246IGFueSwgc2VjdGlvbkluZGV4OiBudW1iZXIpID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBrZXk9e3NlY3Rpb25JbmRleH0gY2xhc3NOYW1lPVwibWItNCBsYXN0Om1iLTBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8aDQgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LXNlbWlib2xkIHRleHQtemluYy05MDAgbWItMlwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge3NlY3Rpb25JbmRleCArIDF9LiB7c2VjdGlvbi50aXRsZX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2g0PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtzZWN0aW9uLml0ZW1zICYmIHNlY3Rpb24uaXRlbXMubGVuZ3RoID4gMCAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7c2VjdGlvbi5pdGVtcy5tYXAoKGl0ZW06IGFueSwgaXRlbUluZGV4OiBudW1iZXIpID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGtleT17aXRlbUluZGV4fSBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtemluYy02MDAgZmxleCBpdGVtcy1zdGFydFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwibXItMiB0ZXh0LXppbmMtNDAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtpdGVtLml0ZW1fdHlwZSA9PT0gJ2J1bGxldCcgPyAn4oCiJyA6IGAke2l0ZW1JbmRleCArIDF9LmB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj57aXRlbS5jb250ZW50fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBGYWxsYmFjayB0byBwbGFpbiB0ZXh0IGlmIEpTT04gcGFyc2luZyBmYWlsc1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC16aW5jLTYwMCB3aGl0ZXNwYWNlLXByZS1saW5lXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHtTdHJpbmcodGVybXNDb25kaXRpb25zUXVlcnkuZGF0YS5jdXN0b21fY29udGVudCl9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICAgICAgfSkoKX1cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICApfVxyXG48L2Rpdj5cclxuICAgICAgPC9kaXY+XHJcbiAgICA8L1Jlc2l6YWJsZVBhbmVsPlxyXG4gICAgPC9SZXNpemFibGVQYW5lbEdyb3VwPlxyXG5cclxuICAgIHsvKiBQcmV2aWV3IE1vZGFsICovfVxyXG4gICAge3ByZXZpZXdNb2RhbE9wZW4gJiYgKFxyXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImZpeGVkIGluc2V0LTAgYmctYmxhY2svNjAgei01MCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBwLTRcIj5cclxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXdoaXRlIHJvdW5kZWQtbGcgdy1mdWxsIG1heC13LTR4bCBtYXgtaC1bOTV2aF0gZmxleCBmbGV4LWNvbCBzaGFkb3ctMnhsXCI+XHJcbiAgICAgICAgICB7LyogTW9kYWwgSGVhZGVyICovfVxyXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gcHgtNiBweS00IGJvcmRlci1iIGJnLXppbmMtNTAgcm91bmRlZC10LWxnXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTRcIj5cclxuICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwiZm9udC1zZW1pYm9sZCB0ZXh0LXppbmMtODAwIHRleHQtbGdcIj5cclxuICAgICAgICAgICAgICAgIFByZXZpZXcgLSB7cXVvdGF0aW9uPy5xdW90YXRpb25fbm8gfHwgJ1F1b3RhdGlvbid9XHJcbiAgICAgICAgICAgICAgPC9oMz5cclxuICAgICAgICAgICAgICB7cHJldmlld0xvYWRpbmcgJiYgKFxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiB0ZXh0LXNtIHRleHQtemluYy01MDBcIj5cclxuICAgICAgICAgICAgICAgICAgPExvYWRlcjIgY2xhc3NOYW1lPVwidy00IGgtNCBhbmltYXRlLXNwaW5cIiAvPlxyXG4gICAgICAgICAgICAgICAgICA8c3Bhbj5Mb2FkaW5nLi4uPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTNcIj5cclxuICAgICAgICAgICAgICB7LyogRWRpdCBCdXR0b24gKi99XHJcbiAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICBzZXRQcmV2aWV3TW9kYWxPcGVuKGZhbHNlKTtcclxuICAgICAgICAgICAgICAgICAgbmF2aWdhdGUoYC9xdW90YXRpb24vZWRpdD9pZD0ke3F1b3RhdGlvbklkfWApO1xyXG4gICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHB4LTQgcHktMiB0ZXh0LXNtIGJnLWJsdWUtNjAwIHRleHQtd2hpdGUgcm91bmRlZCBob3ZlcjpiZy1ibHVlLTcwMCB0cmFuc2l0aW9uLWNvbG9yc1wiXHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgPEVkaXQgY2xhc3NOYW1lPVwidy00IGgtNFwiIC8+XHJcbiAgICAgICAgICAgICAgICBFZGl0XHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgey8qIERvd25sb2FkIEJ1dHRvbiAqL31cclxuICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtkb3dubG9hZEZyb21QcmV2aWV3fVxyXG4gICAgICAgICAgICAgICAgZGlzYWJsZWQ9e3ByZXZpZXdMb2FkaW5nfVxyXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgcHgtNCBweS0yIHRleHQtc20gYmctZ3JlZW4tNjAwIHRleHQtd2hpdGUgcm91bmRlZCBob3ZlcjpiZy1ncmVlbi03MDAgdHJhbnNpdGlvbi1jb2xvcnMgZGlzYWJsZWQ6b3BhY2l0eS01MFwiXHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgPERvd25sb2FkIGNsYXNzTmFtZT1cInctNCBoLTRcIiAvPlxyXG4gICAgICAgICAgICAgICAgUERGXHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgey8qIFByaW50IEJ1dHRvbiAqL31cclxuICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtwcmludEZyb21QcmV2aWV3fVxyXG4gICAgICAgICAgICAgICAgZGlzYWJsZWQ9e3ByZXZpZXdMb2FkaW5nfVxyXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgcHgtNCBweS0yIHRleHQtc20gYmctemluYy02MDAgdGV4dC13aGl0ZSByb3VuZGVkIGhvdmVyOmJnLXppbmMtNzAwIHRyYW5zaXRpb24tY29sb3JzIGRpc2FibGVkOm9wYWNpdHktNTBcIlxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgIDxQcmludGVyIGNsYXNzTmFtZT1cInctNCBoLTRcIiAvPlxyXG4gICAgICAgICAgICAgICAgUHJpbnRcclxuICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICB7LyogQ2xvc2UgQnV0dG9uICovfVxyXG4gICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFByZXZpZXdNb2RhbE9wZW4oZmFsc2UpfVxyXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicC0yIHRleHQtemluYy01MDAgaG92ZXI6dGV4dC16aW5jLTcwMCBob3ZlcjpiZy16aW5jLTEwMCByb3VuZGVkIHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICA8WENpcmNsZSBjbGFzc05hbWU9XCJ3LTUgaC01XCIgLz5cclxuICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIFxyXG4gICAgICAgICAgey8qIE1vZGFsIENvbnRlbnQgKi99XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgtMSBvdmVyZmxvdy1hdXRvIGJnLXppbmMtMTAwIHAtNFwiPlxyXG4gICAgICAgICAgICB7cHJldmlld0xvYWRpbmcgPyAoXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBoLWZ1bGwgbWluLWgtWzQwMHB4XVwiPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LWNlbnRlclwiPlxyXG4gICAgICAgICAgICAgICAgICA8TG9hZGVyMiBjbGFzc05hbWU9XCJ3LTEwIGgtMTAgYW5pbWF0ZS1zcGluIHRleHQtYmx1ZS02MDAgbXgtYXV0byBtYi0zXCIgLz5cclxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC16aW5jLTUwMFwiPkdlbmVyYXRpbmcgcHJldmlldy4uLjwvcD5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgIDxkaXYgXHJcbiAgICAgICAgICAgICAgICBpZD1cInByZXZpZXctbW9kYWwtY29udGVudFwiXHJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy13aGl0ZSBteC1hdXRvIHNoYWRvdy1sZ1wiXHJcbiAgICAgICAgICAgICAgICBzdHlsZT17eyB3aWR0aDogJzIxMG1tJywgbWluSGVpZ2h0OiAnMjk3bW0nIH19XHJcbiAgICAgICAgICAgICAgICBkYW5nZXJvdXNseVNldElubmVySFRNTD17eyBfX2h0bWw6IERPTVB1cmlmeS5zYW5pdGl6ZShwcmV2aWV3SFRNTCkgfX1cclxuICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgKX1cclxuXHJcbiAgICB7LyogUERGIFByZXZpZXcgTW9kYWwgKi99XHJcbiAgICB7c2hvd1BkZlByZXZpZXdNb2RhbCAmJiAoXHJcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZml4ZWQgaW5zZXQtMCBiZy1ibGFjay82MCB6LTUwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHAtNFwiPlxyXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctd2hpdGUgcm91bmRlZC1sZyB3LWZ1bGwgbWF4LXctWzIxMG1tXSBoLVs5MHZoXSBmbGV4IGZsZXgtY29sIHNoYWRvdy0yeGwgb3ZlcmZsb3ctaGlkZGVuXCI+XHJcbiAgICAgICAgICB7LyogVG9vbGJhciAqL31cclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgcHgtNCBweS0yIGJnLXppbmMtMTAwIGJvcmRlci1iIGJvcmRlci16aW5jLTIwMCBzZWxlY3Qtbm9uZSBzaHJpbmstMCBqdXN0aWZ5LWJldHdlZW5cIiBzdHlsZT17eyBnYXA6ICc0cHgnIH19PlxyXG4gICAgICAgICAgICA8c3BhbiBzdHlsZT17eyBmb250U2l6ZTogJzEycHgnLCBmb250V2VpZ2h0OiA1MDAsIGNvbG9yOiAnIzZiNzI4MCcgfX0+e3F1b3RhdGlvbj8ucXVvdGF0aW9uX25vIHx8ICdRdW90YXRpb24nfTwvc3Bhbj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlclwiIHN0eWxlPXt7IGdhcDogJzZweCcgfX0+XHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHsgc2V0U2hvd1BkZlByZXZpZXdNb2RhbChmYWxzZSk7IG5hdmlnYXRlKGAvcXVvdGF0aW9uL2VkaXQ/aWQ9JHtxdW90YXRpb25JZH1gKTsgfX1cclxuICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgICAgICAgICBwYWRkaW5nOiAnN3B4IDE2cHgnLFxyXG4gICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6ICd0cmFuc3BhcmVudCcsXHJcbiAgICAgICAgICAgICAgICAgICAgYm9yZGVyOiAnMXB4IHNvbGlkICMxODVGQTUnLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbG9yOiAnIzE4NUZBNScsXHJcbiAgICAgICAgICAgICAgICAgICAgZm9udFNpemU6ICcxMnB4JyxcclxuICAgICAgICAgICAgICAgICAgICBmb250V2VpZ2h0OiA2MDAsXHJcbiAgICAgICAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiAnOHB4JyxcclxuICAgICAgICAgICAgICAgICAgICBjdXJzb3I6ICdwb2ludGVyJyxcclxuICAgICAgICAgICAgICAgICAgICBkaXNwbGF5OiAnZmxleCcsXHJcbiAgICAgICAgICAgICAgICAgICAgYWxpZ25JdGVtczogJ2NlbnRlcicsXHJcbiAgICAgICAgICAgICAgICAgICAgZ2FwOiAnNHB4JyxcclxuICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9uOiAnYWxsIDAuMTVzJ1xyXG4gICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICBvbk1vdXNlRW50ZXI9e2UgPT4geyBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuYmFja2dyb3VuZCA9ICcjZjBmNWZmJzsgfX1cclxuICAgICAgICAgICAgICAgICAgb25Nb3VzZUxlYXZlPXtlID0+IHsgZS5jdXJyZW50VGFyZ2V0LnN0eWxlLmJhY2tncm91bmQgPSAndHJhbnNwYXJlbnQnOyB9fVxyXG4gICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICA8RWRpdCBjbGFzc05hbWU9XCJ3LVsxNHB4XSBoLVsxNHB4XVwiIC8+IEVkaXRcclxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXthc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFwZGZQcmV2aWV3VXJsKSByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgIGlmIChuYXZpZ2F0b3Iuc2hhcmUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChwZGZQcmV2aWV3VXJsKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYmxvYiA9IGF3YWl0IHJlc3BvbnNlLmJsb2IoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZSA9IG5ldyBGaWxlKFtibG9iXSwgYCR7cXVvdGF0aW9uPy5xdW90YXRpb25fbm8gfHwgJ3F1b3RhdGlvbid9LnBkZmAsIHsgdHlwZTogJ2FwcGxpY2F0aW9uL3BkZicgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IG5hdmlnYXRvci5zaGFyZSh7IGZpbGVzOiBbZmlsZV0sIHRpdGxlOiBxdW90YXRpb24/LnF1b3RhdGlvbl9ubyB8fCAnUXVvdGF0aW9uJyB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KHdpbmRvdy5sb2NhdGlvbi5ocmVmKTtcclxuICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoZS5uYW1lICE9PSAnQWJvcnRFcnJvcicpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHsgYXdhaXQgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQod2luZG93LmxvY2F0aW9uLmhyZWYpOyB9IGNhdGNoIHt9XHJcbiAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6ICc3cHggMTZweCcsXHJcbiAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZDogJ3RyYW5zcGFyZW50JyxcclxuICAgICAgICAgICAgICAgICAgICBib3JkZXI6ICcxcHggc29saWQgI2QxZDVkYicsXHJcbiAgICAgICAgICAgICAgICAgICAgY29sb3I6ICcjMzc0MTUxJyxcclxuICAgICAgICAgICAgICAgICAgICBmb250U2l6ZTogJzEycHgnLFxyXG4gICAgICAgICAgICAgICAgICAgIGZvbnRXZWlnaHQ6IDUwMCxcclxuICAgICAgICAgICAgICAgICAgICBib3JkZXJSYWRpdXM6ICc4cHgnLFxyXG4gICAgICAgICAgICAgICAgICAgIGN1cnNvcjogJ3BvaW50ZXInLFxyXG4gICAgICAgICAgICAgICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcclxuICAgICAgICAgICAgICAgICAgICBhbGlnbkl0ZW1zOiAnY2VudGVyJyxcclxuICAgICAgICAgICAgICAgICAgICBnYXA6ICc0cHgnLFxyXG4gICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb246ICdhbGwgMC4xNXMnXHJcbiAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgIG9uTW91c2VFbnRlcj17ZSA9PiB7IGUuY3VycmVudFRhcmdldC5zdHlsZS5iYWNrZ3JvdW5kID0gJyNmOWZhZmInOyB9fVxyXG4gICAgICAgICAgICAgICAgICBvbk1vdXNlTGVhdmU9e2UgPT4geyBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuYmFja2dyb3VuZCA9ICd0cmFuc3BhcmVudCc7IH19XHJcbiAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICA8U2hhcmUyIGNsYXNzTmFtZT1cInctWzE0cHhdIGgtWzE0cHhdXCIgLz4gU2hhcmVcclxuICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7IHNldFNob3dQZGZQcmV2aWV3TW9kYWwoZmFsc2UpOyBpZiAocGRmUHJldmlld1VybCkgeyBVUkwucmV2b2tlT2JqZWN0VVJMKHBkZlByZXZpZXdVcmwpOyBzZXRQZGZQcmV2aWV3VXJsKG51bGwpOyB9IH19XHJcbiAgICAgICAgICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgICAgICAgICBwYWRkaW5nOiAnNnB4JyxcclxuICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZDogJ3RyYW5zcGFyZW50JyxcclxuICAgICAgICAgICAgICAgICAgYm9yZGVyOiAnbm9uZScsXHJcbiAgICAgICAgICAgICAgICAgIGNvbG9yOiAnIzljYTNhZicsXHJcbiAgICAgICAgICAgICAgICAgIGJvcmRlclJhZGl1czogJzZweCcsXHJcbiAgICAgICAgICAgICAgICAgIGN1cnNvcjogJ3BvaW50ZXInLFxyXG4gICAgICAgICAgICAgICAgICBkaXNwbGF5OiAnZmxleCcsXHJcbiAgICAgICAgICAgICAgICAgIGFsaWduSXRlbXM6ICdjZW50ZXInLFxyXG4gICAgICAgICAgICAgICAgICB0cmFuc2l0aW9uOiAnYWxsIDAuMTVzJ1xyXG4gICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgIG9uTW91c2VFbnRlcj17ZSA9PiB7IGUuY3VycmVudFRhcmdldC5zdHlsZS5jb2xvciA9ICcjMzc0MTUxJzsgZS5jdXJyZW50VGFyZ2V0LnN0eWxlLmJhY2tncm91bmQgPSAnI2U1ZTdlYic7IH19XHJcbiAgICAgICAgICAgICAgICBvbk1vdXNlTGVhdmU9e2UgPT4geyBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuY29sb3IgPSAnIzljYTNhZic7IGUuY3VycmVudFRhcmdldC5zdHlsZS5iYWNrZ3JvdW5kID0gJ3RyYW5zcGFyZW50JzsgfX1cclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICA8WENpcmNsZSBjbGFzc05hbWU9XCJ3LVsxOHB4XSBoLVsxOHB4XVwiIC8+XHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgey8qIFBERiBWaWV3ZXIgKi99XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgtMSBiZy16aW5jLTkwMCBtaW4taC0wXCI+XHJcbiAgICAgICAgICAgIHtwZGZQcmV2aWV3VXJsID8gKFxyXG4gICAgICAgICAgICAgIDxpZnJhbWUgc3JjPXtwZGZQcmV2aWV3VXJsfSBjbGFzc05hbWU9XCJ3LWZ1bGwgaC1mdWxsXCIgc3R5bGU9e3sgYm9yZGVyOiAnbm9uZScgfX0gdGl0bGU9XCJQREYgUHJldmlld1wiIC8+XHJcbiAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBoLWZ1bGxcIj48TG9hZGVyMiBjbGFzc05hbWU9XCJ3LTggaC04IGFuaW1hdGUtc3BpbiB0ZXh0LXppbmMtNDAwXCIgLz48L2Rpdj5cclxuICAgICAgICAgICAgKX1cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuICAgICl9XHJcblxyXG4gICAgey8qIFN0b2NrIENoZWNrIENvbmZpcm1hdGlvbiBNb2RhbCAqL31cclxuICAgIHtzaG93U3RvY2tDaGVja01vZGFsICYmIChcclxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJmaXhlZCBpbnNldC0wIHotWzIwMDBdIGJnLWJsYWNrLzQ1IGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyXCIgb25DbGljaz17KCkgPT4gc2V0U2hvd1N0b2NrQ2hlY2tNb2RhbChmYWxzZSl9PlxyXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctd2hpdGUgcm91bmRlZC1sZyBzaGFkb3ctMnhsIHctWzQyMHB4XSBtYXgtaC1bODB2aF0gb3ZlcmZsb3ctYXV0b1wiIG9uQ2xpY2s9eyhlKSA9PiBlLnN0b3BQcm9wYWdhdGlvbigpfT5cclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicC02IGJvcmRlci1iIGJvcmRlci16aW5jLTEwMFwiPlxyXG4gICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LWJvbGQgdGV4dC16aW5jLTkwMFwiPkxhdW5jaCBTdG9jayBDaGVjazwvaDM+XHJcbiAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC16aW5jLTUwMCBtdC0xXCI+Q3JlYXRlIGEgcHJvY3VyZW1lbnQgdHJhY2tlciBmcm9tIHRoaXMgcXVvdGF0aW9uJ3MgbGluZSBpdGVtcy48L3A+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicC02XCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctemluYy01MCBib3JkZXIgYm9yZGVyLXppbmMtMjAwIHJvdW5kZWQgcC00IG1iLTRcIj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zIG1iLTJcIj5cclxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtMnhsXCI+8J+Tpjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LWJvbGQgdGV4dC16aW5jLTkwMFwiPntxdW90YXRpb24ucXVvdGF0aW9uX25vIHx8ICdRdW90YXRpb24nfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC16aW5jLTUwMFwiPnsocXVvdGF0aW9uLml0ZW1zIHx8IFtdKS5maWx0ZXIoKGk6IGFueSkgPT4gIWkuaXNfaGVhZGVyKS5sZW5ndGh9IGxpbmUgaXRlbXMgd2lsbCBiZSBpbXBvcnRlZDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC16aW5jLTQwMCBzcGFjZS15LTFcIj5cclxuICAgICAgICAgICAgICA8cD7igKIgQk9RIHF1YW50aXRpZXMgd2lsbCBiZSBjb3BpZWQgYXMgcmVxdWlyZWQgcXVhbnRpdGllczwvcD5cclxuICAgICAgICAgICAgICA8cD7igKIgU3RvY2sgJiBsb2NhbCBxdWFudGl0aWVzIHN0YXJ0IGF0IDA8L3A+XHJcbiAgICAgICAgICAgICAgPHA+4oCiIFlvdSdsbCBiZSB0YWtlbiB0byB0aGUgcHJvY3VyZW1lbnQgdHJhY2tlciB0byBmaWxsIGdhcHM8L3A+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInAtNiBib3JkZXItdCBib3JkZXItemluYy0xMDAgZmxleCBnYXAtMyBqdXN0aWZ5LWVuZFwiPlxyXG4gICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd1N0b2NrQ2hlY2tNb2RhbChmYWxzZSl9XHJcbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicHgtNCBweS0yIHRleHQtc20gZm9udC1ib2xkIHRleHQtemluYy03MDAgYmctd2hpdGUgYm9yZGVyIGJvcmRlci16aW5jLTMwMCByb3VuZGVkIGhvdmVyOmJnLXppbmMtNTAgdHJhbnNpdGlvbi1jb2xvcnNcIlxyXG4gICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgQ2FuY2VsXHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlTGF1bmNoU3RvY2tDaGVja31cclxuICAgICAgICAgICAgICBkaXNhYmxlZD17bGF1bmNoaW5nU3RvY2tDaGVjayB8fCAhKHF1b3RhdGlvbi5pdGVtcyB8fCBbXSkuc29tZSgoaTogYW55KSA9PiAhaS5pc19oZWFkZXIpfVxyXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTQgcHktMiB0ZXh0LXNtIGZvbnQtYm9sZCB0ZXh0LXdoaXRlIGJnLWdyZWVuLTYwMCByb3VuZGVkIGhvdmVyOmJnLWdyZWVuLTcwMCB0cmFuc2l0aW9uLWNvbG9ycyBkaXNhYmxlZDpvcGFjaXR5LTUwIGRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiXHJcbiAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICB7bGF1bmNoaW5nU3RvY2tDaGVjayA/IChcclxuICAgICAgICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgICAgICAgIDxMb2FkZXIyIGNsYXNzTmFtZT1cInctNCBoLTQgYW5pbWF0ZS1zcGluXCIgLz5cclxuICAgICAgICAgICAgICAgICAgQ3JlYXRpbmcuLi5cclxuICAgICAgICAgICAgICAgIDwvPlxyXG4gICAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgICAnTGF1bmNoIFN0b2NrIENoZWNrJ1xyXG4gICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgKX1cclxuICAgIDwvPlxyXG4gICk7XHJcbn1cclxuXHJcbiJdLCJmaWxlIjoiQzovVXNlcnMvYWRtaW4vbWVwLXByb2plY3QvYXBwcy93ZWIvc3JjL3BhZ2VzL1F1b3RhdGlvblZpZXcudHN4In0=