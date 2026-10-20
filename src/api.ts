import type { MilestoneStatus, Project, ProgressSnapshot } from './projectFeatures'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'

export type ProjectPayload = {
  name: string
  agency: string
  contractor: string
  budget: string
  progress: number
  plannedProgress: number
  baselineFinishDate: string
  forecastFinishDate: string
  milestone: string
  milestoneDueDate: string
}

export type ProgressPayload = ProgressSnapshot

export type MilestonePayload = {
  name: string
  plannedFinishDate: string
  forecastFinishDate: string | null
  actualFinishDate: string | null
  status: MilestoneStatus
}

export interface RiskPredictionPayload {
  project_id: string
  risk_type: string
  risk_description: string
  risk_score: number
  factor_title?: string
}

export interface EvidenceItem {
  clause_id: number
  project_id?: string
  document_id: string
  document_name?: string
  section_title?: string
  clause_text: string
  page_number?: number
  similarity_score: number
  connection_rationale: string
}

export const FALLBACK_EVIDENCE: Record<string, EvidenceItem[]> = {
  'CP-2048': [
    {
      clause_id: 1,
      project_id: 'CP-2048',
      document_id: 'DOC-ERFB-001',
      document_name: 'East River Barrier - General Contract Agreement.pdf',
      section_title: 'Section 14.2: Environmental Permits & Stop-Work Liability',
      page_number: 42,
      clause_text: 'Foundation construction in the East River intertidal zone shall not proceed without active NYS DEC Article 15 and USACE Section 10 permits. Should environmental review exceed baseline schedule by >15 calendar days, the contractor is entitled to milestone rescheduling without liquidated damages, provided notice was served within 5 business days.',
      similarity_score: 0.94,
      connection_rationale: 'The model flagged a 78% schedule slippage risk due to permit approval lags. Section 14.2 directly controls permit timelines and establishes contractor delay liabilities.',
    },
    {
      clause_id: 2,
      project_id: 'CP-2048',
      document_id: 'DOC-ERFB-002',
      document_name: 'East River Barrier - Subcontractor Staffing Plan.pdf',
      section_title: 'Section 8.4: Subcontractor Capacity & Piling Crew Quotas',
      page_number: 19,
      clause_text: 'The prime contractor shall continuously maintain at least two qualified specialty marine piling crews on-site during Phase 1. Any specialist staffing deficit persisting beyond 5 working days triggers liquidated damages of $12,500 per calendar day.',
      similarity_score: 0.88,
      connection_rationale: 'The model identified a 24% capacity deficit risk from missing specialist crews. Section 8.4 provides the legal enforcement mechanism for subcontractor quotas.',
    },
    {
      clause_id: 3,
      project_id: 'CP-2048',
      document_id: 'DOC-ERFB-003',
      document_name: 'East River Barrier - Weather Protocols.pdf',
      section_title: 'Section 19.1: Weather Exposure & Tidal Window Protocols',
      page_number: 57,
      clause_text: 'Seasonal rainfall exceeding 1.5 inches per 24 hours or severe tidal surge conditions shall permit suspension of foundation pouring, provided the barrier shoring has been secured and documented in the weekly field report.',
      similarity_score: 0.82,
      connection_rationale: 'Weather exposure represents a 16% risk factor. Section 19.1 defines allowable tidal downtime thresholds.',
    },
  ],
  'CP-1932': [
    {
      clause_id: 4,
      project_id: 'CP-1932',
      document_id: 'DOC-I405-001',
      document_name: 'I-405 Sound Wall - Material Procurement Specifications.pdf',
      section_title: 'Section 6.3: Material Cost Escalation & Steel Price Index',
      page_number: 31,
      clause_text: 'Precast acoustic panels and structural steel pricing are anchored to the ENR Construction Cost Index. When raw acoustic material prices deviate by >8% from the bid date baseline, cost variance shall be shared under the 60/40 owner-contractor formula.',
      similarity_score: 0.91,
      connection_rationale: 'The model flagged a 56% material cost risk. Section 6.3 governs raw material price variance thresholds and cost allocations.',
    },
  ],
  'CP-1876': [
    {
      clause_id: 5,
      project_id: 'CP-1876',
      document_id: 'DOC-CCM-001',
      document_name: 'Civic Center - Building Systems Technical Standards.pdf',
      section_title: 'Section 22.1: Systems Commissioning & LEED Compliance',
      page_number: 78,
      clause_text: 'HVAC, electrical telemetry, and emergency life safety systems must complete continuous 72-hour operational testing prior to certificate of occupancy and system commissioning milestone sign-off.',
      similarity_score: 0.89,
      connection_rationale: 'Connected to systems commissioning milestone. Section 22.1 specifies the mandatory 72-hour testing requirement.',
    },
  ],
  'CP-1764': [
    {
      clause_id: 6,
      project_id: 'CP-1764',
      document_id: 'DOC-SCWM-001',
      document_name: 'South County Water Main - Pipeline Engineering Specs.pdf',
      section_title: 'Section 7.5: Hydrostatic Pressure Testing Protocols',
      page_number: 45,
      clause_text: 'The 48-inch ductile iron water main must sustain 4-hour hydrostatic pressure testing at 150 psi. Allowable leakage cannot exceed 0.25 gal/hr/mile of pipe. Any burst or failure requires immediate repair and complete re-test cycle.',
      similarity_score: 0.93,
      connection_rationale: 'Connected to pressure testing milestone. Section 7.5 mandates hydrostatic test thresholds and pressure endurance limits.',
    },
    {
      clause_id: 7,
      project_id: 'CP-1764',
      document_id: 'DOC-SCWM-002',
      document_name: 'South County Water Main - Financial Terms.pdf',
      section_title: 'Section 15.3: Budget Burn Rate & Monthly Allocation Caps',
      page_number: 12,
      clause_text: 'Monthly contractor expenditure exceeding 115% of the projected progress schedule baseline requires formal justification and public works engineering audit before subsequent disbursement release.',
      similarity_score: 0.87,
      connection_rationale: 'The model flagged a 47% budget burn risk. Section 15.3 establishes expenditure audit triggers.',
    },
  ],
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message ?? `Request failed (${response.status})`)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function getProjects() {
  return request<Project[]>('/projects')
}

export function createProject(payload: ProjectPayload) {
  return request<Project>('/projects', { method: 'POST', body: JSON.stringify(toApiProject(payload)) })
}

export function updateProject(id: string, payload: ProjectPayload) {
  return request<Project>(`/projects/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(toApiProject(payload)) })
}

export function deleteProject(id: string) {
  return request<void>(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function createProgressSnapshot(projectId: string, payload: ProgressPayload) {
  return request<Project>(`/projects/${encodeURIComponent(projectId)}/progress`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateProgressSnapshot(projectId: string, snapshotId: string, payload: ProgressPayload) {
  return request<Project>(`/projects/${encodeURIComponent(projectId)}/progress/${encodeURIComponent(snapshotId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteProgressSnapshot(projectId: string, snapshotId: string) {
  return request<Project>(`/projects/${encodeURIComponent(projectId)}/progress/${encodeURIComponent(snapshotId)}`, {
    method: 'DELETE',
  })
}

export function createMilestone(projectId: string, payload: MilestonePayload) {
  return request<Project>(`/projects/${encodeURIComponent(projectId)}/milestones`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateMilestone(projectId: string, milestoneId: string, payload: MilestonePayload) {
  return request<Project>(`/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteMilestone(projectId: string, milestoneId: string) {
  return request<Project>(`/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`, {
    method: 'DELETE',
  })
}

export type ProjectRiskPredictionPayload = {
  progressVariance?: number
  scheduleVariance?: number
  paymentProgressRatio?: number
  milestoneDelayDays?: number
  changeOrderFrequency?: number
  inspectionFailureRate?: number
  contractorDelayHistory?: number
  costVariancePct?: number
  plannedDurationDays?: number
  budgetCrores?: number
  persistRiskScores?: boolean
}

export type FeatureContribution = {
  feature: string
  featureName: string
  inputValue: number
  contribution: number
  scale: string
  direction: 'increases_risk' | 'decreases_risk' | 'neutral'
  displayMagnitude: number
}

export type ModelExplanation = {
  target: string
  modelType: string
  method: string
  baseValue: number
  scale: string
  topDrivers: FeatureContribution[]
  allDrivers: FeatureContribution[]
  note: string
}

export type RiskExplanations = {
  delayRisk?: ModelExplanation
  costOverrunRisk?: ModelExplanation
  warning?: string
}

export type RiskPredictionResponse = {
  projectId: string
  delayRisk: number
  costOverrunRisk: number
  dataOrigin: string
  warning: string
  featuresUsed: Record<string, number>
  project: Project
  explanations?: RiskExplanations
}

export function predictProjectRisk(projectId: string, payload?: ProjectRiskPredictionPayload) {
  return request<RiskPredictionResponse>(`/projects/${encodeURIComponent(projectId)}/predict-risk`, {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  })
}

function toApiProject(payload: ProjectPayload) {
  const budgetCrores = Number(payload.budget.replace(/[^\d.]/g, ''))
  if (!Number.isFinite(budgetCrores)) throw new Error('Budget must be a valid number')
  return {
    name: payload.name,
    agency: payload.agency,
    contractor: payload.contractor,
    budgetCrores,
    progress: payload.progress,
    plannedProgress: payload.plannedProgress,
    baselineFinishDate: payload.baselineFinishDate,
    forecastFinishDate: payload.forecastFinishDate,
    milestoneName: payload.milestone,
    milestoneDueDate: payload.milestoneDueDate,
  }
}

/**
 * Connects an ML predicted risk to contract evidence via Spring Boot pgvector RAG backend.
 * Falls back to curated mock evidence if backend is offline.
 */
export async function connectRiskToEvidence(
  risk: RiskPredictionPayload
): Promise<{ evidence: EvidenceItem[]; isLive: boolean }> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2500)

    const response = await fetch(`${API_BASE_URL}/ml/connect-evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(risk),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      if (Array.isArray(data) && data.length > 0) {
        return { evidence: data, isLive: true }
      }
    }
  } catch {
    // Backend offline or timeout -> gracefully fall back
  }

  const fallback = FALLBACK_EVIDENCE[risk.project_id] || FALLBACK_EVIDENCE['CP-2048']
  return { evidence: fallback, isLive: false }
}

/**
 * Searches indexed clauses across contracts via pgvector.
 */
export async function searchContractClauses(
  query: string,
  projectId?: string
): Promise<{ evidence: EvidenceItem[]; isLive: boolean }> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2500)

    const params = new URLSearchParams()
    if (query) params.append('q', query)
    if (projectId && projectId !== 'ALL') params.append('project_id', projectId)

    const response = await fetch(`${API_BASE_URL}/documents/clauses?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      return { evidence: data, isLive: true }
    }
  } catch {
    // Backend offline
  }

  const allFallback = Object.values(FALLBACK_EVIDENCE).flat()
  const filtered = allFallback.filter((item) => {
    const matchProject = !projectId || projectId === 'ALL' || item.project_id === projectId
    const matchQuery =
      !query ||
      `${item.document_name} ${item.section_title} ${item.clause_text}`
        .toLowerCase()
        .includes(query.toLowerCase())
    return matchProject && matchQuery
  })

  return { evidence: filtered, isLive: false }
}
