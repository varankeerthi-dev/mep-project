import React from 'react';
import { format, parseISO } from 'date-fns';
import { X } from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import type { SiteVisitFormData } from './types';

export interface SiteVisitQuickUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVisit: any | null;
  onSelectVisit: (visit: any) => void;
  visits: any[];
  clients: any[];
  filteredProjects: any[];
  purposes: any[];
  formData: SiteVisitFormData;
  setFormData: React.Dispatch<React.SetStateAction<SiteVisitFormData>>;
  handleClientChange: (clientId: string) => void;
  onOpenAddPurposeModal: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
}

export const SiteVisitQuickUpdateModal: React.FC<SiteVisitQuickUpdateModalProps> = ({
  isOpen,
  onClose,
  selectedVisit,
  onSelectVisit,
  visits,
  clients,
  filteredProjects,
  purposes,
  formData,
  setFormData,
  handleClientChange,
  onOpenAddPurposeModal,
  onSubmit,
  isSubmitting,
}) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        width: '95%',
        maxWidth: '900px',
        maxHeight: '90vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fafafa',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
        }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#171717', margin: 0 }}>Site Visit Update</h3>
            <p style={{ fontSize: '12px', color: '#737373', margin: '4px 0 0 0' }}>Comprehensive update for site operations</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px', border: 'none', background: 'transparent', color: '#a3a3a3', cursor: 'pointer', borderRadius: '50%' }}
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            
            {/* LEFT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Select Visit (Optional if new, required if update) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SELECT VISIT TO UPDATE</label>
                <select
                  value={selectedVisit?.id || ''}
                  onChange={(e) => {
                    const visit = visits?.find((v: any) => v.id === e.target.value);
                    if (visit) onSelectVisit(visit);
                  }}
                  style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                >
                  <option value="">-- Choose existing visit --</option>
                  {visits?.slice(0, 20).map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.visit_date ? format(parseISO(v.visit_date), 'dd MMM') : '--'} - {v.clients?.client_name || 'N/A'} ({v.purpose_of_visit || 'No purpose'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CLIENT *</label>
                <CustomSelect
                  value={formData.client_id}
                  onChange={handleClientChange}
                  placeholder="Select client"
                  options={clients?.map((c: any) => ({ value: c.id, label: c.client_name })) || []}
                  style={{ fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PROJECT</label>
                <select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', color: '#171717', background: '#fff' }}
                >
                  {(!formData.client_id || filteredProjects.length === 0) ? (
                    <option value="" disabled>No active projects for this client</option>
                  ) : (
                    <>
                      <option value="">Select project</option>
                      {filteredProjects.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.project_name} ({p.project_code || 'No Code'})
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IN TIME</label>
                  <input
                    type="time"
                    value={formData.visit_time}
                    onChange={(e) => setFormData({ ...formData, visit_time: e.target.value })}
                    style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>OUT TIME</label>
                  <input
                    type="time"
                    value={formData.out_time}
                    onChange={(e) => setFormData({ ...formData, out_time: e.target.value })}
                    style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VISITED BY</label>
                <input
                  type="text"
                  value={formData.visited_by}
                  onChange={(e) => setFormData({ ...formData, visited_by: e.target.value })}
                  placeholder="Person who visited"
                  style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SITE ADDRESS</label>
                <textarea
                  value={formData.site_address}
                  onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                  placeholder="Physical site location..."
                  style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '80px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DISCUSSION POINTS</label>
                <textarea
                  value={formData.discussion_points}
                  onChange={(e) => setFormData({ ...formData, discussion_points: e.target.value })}
                  placeholder="Summary of site meeting/observations..."
                  style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '100px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>EQUIPMENT USED</label>
                <textarea
                  value={formData.equipment_used}
                  onChange={(e) => setFormData({ ...formData, equipment_used: e.target.value })}
                  placeholder="Tools and equipment..."
                  style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '60px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SAFETY HAZARDS IDENTIFIED</label>
                <textarea
                  value={formData.safety_hazards}
                  onChange={(e) => setFormData({ ...formData, safety_hazards: e.target.value })}
                  placeholder="List safety concerns..."
                  style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '60px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>RECOMMENDATIONS</label>
                <textarea
                  value={formData.recommendations}
                  onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                  placeholder="Actionable site recommendations..."
                  style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '60px' }}
                />
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VISIT DATE *</label>
                <input
                  type="date"
                  value={formData.visit_date}
                  onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                  required
                  style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ENGINEER / ASSIGNED TO</label>
                <input
                  type="text"
                  value={formData.engineer}
                  onChange={(e) => setFormData({ ...formData, engineer: e.target.value })}
                  placeholder="Engineer name"
                  style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PURPOSE</label>
                  <button type="button" onClick={onOpenAddPurposeModal} style={{ fontSize: '11px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Add New</button>
                </div>
                <select
                  value={formData.purpose_of_visit}
                  onChange={(e) => setFormData({ ...formData, purpose_of_visit: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                >
                  <option value="">Select purpose</option>
                  {purposes?.map((p: any) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>FOLLOW UP DATE</label>
                  <input
                    type="date"
                    value={formData.follow_up_date}
                    onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                    style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>LOCATION URL</label>
                  <input
                    type="url"
                    value={formData.location_url}
                    onChange={(e) => setFormData({ ...formData, location_url: e.target.value })}
                    placeholder="Google Maps link"
                    style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>NEXT STEP</label>
                <select
                  value={formData.next_step}
                  onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                >
                  <option value="">Select next action</option>
                  <option value="Quote to be Sent">Quote to be Sent</option>
                  <option value="Follow up call">Follow up call</option>
                  <option value="Second Visit">Second Visit</option>
                  <option value="Order Confirmation">Order Confirmation</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MEASUREMENTS</label>
                <textarea
                  value={formData.measurements}
                  onChange={(e) => setFormData({ ...formData, measurements: e.target.value })}
                  placeholder="Technical measurements or dimensions..."
                  style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '80px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>WEATHER CONDITIONS</label>
                <input
                  type="text"
                  value={formData.weather_conditions}
                  onChange={(e) => setFormData({ ...formData, weather_conditions: e.target.value })}
                  placeholder="e.g. Sunny, Rainy"
                  style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TRAVEL TIME (MINS)</label>
                  <input
                    type="number"
                    value={formData.travel_time_minutes || ''}
                    onChange={(e) => setFormData({ ...formData, travel_time_minutes: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Minutes"
                    style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL MAN HOURS</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.total_man_hours || ''}
                    onChange={(e) => setFormData({ ...formData, total_man_hours: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="Man hours"
                    style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>
              </div>

              {/* Expenses details */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '14px', background: '#fafafa' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#404040', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Visit Expenses</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '9px', fontWeight: 600, color: '#6b7280' }}>TRAVEL</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.travel_expense || ''}
                      onChange={(e) => setFormData({ ...formData, travel_expense: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="₹ 0.00"
                      style={{ padding: '6px 10px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '13px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '9px', fontWeight: 600, color: '#6b7280' }}>STAY</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.accommodation_expense || ''}
                      onChange={(e) => setFormData({ ...formData, accommodation_expense: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="₹ 0.00"
                      style={{ padding: '6px 10px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '13px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '9px', fontWeight: 600, color: '#6b7280' }}>MISC</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.misc_expense || ''}
                      onChange={(e) => setFormData({ ...formData, misc_expense: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="₹ 0.00"
                      style={{ padding: '6px 10px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STATUS *</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                >
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="postponed">Postponed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {formData.status === 'postponed' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>REASON FOR POSTPONEMENT</label>
                  <textarea
                    value={formData.postponed_reason}
                    onChange={(e) => setFormData({ ...formData, postponed_reason: e.target.value })}
                    placeholder="Why was this visit delayed?"
                    style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '60px' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="quick_is_client_meeting"
                    checked={formData.is_client_meeting}
                    onChange={(e) => setFormData({ ...formData, is_client_meeting: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="quick_is_client_meeting" style={{ fontSize: '13px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                    Mark as Client Meeting
                  </label>
                </div>
                {formData.is_client_meeting && (
                  <p style={{ fontSize: '12px', color: '#6b7280', marginLeft: '24px' }}>
                    This will create a meeting record and allow you to add meeting minutes
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '32px',
            paddingTop: '20px',
            borderTop: '1px solid #f0f0f0',
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '12px', border: '1px solid #d4d4d4', borderRadius: '8px', background: '#fff', color: '#525252', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', background: '#171717', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              {isSubmitting ? 'Processing...' : selectedVisit ? 'Update Records' : 'Save Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
