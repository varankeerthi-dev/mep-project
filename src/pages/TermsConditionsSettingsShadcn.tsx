import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Edit, Trash2, Save, X, Search, Filter, Settings, ChevronDown, ChevronUp, Copy, Eye, EyeOff, MoreHorizontal, GripVertical } from 'lucide-react';

// shadcn UI imports
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface TermsSection {
  id: string;
  title: string;
  display_order: number;
  is_configurable: boolean;
  items: TermsItem[];
}

interface TermsItem {
  id: string;
  content: string;
  display_order: number;
  item_type: 'bullet' | 'number' | 'text';
  is_configurable: boolean;
}

interface TermsTemplate {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  sections: TermsSection[];
}

export const TermsConditionsSettings: React.FC = () => {
  const { organisation } = useAuth();
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TermsTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [organisation]);

  const loadTemplates = async () => {
    if (!organisation) return;

    setLoading(true);
    try {
      const { data: templatesData, error: templatesError } = await supabase
        .from('terms_conditions_templates')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: false });

      if (templatesError) throw templatesError;

      const templatesWithSections: TermsTemplate[] = [];
      
      for (const template of templatesData || []) {
        const { data: sectionsData, error: sectionsError } = await supabase
          .from('terms_conditions_sections')
          .select('*')
          .eq('template_id', template.id)
          .eq('organisation_id', organisation.id)
          .order('display_order', { ascending: true });

        if (sectionsError) throw sectionsError;

        const sections: TermsSection[] = [];
        
        for (const section of sectionsData || []) {
          const { data: itemsData, error: itemsError } = await supabase
            .from('terms_conditions_items')
            .select('*')
            .eq('section_id', section.id)
            .eq('organisation_id', organisation.id)
            .order('display_order', { ascending: true });

          if (itemsError) throw itemsError;

          sections.push({
            ...section,
            items: itemsData || []
          });
        }

        templatesWithSections.push({
          ...template,
          sections
        });
      }

      setTemplates(templatesWithSections);
      if (templatesWithSections.length > 0) {
        setSelectedTemplate(templatesWithSections[0]);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const updateSectionTitle = (sectionId: string, newTitle: string) => {
    if (!selectedTemplate) return;
    
    const updatedTemplate = {
      ...selectedTemplate,
      sections: selectedTemplate.sections.map(section =>
        section.id === sectionId ? { ...section, title: newTitle } : section
      )
    };
    setSelectedTemplate(updatedTemplate);
  };

  const updateItemContent = (sectionId: string, itemId: string, newContent: string) => {
    if (!selectedTemplate) return;
    
    const updatedTemplate = {
      ...selectedTemplate,
      sections: selectedTemplate.sections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map(item =>
                item.id === itemId ? { ...item, content: newContent } : item
              )
            }
          : section
      )
    };
    setSelectedTemplate(updatedTemplate);
  };

  const addSection = () => {
    if (!selectedTemplate) return;
    
    const newSection: TermsSection = {
      id: `temp_${Date.now()}`,
      title: 'New Section',
      display_order: selectedTemplate.sections.length,
      is_configurable: true,
      items: []
    };
    
    setSelectedTemplate({
      ...selectedTemplate,
      sections: [...selectedTemplate.sections, newSection]
    });
  };

  const addItem = (sectionId: string) => {
    if (!selectedTemplate) return;
    
    const section = selectedTemplate.sections.find(s => s.id === sectionId);
    if (!section) return;
    
    const newItem: TermsItem = {
      id: `temp_${Date.now()}`,
      content: 'New item',
      display_order: section.items.length,
      item_type: 'bullet',
      is_configurable: true
    };
    
    setSelectedTemplate({
      ...selectedTemplate,
      sections: selectedTemplate.sections.map(s =>
        s.id === sectionId
          ? { ...s, items: [...s.items, newItem] }
          : s
      )
    });
  };

  const removeSection = (sectionId: string) => {
    if (!selectedTemplate) return;
    
    setSelectedTemplate({
      ...selectedTemplate,
      sections: selectedTemplate.sections.filter(s => s.id !== sectionId)
    });
  };

  const removeItem = (sectionId: string, itemId: string) => {
    if (!selectedTemplate) return;
    
    setSelectedTemplate({
      ...selectedTemplate,
      sections: selectedTemplate.sections.map(s =>
        s.id === sectionId
          ? { ...s, items: s.items.filter(item => item.id !== itemId) }
          : s
      )
    });
  };

  const saveTemplate = async () => {
    if (!selectedTemplate || !organisation) return;

    setSaving(true);
    try {
      // Save template
      const { error: templateError } = await supabase
        .from('terms_conditions_templates')
        .upsert({
          id: selectedTemplate.id.startsWith('temp_') ? undefined : selectedTemplate.id,
          organisation_id: organisation.id,
          name: selectedTemplate.name,
          description: selectedTemplate.description,
          is_default: selectedTemplate.is_default,
          is_active: selectedTemplate.is_active
        });

      if (templateError) throw templateError;

      // Get the template ID (for new templates)
      const { data: savedTemplate } = await supabase
        .from('terms_conditions_templates')
        .select('id')
        .eq('organisation_id', organisation.id)
        .eq('name', selectedTemplate.name)
        .single();

      if (!savedTemplate) throw new Error('Failed to save template');

      // Save sections and items
      for (const section of selectedTemplate.sections) {
        const { error: sectionError } = await supabase
          .from('terms_conditions_sections')
          .upsert({
            id: section.id.startsWith('temp_') ? undefined : section.id,
            template_id: savedTemplate.id,
            organisation_id: organisation.id,
            title: section.title,
            display_order: section.display_order,
            is_configurable: section.is_configurable
          });

        if (sectionError) throw sectionError;

        // Get section ID
        const { data: savedSection } = await supabase
          .from('terms_conditions_sections')
          .select('id')
          .eq('template_id', savedTemplate.id)
          .eq('title', section.title)
          .single();

        if (!savedSection) continue;

        for (const item of section.items) {
          const { error: itemError } = await supabase
            .from('terms_conditions_items')
            .upsert({
              id: item.id.startsWith('temp_') ? undefined : item.id,
              section_id: savedSection.id,
              organisation_id: organisation.id,
              content: item.content,
              display_order: item.display_order,
              item_type: item.item_type,
              is_configurable: item.is_configurable
            });

          if (itemError) throw itemError;
        }
      }

      await loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setSaving(false);
    }
  };

  const createNewTemplate = () => {
    const newTemplate: TermsTemplate = {
      id: `temp_${Date.now()}`,
      name: 'New Template',
      description: '',
      is_default: false,
      is_active: true,
      sections: []
    };
    setSelectedTemplate(newTemplate);
    setIsCreateDialogOpen(false);
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-64 bg-gray-200 rounded-lg"></div>
            <div className="h-64 bg-gray-200 rounded-lg lg:col-span-2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Terms & Conditions</h1>
          <p className="text-muted-foreground">Manage your quotation terms and conditions templates</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Copy className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Template</DialogTitle>
                <DialogDescription>
                  Create a new terms and conditions template for your quotations.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input id="template-name" placeholder="Enter template name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-description">Description</Label>
                  <Textarea id="template-description" placeholder="Enter template description" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createNewTemplate}>
                  Create Template
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Templates List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Templates</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="p-4 space-y-2">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`p-4 rounded-lg cursor-pointer transition-colors border ${
                        selectedTemplate?.id === template.id
                          ? 'bg-primary/10 border-primary'
                          : 'bg-background hover:bg-accent'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">{template.name}</h3>
                          <div className="flex space-x-1">
                            {template.is_default && (
                              <Badge variant="default" className="text-xs">Default</Badge>
                            )}
                            {template.is_active && (
                              <Badge variant="secondary" className="text-xs">Active</Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {template.description || 'No description'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Template Editor */}
        <div className="lg:col-span-3">
          {selectedTemplate ? (
            <div className="space-y-6">
              {/* Template Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Template Details</span>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                      </Button>
                      <Button onClick={saveTemplate} disabled={saving} size="sm">
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="template-name">Template Name</Label>
                      <Input
                        id="template-name"
                        value={selectedTemplate.name}
                        onChange={(e) => setSelectedTemplate({ ...selectedTemplate, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="template-description">Description</Label>
                      <Input
                        id="template-description"
                        value={selectedTemplate.description || ''}
                        onChange={(e) => setSelectedTemplate({ ...selectedTemplate, description: e.target.value })}
                        placeholder="Enter template description"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is-default"
                        checked={selectedTemplate.is_default}
                        onCheckedChange={(checked) => setSelectedTemplate({ ...selectedTemplate, is_default: checked as boolean })}
                      />
                      <Label htmlFor="is-default">Default Template</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is-active"
                        checked={selectedTemplate.is_active}
                        onCheckedChange={(checked) => setSelectedTemplate({ ...selectedTemplate, is_active: checked as boolean })}
                      />
                      <Label htmlFor="is-active">Active</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sections */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Sections</CardTitle>
                    <Button onClick={addSection} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Section
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedTemplate.sections.map((section, sectionIndex) => (
                    <Card key={section.id} className="border">
                      <Collapsible
                        open={expandedSections.has(section.id)}
                        onOpenChange={() => toggleSection(section.id)}
                      >
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-accent/50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.has(section.id) ? 'rotate-180' : ''}`} />
                                <GripVertical className="w-4 h-4 text-muted-foreground" />
                                <Input
                                  value={section.title}
                                  onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                                  className="border-none bg-transparent font-medium text-lg p-0 h-auto focus-visible:ring-0"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>
                                    <Eye className="w-4 h-4 mr-2" />
                                    Preview Section
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Duplicate Section
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => removeSection(section.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Section
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="space-y-4 pt-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                {section.items.length} items
                              </span>
                              <Button onClick={() => addItem(section.id)} size="sm" variant="outline">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Item
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {section.items.map((item, itemIndex) => (
                                <div key={item.id} className="flex items-center space-x-3 p-3 bg-accent/30 rounded-lg">
                                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm font-mono text-muted-foreground w-6">
                                    {item.item_type === 'bullet' ? '•' : `${itemIndex + 1}.`}
                                  </span>
                                  <Input
                                    value={item.content}
                                    onChange={(e) => updateItemContent(section.id, item.id, e.target.value)}
                                    className="flex-1"
                                    placeholder="Enter item content"
                                  />
                                  <div className="flex items-center space-x-1">
                                    <Select
                                      value={item.item_type}
                                      onValueChange={(value: 'bullet' | 'number' | 'text') => {
                                        const updatedTemplate = {
                                          ...selectedTemplate,
                                          sections: selectedTemplate.sections.map(s =>
                                            s.id === section.id
                                              ? {
                                                  ...s,
                                                  items: s.items.map(i =>
                                                    i.id === item.id ? { ...i, item_type: value } : i
                                                  )
                                                }
                                              : s
                                          )
                                        };
                                        setSelectedTemplate(updatedTemplate);
                                      }}
                                    >
                                      <SelectTrigger className="w-20">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="bullet">•</SelectItem>
                                        <SelectItem value="number">1.</SelectItem>
                                        <SelectItem value="text">Text</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeItem(section.id, item.id)}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Template Selected</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Select a template from the list to edit or create a new one to get started.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
