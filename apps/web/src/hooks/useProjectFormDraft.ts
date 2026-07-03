import { useState, useEffect, useCallback } from 'react'

export type DraftFormData = {
  client_id: string
  project_name: string
  parent_project_id: string
  project_type: string
  project_estimated_value: string
  po_required: boolean
  po_status: string
  po_number: string
  po_date: string
  start_date: string
  expected_end_date: string
  actual_end_date: string
  completion_percentage: number
  status: string
  remarks: string
  contractor_scope: string
  client_scope: string
  excluded_scope: string
  pending_approval: string
  site_instructions: string
  [key: string]: unknown
}

const DRAFT_KEY = 'mep-create-project-draft'
const AUTO_SAVE_INTERVAL = 30_000

export function useProjectFormDraft(
  editId: string | null,
  initialFormData: DraftFormData,
): [DraftFormData, React.Dispatch<React.SetStateAction<DraftFormData>>, () => void, boolean] {
  const [formData, setFormData] = useState<DraftFormData>(() => {
    if (editId) return initialFormData
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return { ...initialFormData, ...parsed }
      }
    } catch {}
    return initialFormData
  })
  const [draftRestored, setDraftRestored] = useState(false)

  useEffect(() => {
    if (!editId) {
      const timer = setInterval(() => {
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(formData))
        } catch {}
      }, AUTO_SAVE_INTERVAL)
      return () => clearInterval(timer)
    }
  }, [editId, formData])

  useEffect(() => {
    if (!editId && !draftRestored) {
      try {
        const saved = localStorage.getItem(DRAFT_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Object.keys(parsed).length > 2) {
            setFormData(prev => ({ ...prev, ...parsed }))
            setDraftRestored(true)
          }
        }
      } catch {}
    }
  }, [editId, draftRestored])

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {}
  }, [])

  return [formData, setFormData, clearDraft, draftRestored]
}
