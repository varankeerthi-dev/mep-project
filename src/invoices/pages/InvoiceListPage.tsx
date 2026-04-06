import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../hooks';
import { downloadInvoicePDF, emailInvoicePDF, previewInvoicePDF, printInvoicePDF } from '../pdf';
import { formatCurrency, formatDate, getInvoiceDisplayNumber } from '../ui-utils';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
} from '@/components/ui/pagination';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Filter,
    ArrowUpDown,
    Search,
    RefreshCw,
    GripVertical,
    Download,
    Upload,
    FileJson,
    FileSpreadsheet,
    FileText,
    Share2,
    Copy,
    Eye,
    Printer,
    Mail,
    Loader2,
    MoreHorizontal,
} from 'lucide-react';

const StatusBadge = ({ status }: { status: string }) => {
    const statusStyles: Record<string, string> = {
        Rejected: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        Accepted: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
        'Under Review': 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
        Processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    };

    const displayStatus = status === 'final' ? 'Accepted' : status === 'draft' ? 'Processing' : status;

    return (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium border transition-colors duration-200 cursor-default ${statusStyles[displayStatus] || 'bg-muted text-muted-foreground border-border'}`}
        >
            {displayStatus}
        </span>
    );
};

export default function InvoiceListPage() {
    const navigate = useNavigate();
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'final'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [activePdfAction, setActivePdfAction] = useState<{
        invoiceId: string;
        action: 'preview' | 'download' | 'print' | 'email';
    } | null>(null);

    const invoicesQuery = useInvoices({
        status: statusFilter === 'all' ? undefined : statusFilter,
    });

    // Transform real invoice data to table format
    const invoiceData = useMemo(() => {
        if (!invoicesQuery.data) return [];
        
        return invoicesQuery.data.map((invoice) => ({
            id: invoice.id || '',
            company: invoice.client?.name?.split(' ')[0] || 'Unknown',
            clientName: invoice.client?.name || 'Unknown Client',
            clientGst: invoice.client?.gst_number || '',
            dealValue: formatCurrency(invoice.total),
            rawTotal: invoice.total,
            businessReport: `Invoice from ${invoice.source_type || 'direct'}`,
            invoiceDate: formatDate(invoice.created_at),
            status: invoice.status === 'final' ? 'Accepted' : invoice.status === 'draft' ? 'Processing' : invoice.status,
            rawStatus: invoice.status,
            category: invoice.source_type || 'Direct',
            rawInvoice: invoice,
        }));
    }, [invoicesQuery.data]);

    // Filter by search query
    const filteredData = useMemo(() => {
        if (!searchQuery) return invoiceData;
        
        return invoiceData.filter((row) =>
            row.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            row.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
            row.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [invoiceData, searchQuery]);

    // Pagination
    const totalResults = filteredData.length;
    const totalPages = Math.ceil(totalResults / rowsPerPage);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, currentPage, rowsPerPage]);

    const toggleSelectAll = () => {
        if (selectedRows.length === paginatedData.length) {
            setSelectedRows([]);
        } else {
            setSelectedRows(paginatedData.map((row) => row.id));
        }
    };

    const toggleSelectRow = (id: string) => {
        setSelectedRows((prev) =>
            prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
        );
    };

    const isAllSelected = selectedRows.length === paginatedData.length && paginatedData.length > 0;
    const selectedCount = selectedRows.length;

    const handlePdfAction = async (invoiceId: string, action: 'preview' | 'download' | 'print' | 'email') => {
        setActivePdfAction({ invoiceId, action });
        try {
            switch (action) {
                case 'preview':
                    await previewInvoicePDF(invoiceId);
                    break;
                case 'download':
                    await downloadInvoicePDF(invoiceId);
                    break;
                case 'print':
                    await printInvoicePDF(invoiceId);
                    break;
                case 'email':
                    await emailInvoicePDF(invoiceId);
                    break;
            }
        } finally {
            setActivePdfAction(null);
        }
    };

    if (invoicesQuery.isLoading) {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-background">
                <RefreshCw className="size-8 text-primary animate-spin mb-4" />
                <p className="text-sm font-medium">Loading invoices...</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-background text-foreground">
            {/* Header */}
            <div className="flex sm:flex-row sm:items-center justify-between px-4 py-3 bg-neutral-950/5 dark:bg-neutral-900 border-b border-border gap-4 sm:gap-2">
                <div className="flex items-center gap-2">
                    <button 
                        className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => navigate('/dashboard')}
                    >
                        <ChevronLeft className="size-4" />
                    </button>
                    <h1 className="text-sm font-medium text-foreground">Invoice Manager</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger>
                            <Button size="sm" className="text-[10px] sm:text-xs bg-white text-muted-foreground rounded hover:bg-white/80 dark:bg-muted dark:hover:bg-muted/80 h-8 sm:h-9 hidden sm:flex border border-border transition-colors duration-200 hover:shadow-sm">
                                <Download className="size-3 mr-1.5" />Import & Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem>
                                <Upload className="size-4 mr-2" />
                                Import CSV
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <FileSpreadsheet className="size-4 mr-2" />
                                Export Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <FileText className="size-4 mr-2" />
                                Export PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <FileJson className="size-4 mr-2" />
                                Export JSON
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Dialog>
                        <DialogTrigger>
                            <Button 
                                size="sm" 
                                className="text-[10px] sm:text-xs bg-white text-muted-foreground rounded hover:bg-white/80 dark:bg-muted dark:hover:bg-muted/80 h-8 sm:h-9 border border-border transition-colors duration-200 hover:shadow-sm"
                                onClick={() => navigate('/invoices/create')}
                            >
                                <Plus className="size-3.5" />
                                <span className="hidden xs:inline">Add New</span>
                                <span className="xs:hidden">Add</span>
                            </Button>
                        </DialogTrigger>
                    </Dialog>

                    <Dialog>
                        <DialogTrigger>
                            <Button size="sm" className="text-[10px] sm:text-xs bg-white text-muted-foreground rounded hover:bg-white/80 dark:bg-muted dark:hover:bg-muted/80 h-8 sm:h-9 hidden sm:flex border border-border transition-colors duration-200 hover:shadow-sm">
                                <Share2 className="size-3 mr-1.5" />Share
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Share Invoice</DialogTitle>
                                <DialogDescription>
                                    Anyone with the link can view this invoice.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex items-center space-x-2 py-4">
                                <div className="grid flex-1 gap-2">
                                    <Label htmlFor="link" className="sr-only">Link</Label>
                                    <Input
                                        id="link"
                                        defaultValue="https://watermelon.xyz/invoice/inv-7821"
                                        readOnly
                                        className="focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-neutral-400 dark:focus-visible:border-neutral-600 outline-none shadow-none"
                                    />
                                </div>
                                <Button type="submit" size="sm" className="px-3">
                                    <span className="sr-only">Copy</span>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                            <DialogFooter className="sm:justify-start">
                                <Button type="button" variant="secondary" className="w-full">
                                    Email Link
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between px-4 py-3 border-b border-border gap-4 lg:gap-2">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <Dialog>
                        <DialogTrigger>
                            <Button size="sm" variant="ghost" className="text-[10px] sm:text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 gap-1.5 h-8 sm:h-9 transition-colors duration-200 hover:shadow-sm">
                                <RefreshCw className="size-3.5" />Update
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Data Synchronization</DialogTitle>
                                <DialogDescription>
                                    Refreshing your dashboard with the latest data from the server.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col items-center justify-center py-8 gap-4">
                                <RefreshCw className="size-8 text-primary animate-spin" />
                                <p className="text-sm font-medium">Syncing invoices...</p>
                                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-primary h-full w-[65%] rounded-full animate-pulse" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="secondary" className="w-full">Cancel Sync</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    
                    {selectedCount > 0 && (
                        <span className="text-[10px] sm:text-xs bg-muted flex items-center justify-center text-muted-foreground px-2.5 py-1.5 h-8 sm:h-9 sm:py-2 rounded font-medium transition-all animate-in fade-in zoom-in-95 duration-200">
                            {selectedCount} Selected
                        </span>
                    )}
                    
                    <Popover>
                        <PopoverTrigger>
                            <Button size="sm" variant="ghost" className="text-[10px] sm:text-xs text-muted-foreground bg-muted rounded hover:bg-muted/80 gap-1.5 h-8 sm:h-9 transition-colors duration-200 hover:shadow-sm">
                                <Filter className="size-3.5" />Filter
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3">
                            <div className="space-y-3">
                                <h4 className="font-medium text-xs leading-none">Status Filter</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Checkbox 
                                            id="status-all" 
                                            checked={statusFilter === 'all'}
                                            onCheckedChange={() => setStatusFilter('all')}
                                        />
                                        <Label htmlFor="status-all" className="text-xs">All</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox 
                                            id="status-final" 
                                            checked={statusFilter === 'final'}
                                            onCheckedChange={() => setStatusFilter('final')}
                                        />
                                        <Label htmlFor="status-final" className="text-xs">Final</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox 
                                            id="status-draft" 
                                            checked={statusFilter === 'draft'}
                                            onCheckedChange={() => setStatusFilter('draft')}
                                        />
                                        <Label htmlFor="status-draft" className="text-xs">Draft</Label>
                                    </div>
                                </div>
                                <Button size="sm" className="w-full text-xs h-7" onClick={() => invoicesQuery.refetch()}>
                                    Apply Filters
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <DropdownMenu>
                        <DropdownMenuTrigger>
                            <Button size="sm" variant="ghost" className="text-[10px] sm:text-xs text-muted-foreground bg-muted rounded hover:bg-muted/80 gap-1.5 h-8 sm:h-9 transition-colors duration-200 hover:shadow-sm">
                                <ArrowUpDown className="size-3.5" />Sort
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuItem>Date: Newest First</DropdownMenuItem>
                            <DropdownMenuItem>Date: Oldest First</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Value: High to Low</DropdownMenuItem>
                            <DropdownMenuItem>Value: Low to High</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <span className="text-[10px] sm:text-xs text-muted-foreground font-medium ml-2">
                        {totalResults} Results
                    </span>
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto">
                    <div className="relative w-full lg:w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search for the client"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-muted/40 border border-border rounded px-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-neutral-400 dark:focus-visible:border-neutral-600 shadow-none transition-colors"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="border-border bg-neutral-950/5 dark:bg-neutral-950">
                            <TableHead className="text-xs text-muted-foreground font-medium border-r border-border">
                                <div className="flex items-center gap-3">
                                    <GripVertical className="size-4 text-muted-foreground/40" />
                                    <Checkbox
                                        checked={isAllSelected}
                                        onCheckedChange={toggleSelectAll}
                                        className="border-border"
                                    />
                                    <span>Company</span>
                                </div>
                            </TableHead>
                            <TableHead className="text-[10px] sm:text-xs text-muted-foreground font-medium border-r border-border min-w-[150px]">Client Name</TableHead>
                            <TableHead className="text-[10px] sm:text-xs text-muted-foreground font-medium border-r border-border">Deal Value</TableHead>
                            <TableHead className="text-[10px] sm:text-xs text-muted-foreground font-medium border-r border-border">Source</TableHead>
                            <TableHead className="text-[10px] sm:text-xs text-muted-foreground font-medium border-r border-border">Invoice Date</TableHead>
                            <TableHead className="text-[10px] sm:text-xs text-muted-foreground font-medium border-r border-border">Status</TableHead>
                            <TableHead className="text-[10px] sm:text-xs text-muted-foreground font-medium">Actions</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody className="[&_tr:last-child]:border-b">
                        {paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12">
                                    <FileText className="size-12 mx-auto mb-4 text-muted-foreground/40" />
                                    <p className="text-sm font-medium text-foreground">No invoices found</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Try adjusting your filters or create your first invoice
                                    </p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className={`border-border hover:bg-muted/20 border-b transition-colors duration-200 ${selectedRows.includes(row.id) ? 'bg-muted/30' : ''}`}
                                    data-state={selectedRows.includes(row.id) ? 'selected' : undefined}
                                >
                                    <TableCell className="border-r border-border">
                                        <div className="flex items-center gap-3">
                                            <GripVertical className="size-4 text-muted-foreground/40 cursor-grab" />
                                            <Checkbox
                                                checked={selectedRows.includes(row.id)}
                                                onCheckedChange={() => toggleSelectRow(row.id)}
                                                className="border-border"
                                            />
                                            <span className="text-xs text-foreground font-medium">{row.company}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="border-r border-border min-w-[150px]">
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={`https://avatar.vercel.sh/${row.clientName}`}
                                                alt={row.clientName}
                                                width={22.5}
                                                height={22.5}
                                                className="rounded-full"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] sm:text-xs text-foreground font-medium">{row.clientName}</span>
                                                {row.clientGst && (
                                                    <span className="text-[10px] text-muted-foreground">GST: {row.clientGst}</span>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-[10px] sm:text-xs text-foreground font-medium border-r border-border">
                                        {row.dealValue}
                                    </TableCell>
                                    <TableCell className="text-[10px] sm:text-xs text-muted-foreground max-w-xs truncate border-r border-border">
                                        {row.businessReport}
                                    </TableCell>
                                    <TableCell className="text-[10px] sm:text-xs text-muted-foreground border-r border-border">
                                        {row.invoiceDate}
                                    </TableCell>
                                    <TableCell className="border-r border-border">
                                        <StatusBadge status={row.rawStatus} />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 justify-end">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 px-2 text-xs"
                                                onClick={() => navigate(`/invoices/edit?id=${row.id}`)}
                                            >
                                                View
                                            </Button>
                                            
                                            <DropdownMenu>
                                                <DropdownMenuTrigger>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-7 w-7 p-0"
                                                        disabled={activePdfAction?.invoiceId === row.id}
                                                    >
                                                        {activePdfAction?.invoiceId === row.id ? (
                                                            <Loader2 className="size-4 animate-spin" />
                                                        ) : (
                                                            <MoreHorizontal className="size-4" />
                                                        )}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40">
                                                    <DropdownMenuItem onClick={() => handlePdfAction(row.id, 'preview')}>
                                                        <Eye className="size-4 mr-2" /> Preview
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handlePdfAction(row.id, 'download')}>
                                                        <Download className="size-4 mr-2" /> Download
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handlePdfAction(row.id, 'print')}>
                                                        <Printer className="size-4 mr-2" /> Print
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handlePdfAction(row.id, 'email')}>
                                                        <Mail className="size-4 mr-2" /> Email
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col md:flex-row items-center justify-between px-4 py-3 border-t border-border gap-4 md:gap-2 bg-background">
                <div className="text-xs text-muted-foreground font-medium order-2 md:order-1 max-w-xs truncate">
                    {totalResults > 0 ? `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(currentPage * rowsPerPage, totalResults)} of ${totalResults}` : '0 results'}
                </div>
                
                <Pagination className="order-1 md:order-2">
                    <PaginationContent className="gap-1">
                        <PaginationItem>
                            <button
                                className="size-8 sm:size-7 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors duration-200 disabled:opacity-50"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                                <ChevronLeft className="size-4" />
                            </button>
                        </PaginationItem>
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((page) => (
                            <PaginationItem key={page} className={page > 3 ? 'hidden sm:block' : ''}>
                                <PaginationLink
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setCurrentPage(page);
                                    }}
                                    isActive={currentPage === page}
                                    className={`size-8 sm:size-7 text-[10px] sm:text-xs rounded transition-colors duration-200 ${currentPage === page
                                        ? 'bg-primary text-primary-foreground dark:text-white font-medium'
                                        : 'text-muted-foreground hover:bg-muted'
                                    }`}
                                >
                                    {page}
                                </PaginationLink>
                            </PaginationItem>
                        ))}
                        
                        {totalPages > 5 && (
                            <PaginationItem className="hidden sm:block">
                                <span className="text-muted-foreground/30 px-1">...</span>
                            </PaginationItem>
                        )}
                        
                        <PaginationItem>
                            <button
                                className="size-8 sm:size-7 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors duration-200 disabled:opacity-50"
                                disabled={currentPage === totalPages || totalPages === 0}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            >
                                <ChevronRight className="size-4" />
                            </button>
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>

                <div className="flex items-center gap-2 order-3">
                    <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Row/Page:</span>
                    <Select value={String(rowsPerPage)} onValueChange={(v) => {
                        setRowsPerPage(Number(v));
                        setCurrentPage(1);
                    }}>
                        <SelectTrigger size="sm" className="h-6 sm:h-5 w-fit text-[10px] sm:text-xs px-2 sm:px-2.5 bg-muted border-none text-muted-foreground">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                            <SelectItem value="7" className="text-xs">7</SelectItem>
                            <SelectItem value="10" className="text-xs">10</SelectItem>
                            <SelectItem value="20" className="text-xs">20</SelectItem>
                            <SelectItem value="50" className="text-xs">50</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
