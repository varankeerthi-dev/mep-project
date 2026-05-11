import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Package, Tag } from 'lucide-react';
import { useAuth } from '../../App';

// Professional Modal Design System Tokens
const DESIGN_TOKENS = {
  colors: {
    surface: {
      card: '#FFFFFF',
      page: '#F8F9FA',
    },
    border: '#E5E7EB',
    accent: '#DC2626',
    text: {
      primary: '#111827',
      secondary: '#6B7280',
      muted: '#9CA3AF',
    }
  },
  typography: {
    title: '1.125rem', // 18px
    label: '0.75rem',   // 12px
    input: '0.875rem',  // 14px
    button: '0.875rem', // 14px
  },
  spacing: {
    padding: {
      main: '1.25rem', // 20px
    },
    gap: {
      form: '1rem',      // 16px
      label: '0.375rem', // 6px
    }
  },
  borderRadius: {
    subtle: '0.375rem', // 6px
    none: '0px',
  },
};

interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  tool_count?: number;
}

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  organisation?: any;
}

export default function CategoryManager({ isOpen, onClose, organisation }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (isOpen && organisation?.id) {
      loadCategories();
    }
  }, [isOpen, organisation]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const data = await toolsApi.getCategories(organisation.id);
      
      // Mock data for now
      const mockCategories: Category[] = [
        { id: '1', name: 'Power Tools', description: 'Electric and battery powered tools', created_at: '2024-01-01', tool_count: 25 },
        { id: '2', name: 'Hand Tools', description: 'Manual hand tools', created_at: '2024-01-02', tool_count: 48 },
        { id: '3', name: 'Measuring Tools', description: 'Measurement and marking tools', created_at: '2024-01-03', tool_count: 15 },
        { id: '4', name: 'Safety Equipment', description: 'Personal protective equipment', created_at: '2024-01-04', tool_count: 32 },
        { id: '5', name: 'Welding Equipment', description: 'Welding and cutting tools', created_at: '2024-01-05', tool_count: 18 },
      ];
      
      setCategories(mockCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingCategory) {
        // Update existing category
        // await toolsApi.updateCategory(organisation.id, editingCategory.id, formData);
        console.log('Updating category:', editingCategory.id, formData);
      } else {
        // Create new category
        // await toolsApi.createCategory(organisation.id, formData);
        console.log('Creating category:', formData);
      }
      
      await loadCategories();
      handleCloseForm();
    } catch (error) {
      console.error('Error saving category:', error);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
    });
    setIsAddingCategory(true);
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? Tools in this category will be uncategorized.')) {
      return;
    }

    try {
      // await toolsApi.deleteCategory(organisation.id, categoryId);
      console.log('Deleting category:', categoryId);
      await loadCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const handleCloseForm = () => {
    setIsAddingCategory(false);
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: '800px',
          maxWidth: '90vw',
          height: '600px',
          maxHeight: '90vh',
          backgroundColor: DESIGN_TOKENS.colors.surface.card,
          borderRadius: DESIGN_TOKENS.borderRadius.subtle,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `0 ${DESIGN_TOKENS.spacing.padding.main}px`,
            borderBottom: `1px solid ${DESIGN_TOKENS.colors.border}`,
          }}
        >
          <h2
            style={{
              fontSize: DESIGN_TOKENS.typography.title,
              fontWeight: 600,
              color: DESIGN_TOKENS.colors.text.primary,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Tag size={20} />
            Manage Categories
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: DESIGN_TOKENS.borderRadius.none,
            }}
          >
            <X size={20} color={DESIGN_TOKENS.colors.text.secondary} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: DESIGN_TOKENS.spacing.padding.main }}>
          {isAddingCategory ? (
            /* Category Form */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: DESIGN_TOKENS.spacing.gap.form }}>
              <div>
                <div
                  style={{
                    fontSize: DESIGN_TOKENS.typography.label,
                    fontWeight: 600,
                    color: DESIGN_TOKENS.colors.text.primary,
                    marginBottom: DESIGN_TOKENS.spacing.gap.label,
                  }}
                >
                  CATEGORY NAME *
                </div>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter category name..."
                  required
                  style={{
                    width: '100%',
                    height: '38px',
                    backgroundColor: DESIGN_TOKENS.colors.surface.page,
                    border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                    borderRadius: DESIGN_TOKENS.borderRadius.none,
                    fontSize: DESIGN_TOKENS.typography.input,
                    color: DESIGN_TOKENS.colors.text.primary,
                    padding: '0 12px',
                  }}
                />
              </div>

              <div>
                <div
                  style={{
                    fontSize: DESIGN_TOKENS.typography.label,
                    fontWeight: 600,
                    color: DESIGN_TOKENS.colors.text.primary,
                    marginBottom: DESIGN_TOKENS.spacing.gap.label,
                  }}
                >
                  DESCRIPTION
                </div>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter category description..."
                  rows={3}
                  style={{
                    width: '100%',
                    backgroundColor: DESIGN_TOKENS.colors.surface.page,
                    border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                    borderRadius: DESIGN_TOKENS.borderRadius.none,
                    fontSize: DESIGN_TOKENS.typography.input,
                    color: DESIGN_TOKENS.colors.text.primary,
                    padding: '12px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'transparent',
                    border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                    borderRadius: DESIGN_TOKENS.borderRadius.none,
                    fontSize: DESIGN_TOKENS.typography.button,
                    fontWeight: 600,
                    color: DESIGN_TOKENS.colors.text.secondary,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: DESIGN_TOKENS.colors.accent,
                    border: 'none',
                    borderRadius: DESIGN_TOKENS.borderRadius.none,
                    fontSize: DESIGN_TOKENS.typography.button,
                    fontWeight: 600,
                    color: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          ) : (
            /* Categories List */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: DESIGN_TOKENS.spacing.gap.form }}>
                <div style={{ fontSize: DESIGN_TOKENS.typography.input, color: DESIGN_TOKENS.colors.text.secondary }}>
                  {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
                </div>
                <button
                  onClick={() => setIsAddingCategory(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: DESIGN_TOKENS.colors.accent,
                    border: 'none',
                    borderRadius: DESIGN_TOKENS.borderRadius.none,
                    fontSize: DESIGN_TOKENS.typography.button,
                    fontWeight: 600,
                    color: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={16} />
                  Add Category
                </button>
              </div>

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                  <div style={{ textAlign: 'center', color: DESIGN_TOKENS.colors.text.secondary }}>
                    <Package size={48} style={{ margin: '0 auto 12px', display: 'block' }} />
                    <div>Loading categories...</div>
                  </div>
                </div>
              ) : categories.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                  <div style={{ textAlign: 'center', color: DESIGN_TOKENS.colors.text.secondary }}>
                    <Tag size={48} style={{ margin: '0 auto 12px', display: 'block' }} />
                    <div>No categories found</div>
                    <div style={{ fontSize: DESIGN_TOKENS.typography.input, marginTop: '4px' }}>
                      Create your first category to organize tools
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '16px',
                        border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                        borderRadius: DESIGN_TOKENS.borderRadius.subtle,
                        backgroundColor: DESIGN_TOKENS.colors.surface.card,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: DESIGN_TOKENS.typography.input, 
                          fontWeight: 600, 
                          color: DESIGN_TOKENS.colors.text.primary,
                          marginBottom: '4px'
                        }}>
                          {category.name}
                        </div>
                        {category.description && (
                          <div style={{ 
                            fontSize: DESIGN_TOKENS.typography.input, 
                            color: DESIGN_TOKENS.colors.text.secondary,
                            marginBottom: '4px'
                          }}>
                            {category.description}
                          </div>
                        )}
                        <div style={{ 
                          fontSize: DESIGN_TOKENS.typography.label, 
                          color: DESIGN_TOKENS.colors.text.muted 
                        }}>
                          {category.tool_count || 0} tools • Created {new Date(category.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleEdit(category)}
                          style={{
                            width: '32px',
                            height: '32px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: DESIGN_TOKENS.borderRadius.none,
                          }}
                        >
                          <Edit2 size={16} color={DESIGN_TOKENS.colors.text.secondary} />
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
                          style={{
                            width: '32px',
                            height: '32px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: DESIGN_TOKENS.borderRadius.none,
                          }}
                        >
                          <Trash2 size={16} color={DESIGN_TOKENS.colors.text.muted} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
