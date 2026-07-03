import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  X, Upload, FileText, Check, Play, AlertTriangle, AlertCircle, 
  HelpCircle, RefreshCw, Trash2, ArrowRight, CornerDownRight 
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  parseCleanNumber, cleanUom, matchMaterial, 
  hasSizeMismatch, calculateJaccard, MatchCandidate 
} from '../utils/aiMatcher';

interface AiDocumentParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'Quotation' | 'Proforma' | 'Invoice' | 'Purchase Order';
  currentHeaderValues: {
    party_id?: string;
    party_name?: string;
    gstin?: string;
    date?: string;
    reference_number?: string;
    payment_terms?: string;
    place_of_supply?: string;
  };
  onImport: (data: {
    reviewSessionId: string;
    header: {
      party_id?: string;
      party_name?: string;
      gstin?: string;
      date?: string;
      reference_number?: string;
      payment_terms?: string;
      place_of_supply?: string;
      grand_total?: number;
    };
    items: Array<{
      product_name: string;
      description?: string;
      qty: number;
      uom: string;
      rate: number;
      tax_percent: number;
      cgst_percent?: number;
      sgst_percent?: number;
      igst_percent?: number;
      cess_percent?: number;
      hsn_code?: string;
      material_id?: string;
      imported_from_import_id?: string;
    }>;
  }) => void;
}

// Dynamically load PDF.js from cdnjs to avoid bundler packaging headaches in Turborepo/Vite
async function loadPdfJs() {
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js library.'));
    document.head.appendChild(script);
  });
}

// Compute client-side SHA-256 hash of raw file buffer
async function computeFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface PageMeta {
  pageNum: number;
  classification: 'COMMERCIAL' | 'DRAWING' | 'TERMS' | 'TECHNICAL' | 'OTHER';
  text: string;
  checked: boolean;
}

interface ReviewHeader {
  party_name: string;
  gstin?: string;
  date?: string;
  reference_number?: string;
  billing_address?: string;
  shipping_address?: string;
  payment_terms?: string;
  place_of_supply?: string;
  po_reference?: string;
  extracted_subtotal?: number;
  extracted_tax_total?: number;
  extracted_grand_total?: number;
  extracted_total_items_count?: number;
  classified_type?: string;
}

interface ReviewItem {
  id: string;
  product_name: string;
  description: string;
  qty: number;
  uom: string;
  rate: number;
  amount: number;
  discount_percent: number;
  tax_percent: number;
  cgst_percent: number;
  sgst_percent: number;
  igst_percent: number;
  cess_percent: number;
  hsn_code: string;
  confidence: number;
  matched: boolean;
  material_id: string | null;
  selected: boolean;
  candidates: MatchCandidate[];
  original_product_name: string; // Keep baseline to compute corrections count
}

export const AiDocumentParserModal: React.FC<AiDocumentParserModalProps> = ({
  isOpen,
  onClose,
  documentType,
  currentHeaderValues,
  onImport
}) => {
  const { organisation, user, session } = useAuth();
  const [step, setStep] = useState<'upload' | 'password' | 'pages' | 'parsing' | 'review'>('upload');
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  
  // File details
  const [file, setFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState('');
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [pagesMeta, setPagesMeta] = useState<PageMeta[]>([]);
  const [pdfPassword, setPdfPassword] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [totalDocumentPages, setTotalDocumentPages] = useState(1);
  const [sourceType, setSourceType] = useState<'TEXT' | 'VISION'>('TEXT');

  // Duplicate Warning Context
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  
  // Review grid states
  const [extractedHeader, setExtractedHeader] = useState<ReviewHeader | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [applyHeaderChecks, setApplyHeaderChecks] = useState<Record<string, boolean>>({});
  const [itemCountMismatch, setItemCountMismatch] = useState(false);
  const [subtotalMismatch, setSubtotalMismatch] = useState(false);
  const [reviewStartTime, setReviewStartTime] = useState<number>(0);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [fileRecordId, setFileRecordId] = useState<string | null>(null);

  // Quick Client/Vendor Sourcing state
  const [matchedPartyId, setMatchedPartyId] = useState<string | null>(null);
  const [matchedPartyName, setMatchedPartyName] = useState<string>('');
  const [partyCandidates, setPartyCandidates] = useState<Array<{ id: string; name: string }>>([]);
  const [isAddingParty, setIsAddingParty] = useState(false);

  // local Draft Recovery Storage
  const [draftFileHash, setDraftFileHash] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Clear state on close
      setStep('upload');
      setFile(null);
      setFileHash('');
      setPdfData(null);
      setPagesMeta([]);
      setPdfPassword('');
      setIsEncrypted(false);
      setDuplicateWarning(null);
      setExtractedHeader(null);
      setReviewItems([]);
      setItemCountMismatch(false);
      setSubtotalMismatch(false);
      setExtractionId(null);
      setFileRecordId(null);
      setMatchedPartyId(null);
      setPartyCandidates([]);
      setIsAddingParty(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Keyword-based classification helper (Section 5.17)
  const classifyPage = (text: string): PageMeta['classification'] => {
    const clean = text.toLowerCase();
    
    // Drawings Keywords
    if (/\b(dwg|drawing|tolerances|dimensions|scale|isometric|dimensions)\b/.test(clean)) {
      return 'DRAWING';
    }
    // Terms Keywords
    if (/\b(terms and conditions|terms & conditions|force majeure|jurisdiction|arbitration)\b/.test(clean)) {
      return 'TERMS';
    }
    // Technical datasheet Keywords
    if (/\b(datasheet|annexure|specifications|spec sheet|technical data)\b/.test(clean)) {
      return 'TECHNICAL';
    }
    // Commercial Keywords
    if (/\b(invoice|quotation|purchase order|qty|rate|gstin|amount|hsn|total|subtotal|bill to|ship to)\b/.test(clean)) {
      return 'COMMERCIAL';
    }
    
    return 'OTHER';
  };

  const handleFileDrop = async (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    let droppedFile: File | null = null;
    
    if ('files' in e.target && e.target.files) {
      droppedFile = e.target.files[0];
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      droppedFile = e.dataTransfer.files[0];
    }

    if (!droppedFile) return;
    
    if (droppedFile.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds the 10MB limit.');
      return;
    }

    setFile(droppedFile);
    setProgressMsg('Hashing file content...');
    setStep('parsing');
    setProgressPercent(10);

    try {
      const hash = await computeFileHash(droppedFile);
      setFileHash(hash);

      if (droppedFile.type === 'application/pdf') {
        const arrayBuffer = await droppedFile.arrayBuffer();
        setPdfData(arrayBuffer);
        
        const pdfjsLib: any = await loadPdfJs();
        let pdf;
        try {
          pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        } catch (err: any) {
          if (err.name === 'PasswordException') {
            setIsEncrypted(true);
            setStep('password');
            return;
          }
          throw err;
        }
        
        await processPdfPages(pdf, hash);
      } else if (droppedFile.type.startsWith('image/')) {
        // Single page image file
        setTotalDocumentPages(1);
        setSourceType('VISION');
        setPagesMeta([{
          pageNum: 1,
          classification: 'COMMERCIAL',
          text: '',
          checked: true
        }]);
        await checkDuplicateFile(hash);
        setStep('pages');
      } else {
        toast.error('Unsupported file format. Please upload a PDF or Image.');
        setStep('upload');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error initializing file parsing.');
      setStep('upload');
    }
  };

  const decryptPdf = async () => {
    if (!pdfData) return;
    try {
      const pdfjsLib: any = await loadPdfJs();
      const pdf = await pdfjsLib.getDocument({ data: pdfData, password: pdfPassword }).promise;
      setIsEncrypted(false);
      setStep('parsing');
      setProgressPercent(10);
      await processPdfPages(pdf, fileHash);
    } catch (err: any) {
      toast.error('Invalid decryption password. Please retry.');
    }
  };

  const processPdfPages = async (pdf: any, hash: string) => {
    setTotalDocumentPages(pdf.numPages);
    setProgressMsg('Scanning page text layers...');
    const pages: PageMeta[] = [];
    let hasDigitalText = false;
    let textLength = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      setProgressPercent(Math.round(20 + (i / pdf.numPages) * 30));
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const textItems = textContent.items.map((item: any) => item.str);
      const pageText = textItems.join(' ').trim();
      
      textLength += pageText.length;
      if (pageText.length > 5) {
        hasDigitalText = true;
      }

      const classification = classifyPage(pageText);
      pages.push({
        pageNum: i,
        classification,
        text: pageText,
        // Pre-check only commercial or other pages by default to save VLM costs
        checked: ['COMMERCIAL', 'OTHER'].includes(classification)
      });
    }

    // Set fallback source type based on text detection
    if (!hasDigitalText || textLength < 100) {
      setSourceType('VISION');
    } else {
      setSourceType('TEXT');
    }

    setPagesMeta(pages);
    setProgressPercent(100);
    
    // Check duplication in DB before displaying checklist
    await checkDuplicateFile(hash);
  };

  const checkDuplicateFile = async (hash: string) => {
    const { data: existingFile } = await supabase
      .from('document_files')
      .select(`
        id, 
        filename, 
        created_at,
        document_extractions(
          id, 
          status, 
          extracted_data
        )
      `)
      .eq('organisation_id', organisation?.id)
      .eq('file_hash', hash)
      .maybeSingle();

    if (existingFile) {
      setFileRecordId(existingFile.id);
      const successExt = existingFile.document_extractions?.find(
        (e: any) => e.status === 'SUCCESS'
      );
      
      if (successExt) {
        setDuplicateWarning({
          filename: existingFile.filename,
          date: new Date(existingFile.created_at).toLocaleDateString(),
          extraction: successExt
        });
      }
    }
    
    setStep('pages');
  };

  const triggerUploadAndAI = async (overrideCache = false) => {
    if (!organisation || !file) return;

    if (duplicateWarning && !overrideCache) {
      // Use cached extraction instantly
      setExtractionId(duplicateWarning.extraction.id);
      await loadParsedResultsIntoGrid(duplicateWarning.extraction.extracted_data);
      return;
    }

    setStep('parsing');
    setProgressPercent(10);
    setProgressMsg('Connecting proxy and validating limits...');

    try {
      const checkedPages = pagesMeta.filter(p => p.checked);
      if (checkedPages.length === 0) {
        toast.error('Please select at least 1 page to parse.');
        setStep('pages');
        return;
      }

      // Fetch custom layout hints (supplier layout memory - Section 3)
      let layoutHints: string | null = null;
      try {
        const { data: profiles, error: profileErr } = await supabase
          .from('supplier_profiles')
          .select('supplier_name, layout_hints')
          .eq('organisation_id', organisation.id);

        if (!profileErr && profiles && profiles.length > 0) {
          const preSelectedParty = currentHeaderValues?.party_name?.toLowerCase().trim();
          let matchedProfile = null;
          if (preSelectedParty) {
            matchedProfile = profiles.find(p => p.supplier_name.toLowerCase().trim() === preSelectedParty);
          }

          if (!matchedProfile && sourceType === 'TEXT') {
            const combinedText = checkedPages.map(p => p.text).join('\n').toLowerCase();
            matchedProfile = profiles.find(p => combinedText.includes(p.supplier_name.toLowerCase().trim()));
          }

          if (matchedProfile && matchedProfile.layout_hints) {
            layoutHints = matchedProfile.layout_hints;
          }
        }
      } catch (e) {
        console.warn('Failed to resolve supplier layout profile:', e);
      }

      let payload: any = {
        organisationId: organisation.id,
        fileHash,
        filename: file.name,
        pages: checkedPages.length,
        sourceType,
        documentType,
        layoutHints
      };

      if (sourceType === 'TEXT') {
        setProgressMsg('Compiling document text batches...');
        payload.text = checkedPages.map(p => p.text).join('\n\n');
      } else {
        // Vision Fallback (PDF page rendering to image)
        setProgressMsg('Rendering canvas pages (OCR Vision fallbacks)...');
        const imagesBase64: string[] = [];
        
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          const p = new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
          });
          reader.readAsDataURL(file);
          const base64Img = await p;
          imagesBase64.push(base64Img);
        } else {
          // PDF Canvas Renderings
          const pdfjsLib: any = await loadPdfJs();
          const pdf = await pdfjsLib.getDocument({ data: pdfData!, password: pdfPassword }).promise;
          
          for (let index = 0; index < checkedPages.length; index++) {
            const cp = checkedPages[index];
            setProgressMsg(`Rendering page ${cp.pageNum} to canvas...`);
            setProgressPercent(Math.round(20 + (index / checkedPages.length) * 30));
            
            const page = await pdf.getPage(cp.pageNum);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({ canvasContext: context, viewport }).promise;
            imagesBase64.push(canvas.toDataURL('image/png'));
          }
        }
        
        payload.images = imagesBase64;
      }

      setProgressMsg('Transmitting payload to AI Reasoner...');
      setProgressPercent(60);

      // Call secure serverless proxy endpoint
      const response = await fetch('/api/parse-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed serverless parsing request.');
      }

      const resData = await response.json();
      setExtractionId(resData.extraction_id);
      setFileRecordId(resData.file_id);
      
      await loadParsedResultsIntoGrid(resData.extracted_data);

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'AI document processing failed.');
      setStep('pages');
    }
  };

  const loadParsedResultsIntoGrid = async (data: any) => {
    setProgressMsg('Resolving database catalogs fuzzy matchings...');
    setProgressPercent(85);
    setReviewStartTime(Date.now());

    // Auto-save draft hash reference
    setDraftFileHash(`ai_draft_${fileHash}`);

    // Parse values
    const header: ReviewHeader = {
      party_name: data.party_name || '',
      gstin: data.gstin || '',
      date: data.date || '',
      reference_number: data.reference_number || '',
      billing_address: data.billing_address || '',
      shipping_address: data.shipping_address || '',
      payment_terms: data.payment_terms || '',
      place_of_supply: data.place_of_supply || '',
      po_reference: data.po_reference || '',
      extracted_subtotal: parseCleanNumber(data.extracted_subtotal),
      extracted_tax_total: parseCleanNumber(data.extracted_tax_total),
      extracted_grand_total: parseCleanNumber(data.extracted_grand_total),
      extracted_total_items_count: data.extracted_total_items_count || 0,
      classified_type: data.classified_type || ''
    };

    setExtractedHeader(header);

    // Initial side-by-side header apply checkboxes setup
    const initialHeaderChecks: Record<string, boolean> = {};
    if (header.party_name && !currentHeaderValues.party_name) initialHeaderChecks.party_name = true;
    if (header.gstin && !currentHeaderValues.gstin) initialHeaderChecks.gstin = true;
    if (header.date && !currentHeaderValues.date) initialHeaderChecks.date = true;
    if (header.reference_number && !currentHeaderValues.reference_number) initialHeaderChecks.reference_number = true;
    if (header.payment_terms && !currentHeaderValues.payment_terms) initialHeaderChecks.payment_terms = true;
    if (header.place_of_supply && !currentHeaderValues.place_of_supply) initialHeaderChecks.place_of_supply = true;
    
    setApplyHeaderChecks(initialHeaderChecks);

    // Sourced supplier/client from database
    const partyTable = documentType === 'Purchase Order' ? 'purchase_vendors' : 'clients';
    const partyNameCol = documentType === 'Purchase Order' ? 'company_name' : 'name';
    
    const { data: partyList } = await supabase
      .from(partyTable)
      .select(`id, ${partyNameCol}`)
      .eq('organisation_id', organisation?.id);

    if (partyList && header.party_name) {
      // Find top match
      const candidates = partyList.map((p: any) => {
        const similarity = calculateJaccard(header.party_name!, p[partyNameCol]);
        return { id: p.id, name: p[partyNameCol], similarity };
      })
      .filter(p => p.similarity > 0.1)
      .sort((a, b) => b.similarity - a.similarity);

      setPartyCandidates(candidates.slice(0, 5));

      const topParty = candidates[0];
      if (topParty && topParty.similarity >= 0.50) {
        setMatchedPartyId(topParty.id);
        setMatchedPartyName(topParty.name);
      } else {
        setMatchedPartyId(null);
      }
    }

    // Resolve item fuzzy matching (Step 5.2)
    const items: ReviewItem[] = [];
    const extractedItems = data.items || [];
    
    // Hallucination Guard: check row count differences
    const expectedCount = data.header?.extracted_total_items_count ? parseInt(String(data.header.extracted_total_items_count), 10) : null;
    const hasCountMismatch = expectedCount !== null && expectedCount !== extractedItems.length;
    setItemCountMismatch(hasCountMismatch);

    // Subtotal Reconciliation calculations
    let calculatedSubtotal = 0;
    for (let index = 0; index < extractedItems.length; index++) {
      const ext = extractedItems[index];
      const rate = parseCleanNumber(ext.rate);
      const qty = parseCleanNumber(ext.qty);
      calculatedSubtotal += parseCleanNumber(ext.amount || (rate * qty));
    }
    const expectedSubtotal = data.header?.extracted_subtotal ? parseCleanNumber(data.header.extracted_subtotal) : null;
    const hasSubtotalMismatch = expectedSubtotal !== null && Math.abs(calculatedSubtotal - expectedSubtotal) > 10;
    setSubtotalMismatch(hasSubtotalMismatch);

    for (let index = 0; index < extractedItems.length; index++) {
      const ext = extractedItems[index];
      const normalizedUom = cleanUom(ext.uom || 'nos');
      const rate = parseCleanNumber(ext.rate);
      const qty = parseCleanNumber(ext.qty);
      const amount = parseCleanNumber(ext.amount || (rate * qty));
      
      const mathCorrect = Math.abs((qty * rate) - amount) <= 5;
      const taxPercent = parseCleanNumber(ext.tax_percent || 18);
      
      // Perform database match queries concurrently or sequentially
      const match = await matchMaterial(supabase, organisation?.id, ext.product_name, ext.hsn_code);

      // Heuristic Confidence Calculation (Section 5.3)
      let confidence = 0;
      if (match.similarity === 1.0) confidence += 30; // alias-first
      else if (match.matched) confidence += 30; // fuzzy match
      
      if (ext.hsn_code && match.matched) confidence += 30; // hsn check
      if (mathCorrect) confidence += 20;
      if (taxPercent > 0) confidence += 20;

      // Penalize confidence if item count differs from VLM declared physical rows (Section 5.4)
      if (hasCountMismatch) {
        confidence = Math.max(0, confidence - 20);
      }

      items.push({
        id: crypto.randomUUID(),
        product_name: ext.product_name || '',
        description: ext.description || '',
        qty,
        uom: normalizedUom,
        rate,
        amount,
        discount_percent: parseCleanNumber(ext.discount_percent),
        tax_percent: taxPercent,
        cgst_percent: parseCleanNumber(ext.cgst_percent),
        sgst_percent: parseCleanNumber(ext.sgst_percent),
        igst_percent: parseCleanNumber(ext.igst_percent),
        cess_percent: parseCleanNumber(ext.cess_percent),
        hsn_code: ext.hsn_code || '',
        confidence,
        matched: match.matched,
        material_id: match.material_id,
        selected: true, // Default selected to import
        candidates: match.candidates,
        original_product_name: ext.product_name || ''
      });
    }

    setReviewItems(items);
    setProgressPercent(100);
    setStep('review');
    
    // Check if recovery draft is stored in local storage
    const savedDraft = localStorage.getItem(`ai_draft_${fileHash}`);
    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        setReviewItems(parsedDraft.items);
        setApplyHeaderChecks(parsedDraft.headerChecks);
        toast.info('📝 Resumed saved review draft from local storage.');
      } catch (e) {
        console.error('Failed to parse saved draft recovery.', e);
      }
    }
  };

  // Auto-saves state to local storage draft recovery (Phase 1.5)
  const saveLocalDraftState = (items: ReviewItem[], headerChecks: Record<string, boolean>) => {
    localStorage.setItem(`ai_draft_${fileHash}`, JSON.stringify({
      items,
      headerChecks,
      timestamp: Date.now()
    }));
  };

  const handleItemSelectToggle = (id: string) => {
    const updated = reviewItems.map(item => {
      if (item.id === id) return { ...item, selected: !item.selected };
      return item;
    });
    setReviewItems(updated);
    saveLocalDraftState(updated, applyHeaderChecks);
  };

  const handleFieldChange = (id: string, field: keyof ReviewItem, val: any) => {
    const updated = reviewItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: val };
        
        // Recalculate amount if rate or qty changes
        if (field === 'qty' || field === 'rate') {
          updatedItem.amount = updatedItem.qty * updatedItem.rate;
        }
        
        return updatedItem;
      }
      return item;
    });
    setReviewItems(updated);
    saveLocalDraftState(updated, applyHeaderChecks);
  };

  const handleHeaderCheckToggle = (field: string) => {
    const updated = { ...applyHeaderChecks, [field]: !applyHeaderChecks[field] };
    setApplyHeaderChecks(updated);
    saveLocalDraftState(reviewItems, updated);
  };

  const handleMatchedMaterialChange = (id: string, matId: string) => {
    const updated = reviewItems.map(item => {
      if (item.id === id) {
        const mat = item.candidates.find(c => c.id === matId);
        return {
          ...item,
          material_id: matId === 'NEW' || matId === 'SKIP' ? null : matId,
          matched: matId !== 'NEW' && matId !== 'SKIP'
        };
      }
      return item;
    });
    setReviewItems(updated);
    saveLocalDraftState(updated, applyHeaderChecks);
  };

  // Inline creates client or vendor
  const handleQuickPartyCreate = async () => {
    if (!extractedHeader?.party_name || !organisation) return;
    setIsAddingParty(true);
    
    try {
      const partyTable = documentType === 'Purchase Order' ? 'purchase_vendors' : 'clients';
      const nameCol = documentType === 'Purchase Order' ? 'company_name' : 'name';
      
      const insertPayload = {
        organisation_id: organisation.id,
        [nameCol]: extractedHeader.party_name,
        status: 'Active'
      };

      const { data, error } = await supabase
        .from(partyTable)
        .insert([insertPayload])
        .select()
        .single();

      if (error) throw error;

      setMatchedPartyId(data.id);
      setMatchedPartyName(data[nameCol]);
      toast.success(`Successfully created ${documentType === 'Purchase Order' ? 'Vendor' : 'Client'}: ${extractedHeader.party_name}`);
    } catch (e: any) {
      toast.error(`Creation failed: ${e.message}`);
    } finally {
      setIsAddingParty(false);
    }
  };

  // Inline create materials catalog writes (Section 5.4)
  const handleQuickMaterialCreate = async (id: string) => {
    const item = reviewItems.find(i => i.id === id);
    if (!item || !organisation) return;

    try {
      const materialData = {
        organisation_id: organisation.id,
        name: item.product_name,
        category: documentType === 'Purchase Order' ? 'raw_material' : 'finished_good',
        unit: item.uom,
        hsn_code: item.hsn_code || null,
        gst_rate: item.tax_percent,
        is_active: true,
        uses_variant: false,
        allow_purchase: true,
        allow_sales: true,
        show_in_bom: true,
        is_manufactured: false,
        item_classification: documentType === 'Purchase Order' ? 'raw_material' : 'goods_sold',
        item_type: 'product'
      };

      const { data, error } = await supabase
        .from('materials')
        .insert([materialData])
        .select()
        .single();

      if (error) throw error;

      // Update matched material id
      const updated = reviewItems.map(ri => {
        if (ri.id === id) {
          return {
            ...ri,
            material_id: data.id,
            matched: true,
            candidates: [{ id: data.id, name: data.name, category: data.category, similarity: 1.0 }, ...ri.candidates]
          };
        }
        return ri;
      });
      setReviewItems(updated);
      saveLocalDraftState(updated, applyHeaderChecks);
      
      toast.success(`Material catalog item created: ${data.name}`);
    } catch (e: any) {
      toast.error(`Failed to create catalog material: ${e.message}`);
    }
  };

  const handleImportSubmit = async () => {
    if (!session || !organisation || !user) return;
    const selectedItems = reviewItems.filter(i => i.selected);
    
    if (selectedItems.length === 0) {
      toast.error('No item lines selected for import.');
      return;
    }

    // Verify unmatched warnings
    const hasUnmatched = selectedItems.some(i => !i.matched);
    if (hasUnmatched) {
      toast.error('Please match or create catalog entries for all selected items, or uncheck them before import.');
      return;
    }

    // Classification mismatch warning confirmation (Section 6.3)
    const activeDocTypeMatches = 
      (documentType === 'Quotation' && extractedHeader?.classified_type === 'Quotation') ||
      (documentType === 'Invoice' && extractedHeader?.classified_type === 'Invoice') ||
      (documentType === 'Purchase Order' && extractedHeader?.classified_type === 'Purchase Order') ||
      (documentType === 'Proforma' && extractedHeader?.classified_type === 'Proforma');

    if (!activeDocTypeMatches && extractedHeader?.classified_type) {
      const confirmBypass = window.confirm(
        `⚠️ Document Type Mismatch: File is classified as "${extractedHeader.classified_type}" but you are importing it into a "${documentType}" screen. Proceed anyway?`
      );
      if (!confirmBypass) return;
    }

    const reviewEndTime = Date.now();
    const reviewDuration = Math.round((reviewEndTime - reviewStartTime) / 1000);
    const clientRequestId = crypto.randomUUID();

    // Sourced telemetry metrics
    const correctionsCount = reviewItems.reduce((acc, item) => {
      const nameChanged = item.product_name !== item.original_product_name;
      return acc + (nameChanged ? 1 : 0);
    }, 0);

    const avgConfidence = Math.round(
      selectedItems.reduce((sum, item) => sum + item.confidence, 0) / selectedItems.length
    );

    const warningsCount = reviewItems.reduce((acc, item) => {
      const mathMismatch = Math.abs((item.qty * item.rate) - item.amount) > 5;
      return acc + (mathMismatch ? 1 : 0);
    }, 0);

    try {
      // 1. Create document review session audit log (Concept B)
      const { data: sessionData, error: sessionError } = await supabase
        .from('document_review_sessions')
        .insert([{
          extraction_id: extractionId,
          organisation_id: organisation.id,
          user_id: user.id,
          request_id: clientRequestId,
          selected_items: selectedItems.length,
          total_items: reviewItems.length,
          review_duration_seconds: reviewDuration,
          corrections_count: correctionsCount,
          confidence_avg: avgConfidence,
          warning_count: warningsCount,
          status: 'IMPORTED',
          imported_data: {
            header: {
              party_id: matchedPartyId || undefined,
              party_name: matchedPartyName || extractedHeader?.party_name,
              gstin: extractedHeader?.gstin,
              date: extractedHeader?.date,
              reference_number: extractedHeader?.reference_number,
              place_of_supply: extractedHeader?.place_of_supply
            },
            items: selectedItems.map(item => ({
              product_name: item.product_name,
              qty: item.qty,
              uom: item.uom,
              rate: item.rate,
              amount: item.amount,
              tax_percent: item.tax_percent,
              material_id: item.material_id
            }))
          }
        }])
        .select('id')
        .single();

      if (sessionError) throw sessionError;

      // 2. Materialize items into document_import_items
      const materializedItems = selectedItems.map(item => ({
        review_session_id: sessionData.id,
        raw_name: item.product_name,
        resolved_material_id: item.material_id,
        confidence: item.confidence,
        warnings: Math.abs((item.qty * item.rate) - item.amount) > 5 ? ['math_mismatch'] : [],
        selected: true
      }));

      const { error: itemsInsertError } = await supabase
        .from('document_import_items')
        .insert(materializedItems);

      if (itemsInsertError) throw itemsInsertError;

      // 3. Upsert learned aliases and logs
      for (const item of selectedItems) {
        const exactAliasMatch = item.product_name.toLowerCase().trim() === item.candidates[0]?.name.toLowerCase().trim();
        if (item.material_id && !exactAliasMatch) {
          // Store mapping memory
          await supabase
            .from('catalog_aliases')
            .upsert({
              organisation_id: organisation.id,
              raw_name: item.product_name,
              resolved_material_id: item.material_id
            }, { onConflict: 'organisation_id,raw_name' });
        }
      }

      // 4. Return to parent callback hook
      const headerPayload: any = {};
      if (applyHeaderChecks.party_name && matchedPartyId) {
        headerPayload.party_id = matchedPartyId;
        headerPayload.party_name = matchedPartyName;
      }
      if (applyHeaderChecks.gstin) headerPayload.gstin = extractedHeader?.gstin;
      if (applyHeaderChecks.date) headerPayload.date = extractedHeader?.date;
      if (applyHeaderChecks.reference_number) headerPayload.reference_number = extractedHeader?.reference_number;
      if (applyHeaderChecks.payment_terms) headerPayload.payment_terms = extractedHeader?.payment_terms;
      if (applyHeaderChecks.place_of_supply) headerPayload.place_of_supply = extractedHeader?.place_of_supply;

      const itemsPayload = selectedItems.map(item => ({
        product_name: item.product_name,
        description: item.description,
        qty: item.qty,
        uom: item.uom,
        rate: item.rate,
        tax_percent: item.tax_percent,
        cgst_percent: item.cgst_percent,
        sgst_percent: item.sgst_percent,
        igst_percent: item.igst_percent,
        cess_percent: item.cess_percent,
        hsn_code: item.hsn_code,
        material_id: item.material_id!,
        imported_from_import_id: sessionData.id // Tag with session ID for undo support
      }));

      onImport({
        reviewSessionId: sessionData.id,
        header: headerPayload,
        items: itemsPayload
      });

      // Clear Recovery draft storage
      localStorage.removeItem(`ai_draft_${fileHash}`);
      toast.success('Successfully imported data to transaction editor.');
      onClose();

    } catch (e: any) {
      toast.error(`Import failed: ${e.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-xl shadow-2xl flex flex-col w-[95vw] h-[90vh] max-w-6xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-900/50 text-indigo-400 p-2 rounded-lg border border-indigo-800/50">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">AI Document Parser</h2>
              <p className="text-xs text-slate-400">Automated Quotation, Invoice, and PO extraction</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/40">
          {step === 'upload' && (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="w-full max-w-lg">
                <div 
                  className="border-2 border-dashed border-slate-800 hover:border-indigo-500 bg-slate-950/40 hover:bg-slate-950/80 rounded-xl p-12 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-4"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={() => document.getElementById('ai-file-picker')?.click()}
                >
                  <input 
                    type="file" 
                    id="ai-file-picker" 
                    className="hidden" 
                    accept="application/pdf,image/*" 
                    onChange={handleFileDrop}
                  />
                  <div className="bg-slate-900 text-slate-400 p-4 rounded-full border border-slate-800 shadow-md">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Drop your invoice, RFQ, or PO here</h3>
                    <p className="text-xs text-slate-400 mt-1">Accepts PDF or Image formats (Max 10MB)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'password' && (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl max-w-md w-full shadow-lg flex flex-col gap-4 text-center">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
                <div>
                  <h3 className="text-base font-semibold text-white">🔒 Password Protected PDF</h3>
                  <p className="text-xs text-slate-400 mt-1">Please enter the password to decrypt and parse this file.</p>
                </div>
                <input 
                  type="password" 
                  className="bg-slate-900 border border-slate-800 text-sm rounded-lg px-4 py-2.5 w-full text-slate-100 focus:outline-none focus:border-indigo-500"
                  placeholder="PDF Password"
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                />
                <div className="flex gap-3 justify-end mt-2">
                  <button 
                    onClick={() => setStep('upload')} 
                    className="px-4 py-2 text-sm bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={decryptPdf} 
                    className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium"
                  >
                    Decrypt & Parse
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'pages' && (
            <div className="h-full flex flex-col gap-6">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Document Loaded: {file?.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    We detected <span className="text-white font-medium">{totalDocumentPages} pages</span>. 
                    Default extraction mode set to: <span className="text-indigo-400 font-semibold">{sourceType}</span>
                  </p>
                </div>
                
                {/* Extraction Mode switcher */}
                <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-lg">
                  <button 
                    onClick={() => setSourceType('TEXT')}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${sourceType === 'TEXT' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Text Mode
                  </button>
                  <button 
                    onClick={() => setSourceType('VISION')}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${sourceType === 'VISION' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Vision Mode
                  </button>
                </div>
              </div>

              {duplicateWarning && (
                <div className="bg-amber-950/30 border border-amber-900/50 p-4 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white">Soft Warning: Duplicate Upload Detected</h4>
                    <p className="text-xs text-slate-300 mt-1">
                      This file was already successfully extracted as <strong>{duplicateWarning.filename}</strong> on {duplicateWarning.date}.
                    </p>
                    <div className="flex gap-3 mt-3">
                      <button 
                        onClick={() => triggerUploadAndAI(false)}
                        className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md font-semibold"
                      >
                        Reuse Cached AI Extraction (Instant)
                      </button>
                      <button 
                        onClick={() => triggerUploadAndAI(true)}
                        className="px-3 py-1.5 text-xs bg-amber-900/40 hover:bg-amber-900/60 text-amber-200 rounded-md font-semibold border border-amber-800"
                      >
                        Reparse Document Anyway (Uses Tokens)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Page selection grid */}
              <div className="flex-1 overflow-y-auto">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Select pages to process:</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {pagesMeta.map((page) => (
                    <div 
                      key={page.pageNum}
                      onClick={() => {
                        const updated = pagesMeta.map(p => p.pageNum === page.pageNum ? { ...p, checked: !p.checked } : p);
                        setPagesMeta(updated);
                      }}
                      className={`border p-4 rounded-xl cursor-pointer transition-all flex flex-col items-center justify-between gap-3 text-center ${
                        page.checked 
                          ? 'border-indigo-500 bg-indigo-950/20' 
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs text-slate-400 font-medium">Page {page.pageNum}</span>
                        <input 
                          type="checkbox" 
                          checked={page.checked}
                          readOnly
                          className="rounded border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 bg-slate-800 w-4 h-4"
                        />
                      </div>
                      
                      <div className="bg-slate-900 p-4 rounded border border-slate-800 flex items-center justify-center text-slate-600 w-16 h-20 shadow-inner">
                        <FileText className="w-8 h-8" />
                      </div>
                      
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold tracking-wide ${
                        page.classification === 'COMMERCIAL' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                        page.classification === 'DRAWING' ? 'bg-rose-950 text-rose-400 border border-rose-900' :
                        page.classification === 'TERMS' ? 'bg-amber-950 text-amber-400 border border-amber-900' :
                        page.classification === 'TECHNICAL' ? 'bg-blue-950 text-blue-400 border border-blue-900' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {page.classification}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Start Extraction button */}
              {!duplicateWarning && (
                <div className="flex justify-end mt-4">
                  <button 
                    onClick={() => triggerUploadAndAI(false)}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold flex items-center gap-2 shadow-lg hover:shadow-indigo-500/20 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Run AI Parse ({sourceType} Mode)
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'parsing' && (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="relative flex items-center justify-center">
                <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin" />
                <span className="absolute text-[10px] font-bold text-slate-300">{progressPercent}%</span>
              </div>
              <div className="text-center">
                <h3 className="text-base font-semibold text-white">AI Document Parser Running</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">{progressMsg}</p>
              </div>
            </div>
          )}

          {step === 'review' && extractedHeader && (
            <div className="flex flex-col gap-6 h-full">
              
              {/* Header Sourcing Side-by-Side verification */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
                <h3 className="text-sm font-semibold text-white mb-3">Header Sourcing Verification</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  
                  {/* Party match */}
                  <div className="border border-slate-800 bg-slate-900/40 p-3 rounded-lg flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Extracted Client/Vendor</span>
                      <input 
                        type="checkbox" 
                        checked={!!applyHeaderChecks.party_name}
                        onChange={() => handleHeaderCheckToggle('party_name')}
                        className="rounded border-slate-700 text-indigo-600 bg-slate-800"
                      />
                    </div>
                    <div className="text-sm font-semibold text-white">{extractedHeader.party_name || '-'}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-1 border-t border-slate-800 pt-1.5">
                      <span className="shrink-0">Database Match:</span>
                      {matchedPartyId ? (
                        <span className="text-emerald-400 font-medium truncate">{matchedPartyName}</span>
                      ) : (
                        <div className="flex items-center gap-1.5 w-full justify-between">
                          <span className="text-rose-400 font-medium">No Match</span>
                          <button 
                            disabled={isAddingParty}
                            onClick={handleQuickPartyCreate}
                            className="px-2 py-0.5 text-[9px] bg-indigo-900/50 hover:bg-indigo-800 border border-indigo-700 text-indigo-300 rounded"
                          >
                            {isAddingParty ? 'Creating...' : '+ Quick Create'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reference No */}
                  <div className="border border-slate-800 bg-slate-900/40 p-3 rounded-lg flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Extracted Reference No</span>
                      <input 
                        type="checkbox" 
                        checked={!!applyHeaderChecks.reference_number}
                        onChange={() => handleHeaderCheckToggle('reference_number')}
                        className="rounded border-slate-700 text-indigo-600 bg-slate-800"
                      />
                    </div>
                    <div className="text-sm font-semibold text-white">{extractedHeader.reference_number || '-'}</div>
                    <div className="text-[10px] text-slate-400 mt-1 border-t border-slate-800 pt-1.5">
                      Current Value: <span className="text-slate-300">{currentHeaderValues.reference_number || 'Empty'}</span>
                    </div>
                  </div>

                  {/* Document Date */}
                  <div className="border border-slate-800 bg-slate-900/40 p-3 rounded-lg flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Extracted Date</span>
                      <input 
                        type="checkbox" 
                        checked={!!applyHeaderChecks.date}
                        onChange={() => handleHeaderCheckToggle('date')}
                        className="rounded border-slate-700 text-indigo-600 bg-slate-800"
                      />
                    </div>
                    <div className="text-sm font-semibold text-white">{extractedHeader.date || '-'}</div>
                    <div className="text-[10px] text-slate-400 mt-1 border-t border-slate-800 pt-1.5">
                      Current Value: <span className="text-slate-300">{currentHeaderValues.date || 'Empty'}</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Mismatch Alerts Banners (Section 5.4) */}
              {(itemCountMismatch || subtotalMismatch) && (
                <div className="mb-4 space-y-2 shrink-0">
                  {itemCountMismatch && (
                    <div className="bg-rose-950/40 border border-rose-900/60 rounded-lg p-3 text-xs text-rose-300 flex items-start gap-2 animate-in slide-in-from-top">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                      <div>
                        <span className="font-semibold text-rose-200">Line Item Hallucination Guard Alert:</span> Physical row count mismatch. The document claims to contain {extractedHeader?.extracted_total_items_count} items, but only {reviewItems.length} lines were extracted. Confidence ratings have been penalized by 20%.
                      </div>
                    </div>
                  )}
                  {subtotalMismatch && (
                    <div className="bg-amber-950/40 border border-amber-900/60 rounded-lg p-3 text-xs text-amber-300 flex items-start gap-2 animate-in slide-in-from-top">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                      <div>
                        <span className="font-semibold text-amber-200">Subtotal Reconciliation Alert:</span> Sum of line items (₹{reviewItems.reduce((acc, i) => acc + (i.selected ? i.amount : 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}) does not reconcile with the extracted subtotal (₹{extractedHeader?.extracted_subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}). Check for potential OCR digit extraction errors.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Items Review table */}
              <div className="flex-1 overflow-hidden flex flex-col border border-slate-800 rounded-xl bg-slate-950">
                <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-semibold text-white">Line Items Verification</h3>
                  <div className="text-xs text-slate-400">
                    Selected <span className="text-indigo-400 font-bold">{reviewItems.filter(i => i.selected).length}</span> of {reviewItems.length} items
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 select-none">
                        <th className="p-3 w-10 text-center">
                          <input 
                            type="checkbox" 
                            checked={reviewItems.every(i => i.selected)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const updated = reviewItems.map(item => ({ ...item, selected: checked }));
                              setReviewItems(updated);
                              saveLocalDraftState(updated, applyHeaderChecks);
                            }}
                            className="rounded border-slate-700 text-indigo-600 bg-slate-800"
                          />
                        </th>
                        <th className="p-3 w-64">Extracted Description</th>
                        <th className="p-3 w-56">Matched Catalog Material</th>
                        <th className="p-3 w-16 text-center">Qty</th>
                        <th className="p-3 w-16 text-center">UOM</th>
                        <th className="p-3 w-24 text-right">Rate (₹)</th>
                        <th className="p-3 w-24 text-right">Amount (₹)</th>
                        <th className="p-3 w-16 text-center">GST %</th>
                        <th className="p-3 w-20 text-center">Confidence</th>
                        <th className="p-3 w-36">Alerts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewItems.map((item) => {
                        const mathMismatch = Math.abs((item.qty * item.rate) - item.amount) > 5;
                        return (
                          <tr 
                            key={item.id} 
                            className={`border-b border-slate-900 hover:bg-slate-900/30 transition-colors ${
                              !item.selected ? 'opacity-40 bg-slate-950/20' : ''
                            }`}
                          >
                            {/* Checkbox select */}
                            <td className="p-3 text-center">
                              <input 
                                type="checkbox" 
                                checked={item.selected}
                                onChange={() => handleItemSelectToggle(item.id)}
                                className="rounded border-slate-700 text-indigo-600 bg-slate-800"
                              />
                            </td>

                            {/* Product Name input */}
                            <td className="p-3 font-medium">
                              <input 
                                type="text"
                                className="bg-transparent border-0 focus:ring-1 focus:ring-indigo-500 rounded p-1 w-full text-slate-100 font-semibold focus:bg-slate-900"
                                value={item.product_name}
                                onChange={(e) => handleFieldChange(item.id, 'product_name', e.target.value)}
                              />
                            </td>

                            {/* Matched Material Dropdown */}
                            <td className="p-3">
                              {item.matched && item.material_id ? (
                                <div className="flex flex-col gap-1">
                                  <select 
                                    className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-100 w-full focus:outline-none focus:border-indigo-500"
                                    value={item.material_id}
                                    onChange={(e) => handleMatchedMaterialChange(item.id, e.target.value)}
                                  >
                                    {item.candidates.map(c => (
                                      <option key={c.id} value={c.id}>
                                        {c.name} ({Math.round(c.similarity * 100)}%)
                                      </option>
                                    ))}
                                    <option value="NEW">+ Create New Catalog Item</option>
                                    <option value="SKIP">⚠️ Don't Import This Row</option>
                                  </select>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 justify-between">
                                  <span className="text-rose-400 font-medium shrink-0">Unmatched Item</span>
                                  <button 
                                    onClick={() => handleQuickMaterialCreate(item.id)}
                                    className="px-2 py-1 text-[10px] bg-indigo-900/40 hover:bg-indigo-850 border border-indigo-750 text-indigo-300 rounded font-semibold shrink-0"
                                  >
                                    + Add to Catalog
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* Qty */}
                            <td className="p-3 text-center">
                              <input 
                                type="number"
                                className="bg-slate-900 border border-slate-800 rounded p-1 w-14 text-center text-slate-100"
                                value={item.qty}
                                onChange={(e) => handleFieldChange(item.id, 'qty', parseCleanNumber(e.target.value))}
                              />
                            </td>

                            {/* UOM */}
                            <td className="p-3 text-center">
                              <input 
                                type="text"
                                className="bg-slate-900 border border-slate-800 rounded p-1 w-14 text-center text-slate-100"
                                value={item.uom}
                                onChange={(e) => handleFieldChange(item.id, 'uom', e.target.value)}
                              />
                            </td>

                            {/* Rate */}
                            <td className="p-3 text-right">
                              <input 
                                type="number"
                                className="bg-slate-900 border border-slate-800 rounded p-1 w-20 text-right text-slate-100"
                                value={item.rate}
                                onChange={(e) => handleFieldChange(item.id, 'rate', parseCleanNumber(e.target.value))}
                              />
                            </td>

                            {/* Amount */}
                            <td className="p-3 text-right text-slate-300 font-semibold px-4">
                              ₹{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* GST % */}
                            <td className="p-3 text-center">
                              <div className="flex flex-col items-center">
                                <input 
                                  type="number"
                                  className="bg-slate-900 border border-slate-800 rounded p-1 w-12 text-center text-slate-100 font-medium"
                                  value={item.tax_percent}
                                  onChange={(e) => handleFieldChange(item.id, 'tax_percent', parseCleanNumber(e.target.value))}
                                />
                                {(item.cgst_percent > 0 || item.sgst_percent > 0 || item.igst_percent > 0) && (
                                  <span className="text-[9px] text-slate-500 mt-0.5 whitespace-nowrap">
                                    {item.igst_percent > 0 
                                      ? `IGST: ${item.igst_percent}%` 
                                      : `C:${item.cgst_percent}% S:${item.sgst_percent}%`
                                    }
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Confidence rating */}
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                item.confidence >= 90 ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                                item.confidence >= 70 ? 'bg-amber-950 text-amber-400 border border-amber-900' :
                                'bg-rose-950 text-rose-400 border border-rose-900'
                              }`}>
                                {item.confidence}%
                              </span>
                            </td>

                            {/* Warnings Alerts */}
                            <td className="p-3 text-slate-400">
                              {mathMismatch ? (
                                <div className="text-amber-500 font-semibold flex items-center gap-1.5 animate-pulse" title={`Calculated: ${item.qty} * ${item.rate} = ₹${(item.qty * item.rate).toLocaleString()} vs Extracted: ₹${item.amount.toLocaleString()}`}>
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span className="text-[10px]">Mismatch (₹{(item.qty * item.rate).toFixed(0)} vs ₹{item.amount.toFixed(0)})</span>
                                </div>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom import bar */}
              <div className="flex items-center justify-between border-t border-slate-800 pt-4 shrink-0 bg-slate-950 -mx-6 -mb-6 p-6">
                <button 
                  onClick={() => setStep('pages')}
                  className="px-5 py-2.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  Back to Pages
                </button>

                <button 
                  onClick={handleImportSubmit}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  Import Selected Items ({reviewItems.filter(i => i.selected).length})
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};
