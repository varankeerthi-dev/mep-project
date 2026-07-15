import os

filepath = r"c:\Users\admin\mep-project\apps\web\src\pages\CreateProject.tsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Header UI
header_find = """        <div className="mb-6 flex items-center justify-between sticky top-0 z-40 bg-[#f8fafc] border-b border-zinc-200 pb-4 pt-4 -mx-4 px-4 md:-mx-10 md:px-10">
          <div className="flex items-center gap-3">
            <button type="button"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => { clearDraft(); setDraftCleared(true); navigate('/projects'); }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
            ><ChevronLeft size={13} /> Back</button>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-zinc-800">{editId ? 'Edit Project' : 'New Project'}</h1>
              {formData.status === 'Draft' && (
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-medium border border-zinc-200">DRAFT</span>
              )}
            </div>
            {!editId && localStorage.getItem('mep-create-project-draft') && (
              <span style={{ fontSize: '12px', color: BRAND_BLUE, marginLeft: '8px', padding: '2px 8px', background: '#eff6ff', borderRadius: '12px', fontWeight: 500 }}>
                Draft Restored
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" style={{...secondaryBtnStyle, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer'}}
              onClick={(e) => handleSaveClick(e, true)} disabled={saving}
              onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}}
              onMouseLeave={e => { if (!saving) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}}
            >{saving ? 'Saving...' : 'Save as Draft'}</button>
            <button type="button" style={{...primaryBtnStyle, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer'}}
              onClick={(e) => handleSaveClick(e, false)} disabled={saving}
              onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}}
              onMouseLeave={e => { if (!saving) { e.currentTarget.style.background = BRAND_BLUE; e.currentTarget.style.borderColor = BRAND_BLUE; }}}
            >{saving ? 'Saving...' : (editId ? 'Update Project' : 'Save Project')}</button>
          </div>
        </div>"""

header_replace = """        {/* Header Block & Navigation Row */}
        <div className="mb-6 flex items-center justify-between sticky top-0 z-40 bg-[#f8fafc] border-b border-zinc-200 pb-4 pt-4 -mx-4 px-4 md:-mx-10 md:px-10">
          <div className="flex items-center gap-3">
            <button type="button"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => { clearDraft(); setDraftCleared(true); navigate('/projects'); }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
            ><ChevronLeft size={13} /> Back</button>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-zinc-800">{editId ? 'Edit Project' : 'New Project'}</h1>
              {formData.status === 'Draft' && (
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-medium border border-zinc-200">DRAFT</span>
              )}
            </div>
            {!editId && localStorage.getItem('mep-create-project-draft') && (
              <span style={{ fontSize: '12px', color: BRAND_BLUE, marginLeft: '8px', padding: '2px 8px', background: '#eff6ff', borderRadius: '12px', fontWeight: 500 }}>
                Draft Restored
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" style={{...secondaryBtnStyle, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer'}}
              onClick={(e) => handleSaveClick(e, true)} disabled={saving}
              onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}}
              onMouseLeave={e => { if (!saving) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}}
            >{saving ? 'Saving...' : 'Save as Draft'}</button>
          </div>
        </div>

        {/* Wizard Progress */}
        <div className="mb-6 flex items-center justify-between">
          {wizardSteps.map((step, idx) => (
            <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: idx <= currentStep ? BRAND_BLUE : '#e2e8f0', color: idx <= currentStep ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>{idx + 1}</div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: idx <= currentStep ? BRAND_BLUE : '#64748b', textAlign: 'center', padding: '0 4px' }}>{step}</div>
            </div>
          ))}
        </div>"""
content = content.replace(header_find, header_replace)

# 2. Add Site Address
site_addr_find = """{renderHeaderField('Name', <input name="project_name" value={formData.project_name} onChange={handleInputChange} placeholder="Enter project name" required style={inputStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />)}"""
site_addr_replace = """{renderHeaderField('Name', <input name="project_name" value={formData.project_name} onChange={handleInputChange} placeholder="Enter project name" required style={inputStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />)}
                      {renderHeaderField('Site Address', <textarea name="site_address" value={formData.site_address || ''} onChange={handleInputChange} rows={2} placeholder="Physical address of the site..." style={textareaStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />, true, true)}"""
content = content.replace(site_addr_find, site_addr_replace)

# 3. Value & Margins
margin_find = """                      <div style={sectionHeaderStyle}>Value</div>
                      {renderHeaderField('Est. Value', <input type="number" name="project_estimated_value" value={formData.project_estimated_value} onChange={handleInputChange} placeholder="0.00" min="0" step="0.01" style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />)}"""
margin_replace = """                      <div style={sectionHeaderStyle}>Value & Margins</div>
                      {renderHeaderField('Est. Value', <input type="number" name="project_estimated_value" value={formData.project_estimated_value} onChange={handleInputChange} placeholder="0.00" min="0" step="0.01" style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />)}
                      {renderHeaderField('Target Margin %', <input type="number" name="target_margin_percent" value={formData.target_margin_percent || ''} onChange={handleInputChange} placeholder="e.g. 15" min="0" step="0.1" style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />)}
                      {renderHeaderField('Cost Center', <SearchableDropdown items={costCenters} value={formData.cost_center_id || ''} onChange={id => handleInputChange({ target: { name: 'cost_center_id', value: id } })} placeholder="Select Cost Center" />)}"""
content = content.replace(margin_find, margin_replace)

# 4. Payment Terms & Penalties
po_find = """                              {renderHeaderField('PO Date', <input type="date" name="po_date" value={formData.po_date} onChange={handleInputChange} style={inputStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />, true)}
                            </>
                          )}
                        </>
                      )}"""
po_replace = """                              {renderHeaderField('PO Date', <input type="date" name="po_date" value={formData.po_date} onChange={handleInputChange} style={inputStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />, true)}
                            </>
                          )}
                        </>
                      )}
                      {fetchedPaymentTerms.length > 0 && (
                        <div style={{ marginTop: '12px', padding: '10px', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e40af', marginBottom: '6px' }}>PO Payment Terms</div>
                          {fetchedPaymentTerms.map((term, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#1e3a8a', padding: '2px 0' }}>
                              <span>{term.milestone_name}</span>
                              <span style={{ fontWeight: 600 }}>{term.milestone_percentage}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: '10px' }}>
                        {renderHeaderField('Penalties (LDs)', <textarea name="liquidated_damages" value={formData.liquidated_damages || ''} onChange={handleInputChange} rows={2} placeholder="e.g., 1% per week of delay..." style={textareaStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />, true, true)}
                      </div>"""
content = content.replace(po_find, po_replace)

# 5. Templates
template_find = """                      <div style={sectionHeaderStyle}>Scope</div>
                      {renderHeaderField('Contractor', <DynamicScopeList value={formData.contractor_scope} onChange={val => handleInputChange({ target: { name: 'contractor_scope', value: val }})} placeholder="Subcontractor scope/deliverables..." />, false, true)}"""
template_replace = """                      <div style={sectionHeaderStyle}>Scope</div>
                      {renderHeaderField('Template', <select value={selectedTemplate} onChange={handleTemplateChange} style={selectStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md">
                        <option value="">-- Start from Blank --</option>
                        {Object.keys(PROJECT_TEMPLATES).map(k => <option key={k} value={k}>{k}</option>)}
                      </select>)}
                      {renderHeaderField('Contractor', <DynamicScopeList value={formData.contractor_scope} onChange={val => handleInputChange({ target: { name: 'contractor_scope', value: val }})} placeholder="Subcontractor scope/deliverables..." />, false, true)}"""
content = content.replace(template_find, template_replace)

# 6. Team & Stepper wrappings
content = content.replace("              {/* Identity Section */}", "              {currentStep === 0 && (\n                <>\n                  {/* Identity Section */}")
content = content.replace("              {/* Commercial Section */}", "                </>\n              )}\n              {currentStep === 1 && (\n                <>\n                  {/* Commercial Section */}")
content = content.replace("              {/* Scope & Instructions Section */}", "                </>\n              )}\n              {currentStep === 2 && (\n                <>\n                  {/* Scope & Instructions Section */}")
content = content.replace("              {/* Status & Notes Section */}", """                </>
              )}
              {currentStep === 3 && (
                <>
                  <section>
                    <div style={sectionHeaderStyle}>Team Allocation</div>
                    <div style={sectionBoxStyle}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={sectionHeaderStyle}>Project Manager</div>
                          {renderHeaderField('Manager', <SearchableDropdown items={employees} value={formData.project_manager_id || ''} onChange={id => handleInputChange({ target: { name: 'project_manager_id', value: id } })} placeholder="Assign Project Manager" />)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={sectionHeaderStyle}>Site Engineer</div>
                          {renderHeaderField('Engineer', <SearchableDropdown items={employees} value={formData.site_engineer_id || ''} onChange={id => handleInputChange({ target: { name: 'site_engineer_id', value: id } })} placeholder="Assign Site Engineer" />)}
                        </div>
                      </div>
                    </div>
                  </section>
                  {/* Status & Notes Section */}""")

footer = """
                </>
              )}
            </div>
            
            {/* Footer Navigation */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-between rounded-b-md">
              <button type="button" style={secondaryBtnStyle} onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}>Previous</button>
              {currentStep < wizardSteps.length - 1 ? (
                <button type="button" style={primaryBtnStyle} onClick={() => setCurrentStep(Math.min(wizardSteps.length - 1, currentStep + 1))}>Next Step</button>
              ) : (
                <button type="button" style={primaryBtnStyle} onClick={(e) => handleSaveClick(e, false)} disabled={saving}>{saving ? 'Saving...' : (editId ? 'Update Project' : 'Save Project')}</button>
              )}
            </div>
          </div>
        </form>"""

content = content.replace("""            </div>
          </div>
        </form>""", footer)


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
