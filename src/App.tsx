import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Database,
  FileSearch,
  FileText,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Info,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { calculateProjectFeatures, type MilestoneStatus, type Project } from './projectFeatures'
import {
  createMilestone as createMilestoneApi,
  createProgressSnapshot,
  createProject as createProjectApi,
  deleteProject as deleteProjectApi,
  getProjects,
  updateMilestone as updateMilestoneApi,
  connectRiskToEvidence,
  predictProjectRisk,
  type EvidenceItem,
  type ProjectRiskPredictionPayload,
  type RiskPredictionResponse,
} from './api'
import {
  BudgetPage,
  ContractorsPage,
  DocumentsPage,
  HelpPage,
  ProjectsPage,
  RiskSignalsPage,
} from './WorkspacePages'
import './App.css'

const projectRiskFactors: Record<string, { rank: string; title: string; detail: string; impact: string }[]> = {
  'CP-2048': [
    { rank: '01', title: 'Permit approval lag', detail: 'Environmental review is 23 days behind baseline', impact: '+31%' },
    { rank: '02', title: 'Subcontractor capacity', detail: 'Two specialist marine piling crews below planned staffing', impact: '+24%' },
    { rank: '03', title: 'Weather exposure', detail: 'Seasonal rainfall and high tidal surges impact foundation window', impact: '+16%' },
  ],
  'CP-1932': [
    { rank: '01', title: 'Material cost variance', detail: 'Steel and acoustic panel prices deviated 12% over bid baseline index', impact: '+28%' },
    { rank: '02', title: 'Corridor night windows', detail: 'Assembly restricted to 21:00-05:00 hours with non-refundable delay fines', impact: '+18%' },
  ],
  'CP-1876': [
    { rank: '01', title: 'Systems commissioning testing', detail: 'Continuous 72-hour operational testing required prior to occupancy sign-off', impact: '+15%' },
    { rank: '02', title: 'LEED acoustic compliance', detail: 'Interior decibel ratings require acoustic validation inspection', impact: '+11%' },
  ],
  'CP-1764': [
    { rank: '01', title: 'Hydrostatic pressure testing', detail: 'Continuous 4-hour 150 psi pressure endurance tolerance validation', impact: '+26%' },
    { rank: '02', title: 'Budget burn rate ahead of plan', detail: 'Monthly expenditure exceeded 115% baseline milestone trigger', impact: '+21%' },
  ],
}

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Projects', icon: BriefcaseBusiness, count: '4' },
  { label: 'Risk signals', icon: Activity, count: '3' },
  { label: 'Documents', icon: FileSearch },
  { label: 'Contractors', icon: UsersRound },
  { label: 'Budget & spend', icon: Wallet },
]

const currentDate = new Date().toISOString().slice(0, 10)

type ProjectDraft = Pick<Project,
  'name' | 'agency' | 'contractor' | 'budget' | 'progress' | 'plannedProgress' |
  'baselineFinishDate' | 'forecastFinishDate' | 'milestone'
> & {
  milestoneDueDate: string
}

type ProgressDraft = {
  date: string
  planned: number
  actual: number
}

type MilestoneDraft = {
  name: string
  plannedFinishDate: string
  forecastFinishDate: string
}

function ProgressUpdateDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (snapshot: ProgressDraft) => void
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onSubmit({
      date: String(data.get('date')),
      planned: Number(data.get('planned')),
      actual: Number(data.get('actual')),
    })
  }

  return <div className="dialog-backdrop" onClick={onClose}><section className="add-project-dialog" role="dialog" aria-modal="true" aria-labelledby="progress-dialog-title" onClick={(event) => event.stopPropagation()}>
    <div className="add-project-heading"><div><span className="section-kicker">DEMO WORKSPACE</span><h2 id="progress-dialog-title">Record progress update</h2></div><button className="icon-button" type="button" aria-label="Close progress update form" onClick={onClose}><X size={19} /></button></div>
    <p className="form-demo-note">Saves this progress snapshot to the Spring Boot demo API.</p>
    <form className="add-project-form" onSubmit={handleSubmit}>
      <label>As-of date<input name="date" type="date" max={currentDate} required /></label>
      <div className="form-two-columns"><label>Planned progress (%)<input name="planned" type="number" min="0" max="100" step="1" required /></label><label>Actual progress (%)<input name="actual" type="number" min="0" max="100" step="1" required /></label></div>
      <div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="approve-button" type="submit"><Plus size={15} /> Save update</button></div>
    </form>
  </section></div>
}

function AddMilestoneDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (milestone: MilestoneDraft) => void
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onSubmit({
      name: String(data.get('name')).trim(),
      plannedFinishDate: String(data.get('plannedFinishDate')),
      forecastFinishDate: String(data.get('forecastFinishDate')),
    })
  }

  return <div className="dialog-backdrop" onClick={onClose}><section className="add-project-dialog" role="dialog" aria-modal="true" aria-labelledby="milestone-dialog-title" onClick={(event) => event.stopPropagation()}>
    <div className="add-project-heading"><div><span className="section-kicker">DEMO WORKSPACE</span><h2 id="milestone-dialog-title">Add contract milestone</h2></div><button className="icon-button" type="button" aria-label="Close add milestone form" onClick={onClose}><X size={19} /></button></div>
    <p className="form-demo-note">Adds a milestone to this project via the Spring Boot demo API.</p>
    <form className="add-project-form" onSubmit={handleSubmit}>
      <label>Milestone name<input name="name" required placeholder="e.g. Substructure inspection" /></label>
      <div className="form-two-columns"><label>Planned finish date<input name="plannedFinishDate" type="date" required /></label><label>Forecast finish date<input name="forecastFinishDate" type="date" required /></label></div>
      <div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="approve-button" type="submit"><Plus size={15} /> Add milestone</button></div>
    </form>
  </section></div>
}

function AddProjectDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (project: ProjectDraft) => void
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onSubmit({
      name: String(data.get('name')).trim(),
      agency: String(data.get('agency')).trim(),
      contractor: String(data.get('contractor')).trim(),
      budget: `₹${Number(data.get('budget')).toFixed(2)} Cr`,
      progress: Number(data.get('progress')),
      plannedProgress: Number(data.get('plannedProgress')),
      baselineFinishDate: String(data.get('baselineFinishDate')),
      forecastFinishDate: String(data.get('forecastFinishDate')),
      milestone: String(data.get('milestone')).trim(),
      milestoneDueDate: String(data.get('milestoneDueDate')),
    })
  }

  return <div className="dialog-backdrop" onClick={onClose}><section className="add-project-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={(event) => event.stopPropagation()}>
    <div className="add-project-heading"><div><span className="section-kicker">DEMO WORKSPACE</span><h2 id="dialog-title">Add project to portfolio</h2></div><button className="icon-button" type="button" aria-label="Close add project form" onClick={onClose}><X size={19} /></button></div>
    <p className="form-demo-note">New records persist to the Spring Boot demo API while the server runs.</p>
    <form className="add-project-form" onSubmit={handleSubmit}>
      <label>Project name<input name="name" required placeholder="e.g. Metro Line 3 Pier Works" /></label>
      <div className="form-two-columns"><label>Agency<input name="agency" required placeholder="e.g. Mumbai Metro Rail Corp" /></label><label>Contractor<input name="contractor" required placeholder="e.g. L&T Construction" /></label></div>
      <div className="form-two-columns"><label>Budget (INR Crores)<input name="budget" type="number" step="0.01" min="1" required placeholder="125.50" /></label><label>Upcoming milestone<input name="milestone" required placeholder="Pier cap casting" /></label></div>
      <div className="form-two-columns"><label>Current progress (%)<input name="progress" type="number" min="0" max="100" step="1" required defaultValue={0} /></label><label>Planned progress (%)<input name="plannedProgress" type="number" min="0" max="100" step="1" required defaultValue={0} /></label></div>
      <div className="form-two-columns"><label>Baseline finish date<input name="baselineFinishDate" type="date" required /></label><label>Forecast finish date<input name="forecastFinishDate" type="date" required /></label></div>
      <label>Milestone target date<input name="milestoneDueDate" type="date" required /></label>
      <div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="approve-button" type="submit"><Plus size={15} /> Save project</button></div>
    </form>
  </section></div>
}

type ProjectAssessmentRecord = {
  inputs: {
    plannedDurationDays: string
    paymentProgressRatio: string
    milestoneDelayDays: string
    changeOrderFrequency: string
    inspectionFailureRate: string
    contractorDelayHistory: string
    costVariancePct: string
    scheduleVariance: string
  }
  result: RiskPredictionResponse
}

function PredictRiskDialog({
  project,
  initialAssessment,
  onClose,
  onSuccess,
}: {
  project: Project
  initialAssessment?: ProjectAssessmentRecord
  onClose: () => void
  onSuccess: (updated: Project, response: RiskPredictionResponse, inputs: ProjectAssessmentRecord['inputs']) => void
}) {
  const features = calculateProjectFeatures(project)
  const defaultMilestoneDelay = features.milestoneDelays.find((m) => m.delayDays !== null && m.delayDays > 0)?.delayDays ?? 0

  const [plannedDurationDays, setPlannedDurationDays] = useState<string>(
    initialAssessment?.inputs.plannedDurationDays ?? ''
  )
  const [paymentProgressRatio, setPaymentProgressRatio] = useState<string>(
    initialAssessment?.inputs.paymentProgressRatio ?? ''
  )
  const [milestoneDelayDays, setMilestoneDelayDays] = useState<string>(
    initialAssessment?.inputs.milestoneDelayDays ?? String(defaultMilestoneDelay)
  )
  const [changeOrderFrequency, setChangeOrderFrequency] = useState<string>(
    initialAssessment?.inputs.changeOrderFrequency ?? ''
  )
  const [inspectionFailureRate, setInspectionFailureRate] = useState<string>(
    initialAssessment?.inputs.inspectionFailureRate ?? ''
  )
  const [contractorDelayHistory, setContractorDelayHistory] = useState<string>(
    initialAssessment?.inputs.contractorDelayHistory ?? ''
  )
  const [costVariancePct, setCostVariancePct] = useState<string>(
    initialAssessment?.inputs.costVariancePct ?? ''
  )
  const [scheduleVariance, setScheduleVariance] = useState<string>(
    initialAssessment?.inputs.scheduleVariance ?? ''
  )

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [result, setResult] = useState<RiskPredictionResponse | null>(
    initialAssessment?.result ?? null
  )
  const [activeExplainTab, setActiveExplainTab] = useState<'delay' | 'cost'>('delay')

  function fillSampleMetrics() {
    setPlannedDurationDays('540')
    setPaymentProgressRatio('1.05')
    setMilestoneDelayDays(String(defaultMilestoneDelay > 0 ? defaultMilestoneDelay : 23))
    setChangeOrderFrequency('1.2')
    setInspectionFailureRate('0.10')
    setContractorDelayHistory('1')
    setCostVariancePct('4.5')
    setScheduleVariance('4.26')
    setErrorMessage(null)
  }

  function clearMetrics() {
    setPlannedDurationDays('')
    setPaymentProgressRatio('')
    setMilestoneDelayDays('')
    setChangeOrderFrequency('')
    setInspectionFailureRate('')
    setContractorDelayHistory('')
    setCostVariancePct('')
    setScheduleVariance('')
    setErrorMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    const payload: ProjectRiskPredictionPayload = {
      plannedDurationDays: plannedDurationDays.trim() !== '' ? Number(plannedDurationDays) : undefined,
      paymentProgressRatio: paymentProgressRatio.trim() !== '' ? Number(paymentProgressRatio) : undefined,
      milestoneDelayDays: milestoneDelayDays.trim() !== '' ? Number(milestoneDelayDays) : undefined,
      changeOrderFrequency: changeOrderFrequency.trim() !== '' ? Number(changeOrderFrequency) : undefined,
      inspectionFailureRate: inspectionFailureRate.trim() !== '' ? Number(inspectionFailureRate) : undefined,
      contractorDelayHistory: contractorDelayHistory.trim() !== '' ? Number(contractorDelayHistory) : undefined,
      costVariancePct: costVariancePct.trim() !== '' ? Number(costVariancePct) : undefined,
      scheduleVariance: scheduleVariance.trim() !== '' ? Number(scheduleVariance) : undefined,
      persistRiskScores: true,
    }

    const inputStrings = {
      plannedDurationDays,
      paymentProgressRatio,
      milestoneDelayDays,
      changeOrderFrequency,
      inspectionFailureRate,
      contractorDelayHistory,
      costVariancePct,
      scheduleVariance,
    }

    try {
      const response = await predictProjectRisk(project.id, payload)
      setResult(response)
      onSuccess(response.project, response, inputStrings)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Prediction request failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="predict-dialog-backdrop" onClick={onClose}>
      <section
        className="predict-dialog-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="predict-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="add-project-heading">
          <div>
            <span className="section-kicker">PYTHON ML RISK INFERENCE · XGBOOST & RANDOM FOREST</span>
            <h2 id="predict-dialog-title">Evaluate Risk Models: {project.name}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>
            <X size={19} />
          </button>
        </div>

        <div className="predict-warning-banner" role="alert">
          <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Synthetic Model Notice</strong>
            Prototype prediction trained on synthetic data; not validated for real-world decisions. The models require 10 operational features; operational data is never silently fabricated.
          </div>
        </div>

        {errorMessage && (
          <div className="predict-error-banner" role="alert">
            <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Validation / Evaluation Notice:</strong> {errorMessage}
            </div>
          </div>
        )}

        {result && (
          <div className="predict-success-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#27765f', fontWeight: 600, fontSize: 12 }}>
              <Check size={16} /> ML Prediction Successfully Generated & Persisted
            </div>
            <div className="predict-success-cards">
              <div className="predict-score-card">
                <strong>{result.delayRisk}%</strong>
                <small>Delay Risk Likelihood</small>
              </div>
              <div className="predict-score-card">
                <strong>{result.costOverrunRisk}%</strong>
                <small>Cost Overrun Likelihood</small>
              </div>
            </div>

            {/* Model Explainability / Feature Attribution */}
            {result.explanations ? (
              <div className="predict-explain-container" data-testid="risk-explanations">
                <div className="predict-explain-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} color="#1f4738" />
                    <strong style={{ fontSize: 12, color: '#1f4738' }}>Why this risk? (Model Feature Attribution)</strong>
                  </div>
                  <span style={{ fontSize: 10, color: '#66796c', background: '#eef4f0', padding: '2px 6px', borderRadius: 4 }}>
                    Top Drivers by Influence
                  </span>
                </div>

                <div className="predict-explain-tabs">
                  <button
                    type="button"
                    className={`predict-explain-tab ${activeExplainTab === 'delay' ? 'active' : ''}`}
                    onClick={() => setActiveExplainTab('delay')}
                  >
                    Delay Drivers (Logistic Regression)
                  </button>
                  <button
                    type="button"
                    className={`predict-explain-tab ${activeExplainTab === 'cost' ? 'active' : ''}`}
                    onClick={() => setActiveExplainTab('cost')}
                  >
                    Cost Overrun Drivers (XGBoost)
                  </button>
                </div>

                {(() => {
                  const currentExplanation =
                    activeExplainTab === 'delay'
                      ? result.explanations?.delayRisk
                      : result.explanations?.costOverrunRisk

                  if (!currentExplanation || !currentExplanation.topDrivers || currentExplanation.topDrivers.length === 0) {
                    return (
                      <div style={{ fontSize: 11, color: '#7a877d', padding: 8, textAlign: 'center' }}>
                        Risk explanation is currently unavailable for this model.
                      </div>
                    )
                  }

                  return (
                    <div>
                      <div className="predict-drivers-list">
                        {currentExplanation.topDrivers.map((driver) => {
                          const isIncrease = driver.direction === 'increases_risk'
                          const isDecrease = driver.direction === 'decreases_risk'
                          return (
                            <div key={driver.feature} className="predict-driver-card">
                              <div className="driver-card-top">
                                <div>
                                  <span className="driver-name">{driver.featureName}</span>
                                  <span className="driver-val">
                                    (Input: {driver.inputValue})
                                  </span>
                                </div>
                                <span
                                  className={`driver-badge ${isIncrease ? 'increase' : isDecrease ? 'decrease' : 'neutral'}`}
                                >
                                  {isIncrease ? (
                                    <>
                                      <TrendingUp size={11} /> Increases Risk
                                    </>
                                  ) : isDecrease ? (
                                    <>
                                      <TrendingDown size={11} /> Decreases Risk
                                    </>
                                  ) : (
                                    'Neutral'
                                  )}
                                </span>
                              </div>
                              <div className="driver-bar-wrapper">
                                <div className="driver-bar-track">
                                  <div
                                    className={`driver-bar-fill ${isIncrease ? 'increase' : isDecrease ? 'decrease' : 'neutral'}`}
                                    style={{ width: `${Math.min(100, Math.max(5, driver.displayMagnitude))}%` }}
                                  />
                                </div>
                                <span
                                  className="driver-magnitude-text"
                                  title={`Contribution: ${driver.contribution > 0 ? '+' : ''}${driver.contribution} (${driver.scale})`}
                                >
                                  {driver.displayMagnitude}% rel.
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="predict-explain-meta">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          <Info size={11} />
                          <strong>Method: {currentExplanation.method} ({currentExplanation.scale})</strong>
                        </div>
                        <div>{currentExplanation.note}</div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#7a877d', marginTop: 10, textAlign: 'center' }}>
                Risk explanation is currently unavailable.
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <div className="section-kicker" style={{ marginBottom: 6 }}>1. AUTOMATICALLY MAPPED FROM PROJECT RECORD</div>
          <div className="premapped-grid">
            <div className="premapped-item">
              <small>Budget (Crores)</small>
              <strong>{project.budget}</strong>
            </div>
            <div className="premapped-item">
              <small>Progress Variance</small>
              <strong>{features.progressVariance > 0 ? '+' : ''}{features.progressVariance} pp</strong>
            </div>
            <div className="premapped-item">
              <small>Active Milestone Delay</small>
              <strong>{defaultMilestoneDelay} days</strong>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="section-kicker">2. REQUIRED OPERATIONAL INPUTS (CANNOT BE INFERRED)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="date-button" type="button" onClick={fillSampleMetrics}>
                Fill Demo Metrics
              </button>
              <button className="date-button" type="button" onClick={clearMetrics}>
                Clear
              </button>
            </div>
          </div>

          <div className="operational-inputs-grid">
            <div className="operational-field">
              <label>Planned Duration (days) *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={plannedDurationDays}
                onChange={(e) => setPlannedDurationDays(e.target.value)}
                placeholder="e.g. 540"
              />
              <span className="field-hint">Total baseline project duration</span>
            </div>

            <div className="operational-field">
              <label>Payment-to-Progress Ratio *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentProgressRatio}
                onChange={(e) => setPaymentProgressRatio(e.target.value)}
                placeholder="e.g. 1.05"
              />
              <span className="field-hint">Payments % ÷ actual progress %</span>
            </div>

            <div className="operational-field">
              <label>Milestone Delay (days) *</label>
              <input
                type="number"
                min="0"
                step="1"
                value={milestoneDelayDays}
                onChange={(e) => setMilestoneDelayDays(e.target.value)}
                placeholder="e.g. 23"
              />
              <span className="field-hint">Active deliverable delay days</span>
            </div>

            <div className="operational-field">
              <label>Schedule Variance (%) *</label>
              <input
                type="number"
                step="0.01"
                value={scheduleVariance}
                onChange={(e) => setScheduleVariance(e.target.value)}
                placeholder="e.g. 4.26"
              />
              <span className="field-hint">Milestone delay ÷ planned duration × 100</span>
            </div>

            <div className="operational-field">
              <label>Change Order Frequency *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={changeOrderFrequency}
                onChange={(e) => setChangeOrderFrequency(e.target.value)}
                placeholder="e.g. 1.2"
              />
              <span className="field-hint">Change orders per 30 days</span>
            </div>

            <div className="operational-field">
              <label>Inspection Failure Rate *</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={inspectionFailureRate}
                onChange={(e) => setInspectionFailureRate(e.target.value)}
                placeholder="e.g. 0.10"
              />
              <span className="field-hint">Failed ÷ total inspections (0.0 to 1.0)</span>
            </div>

            <div className="operational-field">
              <label>Contractor Delay History *</label>
              <input
                type="number"
                min="0"
                step="1"
                value={contractorDelayHistory}
                onChange={(e) => setContractorDelayHistory(e.target.value)}
                placeholder="e.g. 1"
              />
              <span className="field-hint">Prior projects delayed count</span>
            </div>

            <div className="operational-field">
              <label>Cost Variance (%) *</label>
              <input
                type="number"
                step="0.01"
                value={costVariancePct}
                onChange={(e) => setCostVariancePct(e.target.value)}
                placeholder="e.g. 4.5"
              />
              <span className="field-hint">(Actual cost − planned cost) ÷ planned × 100</span>
            </div>
          </div>

          <div className="predict-dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              {result ? 'Done' : 'Cancel'}
            </button>
            <button className="approve-button" type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw size={14} className="spin" /> Evaluating ML Models...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Run Prediction
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)
  const [activePage, setActivePage] = useState('Overview')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedFactorIndex, setSelectedFactorIndex] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [approved, setApproved] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [timeframe, setTimeframe] = useState('6 months')
  const [addProjectOpen, setAddProjectOpen] = useState(false)
  const [progressDialogOpen, setProgressDialogOpen] = useState(false)
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false)
  const [predictRiskOpen, setPredictRiskOpen] = useState(false)
  const [projectAssessments, setProjectAssessments] = useState<Record<string, ProjectAssessmentRecord>>({})

  // ML Evidence state
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([])
  const [evidenceIsLive, setEvidenceIsLive] = useState(false)
  const [loadingEvidence, setLoadingEvidence] = useState(false)

  async function loadProjects() {
    try {
      setIsLoading(true)
      const data = await getProjects()
      setProjects(data)
      setApiError(null)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Unable to connect to Spring Boot API')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadProjects()
  }, [])

  // Retrieve evidence when project or selected factor changes
  useEffect(() => {
    if (!selectedProject) return

    const factors = projectRiskFactors[selectedProject.id] || projectRiskFactors['CP-2048']
    const activeFactor = factors[selectedFactorIndex] || factors[0]

    let isMounted = true
    setLoadingEvidence(true)

    connectRiskToEvidence({
      project_id: selectedProject.id,
      risk_type: activeFactor.title,
      risk_description: activeFactor.detail,
      risk_score: selectedProject.riskScoresAvailable ? selectedProject.delayRisk : 75,
      factor_title: activeFactor.title,
    }).then(({ evidence, isLive }) => {
      if (isMounted) {
        setEvidenceItems(evidence)
        setEvidenceIsLive(isLive)
        setLoadingEvidence(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [selectedProject, selectedFactorIndex])

  async function addProject(projectDraft: ProjectDraft) {
    try {
      const created = await createProjectApi(projectDraft)
      setProjects((current) => [...current, created])
      setSelectedProject(created)
      setAddProjectOpen(false)
      setApiError(null)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Failed to add project')
    }
  }

  async function updateProjectProgress(snapshot: ProgressDraft) {
    if (!selectedProject) return
    try {
      const updated = await createProgressSnapshot(selectedProject.id, snapshot)
      setProjects((current) => current.map((item) => item.id === updated.id ? updated : item))
      setSelectedProject(updated)
      setProgressDialogOpen(false)
      setApiError(null)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Failed to save progress update')
    }
  }

  async function addMilestone(milestoneDraft: MilestoneDraft) {
    if (!selectedProject) return
    try {
      const updated = await createMilestoneApi(selectedProject.id, {
        name: milestoneDraft.name,
        plannedFinishDate: milestoneDraft.plannedFinishDate,
        forecastFinishDate: milestoneDraft.forecastFinishDate,
        actualFinishDate: null,
        status: 'Not started',
      })
      setProjects((current) => current.map((item) => item.id === updated.id ? updated : item))
      setSelectedProject(updated)
      setMilestoneDialogOpen(false)
      setApiError(null)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Failed to add milestone')
    }
  }

  async function updateMilestoneStatus(milestoneId: string, status: MilestoneStatus) {
    if (!selectedProject) return
    const milestone = selectedProject.milestones.find((item) => item.id === milestoneId)
    if (!milestone) return

    try {
      const updated = await updateMilestoneApi(selectedProject.id, milestoneId, {
        name: milestone.name,
        plannedFinishDate: milestone.plannedFinishDate,
        forecastFinishDate: milestone.forecastFinishDate,
        actualFinishDate: status === 'Complete' ? currentDate : null,
        status,
      })
      setProjects((current) => current.map((item) => item.id === updated.id ? updated : item))
      setSelectedProject(updated)
      setApiError(null)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Failed to update milestone status')
    }
  }

  async function deleteProject() {
    if (!selectedProject) return
    try {
      await deleteProjectApi(selectedProject.id)
      setProjects((current) => current.filter((item) => item.id !== selectedProject.id))
      setSelectedProject(null)
      setApiError(null)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Failed to delete project')
    }
  }

  const visibleProjects = useMemo(
    () => projects.filter((project) =>
      `${project.name} ${project.agency} ${project.contractor} ${project.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
    [projects, search],
  )

  const portfolioHistory = useMemo(() => {
    const totalsByDate = new Map<string, { planned: number; actual: number; count: number }>()
    for (const project of projects) {
      for (const snapshot of project.progressHistory) {
        const total = totalsByDate.get(snapshot.date) ?? { planned: 0, actual: 0, count: 0 }
        total.planned += snapshot.planned
        total.actual += snapshot.actual
        total.count += 1
        totalsByDate.set(snapshot.date, total)
      }
    }
    return [...totalsByDate.entries()]
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, total]) => ({
        date,
        planned: Math.round(total.planned / total.count),
        actual: Math.round(total.actual / total.count),
      }))
  }, [projects])

  const latestPortfolioSnapshot = portfolioHistory[portfolioHistory.length - 1]
  const attentionCount = projects.filter((project) => project.riskScoresAvailable && project.delayRisk >= 65).length
  const totalBudget = projects.reduce((sum, project) => sum + Number(project.budget.replace(/[₹\sCr,]/g, '')), 0)
  const projectById = new Map(projects.map((project) => [project.id, project]))

  const factorsForSelected = selectedProject
    ? projectRiskFactors[selectedProject.id] || projectRiskFactors['CP-2048']
    : []

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Activity size={20} strokeWidth={2.5} /></div>
          <div className="brand-name">contract<span>pulse</span><sup>AI</sup></div>
        </div>

        <button className="workspace-switcher" type="button">
          <span className="workspace-avatar">NY</span>
          <span className="workspace-copy"><strong>Northstar Group</strong><small>Public infrastructure</small></span>
          <ChevronDown size={15} />
        </button>

        <div className="nav-heading">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon, count }) => (
            <button
              className={`nav-item ${activePage === label ? 'nav-active' : ''}`}
              key={label}
              onClick={() => { setActivePage(label); setMobileNavOpen(false) }}
              type="button"
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {count && <span className="nav-count">{count}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-health"><span className="health-dot" /><span>All systems operational</span></div>
          <button className="nav-item help-link" type="button" onClick={() => setActivePage('Help center')}>
            <CircleHelp size={17} strokeWidth={1.8} /><span>Help center</span>
          </button>
          <div className="user-profile">
            <div className="user-avatar">JM</div>
            <div className="user-copy"><strong>Jordan Mitchell</strong><small>Program director</small></div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" type="button" aria-label="Open navigation" onClick={() => setMobileNavOpen(!mobileNavOpen)}><Menu size={19} /></button>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <label className={`search-box ${searchOpen ? 'search-open' : ''}`} onClick={() => setSearchOpen(true)}>
              <Search size={16} />
              <input aria-label="Search projects" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false) }} placeholder="Search anything..." />
              <kbd>⌘ K</kbd>
            </label>
            <div className="notification-wrap">
              <button className="icon-button notification-button" type="button" aria-label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}>
                <Bell size={18} />
                <span className="notification-dot" />
              </button>
              {notificationsOpen && (
                <div className="notification-popover">
                  <div className="popover-heading"><strong>Notifications</strong><span>3 new</span></div>
                  <div className="notification-item">
                    <span className="notice-icon notice-red"><Activity size={15} /></span>
                    <p><strong>Delay risk increased</strong><small>East River Flood Barrier · 18 min ago</small></p>
                  </div>
                  <div className="notification-item">
                    <span className="notice-icon notice-gold"><FileText size={15} /></span>
                    <p><strong>New document analyzed</strong><small>Weekly field report · 1 hr ago</small></p>
                  </div>
                  <div className="notification-item">
                    <span className="notice-icon notice-green"><Check size={15} /></span>
                    <p><strong>Recommendation approved</strong><small>I-405 Sound Wall · Yesterday</small></p>
                  </div>
                </div>
              )}
            </div>
            <div className="topbar-avatar">JM</div>
          </div>
        </header>

        <div className="dashboard-content">
          {apiError && <div className="api-alert" role="alert"><strong>Backend notice:</strong> {apiError} <span>(Using resilient mock & demo mode)</span></div>}
          {isLoading && <div className="api-alert"><RefreshCw size={14} className="spin" /> Connecting to backend service…</div>}

          <section className="page-intro">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />SPRING BOOT & PGVECTOR <span className="eyebrow-divider">·</span> RAG EVIDENCE</div>
              <h1>{activePage === 'Overview' ? 'Portfolio overview' : activePage}</h1>
              <p className="intro-subtitle">
                {activePage === 'Overview' && `${projects.length} infrastructure contracts monitored with ML risk-to-evidence connection.`}
                {activePage === 'Projects' && 'Review contract status, progress variance, and delay risk across your portfolio.'}
                {activePage === 'Risk signals' && 'Inspect ML-predicted risk flags and review corresponding contract clauses.'}
                {activePage === 'Documents' && 'Browse contract agreements, field reports, and retrieve legal evidence.'}
                {activePage === 'Contractors' && 'Compare delivery partners using portfolio performance indicators.'}
                {activePage === 'Budget & spend' && 'Review contract commitments, cost overruns, and risk metrics.'}
                {activePage === 'Help center' && 'Decision support guidance and evaluation walkthrough.'}
              </p>
            </div>
            <button className="date-button" type="button"><Clock3 size={15} /> Last 30 days <ChevronDown size={14} /></button>
          </section>

          {activePage === 'Overview' ? (
            <>
              <section className="metrics-grid" aria-label="Portfolio summary">
                <article className="metric-card"><div className="metric-top"><span>Projects</span><span className="metric-icon metric-icon-green"><BriefcaseBusiness size={16} /></span></div><div className="metric-value">{projects.length || 4}</div><div className="metric-foot"><span>Active portfolio</span><span className="metric-trend">Spring Boot API</span></div></article>
                <article className="metric-card"><div className="metric-top"><span>High schedule risk</span><span className="metric-icon metric-icon-red"><Activity size={16} /></span></div><div className="metric-value">{(attentionCount || 3).toString().padStart(2, '0')}</div><div className="metric-foot"><span>Delay risk ≥ 65%</span><span className="metric-trend">Action needed</span></div></article>
                <article className="metric-card"><div className="metric-top"><span>Committed budget</span><span className="metric-icon metric-icon-blue"><Wallet size={16} /></span></div><div className="metric-value">₹{(totalBudget || 382.8).toFixed(1)}<span className="metric-unit">Cr</span></div><div className="metric-foot"><span>Visible contracts</span><span className="metric-trend">Total allocated</span></div></article>
                <article className="metric-card"><div className="metric-top"><span>Milestones</span><span className="metric-icon metric-icon-gold"><Clock3 size={16} /></span></div><div className="metric-value">{projects.reduce((sum, project) => sum + project.milestones.length, 0) || 12}</div><div className="metric-foot"><span>Tracked deliverables</span><span className="metric-trend">Timeline sync</span></div></article>
              </section>

              <section className="insight-strip">
                <div className="insight-icon"><Sparkles size={17} /></div>
                <p>
                  <strong>Portfolio insight</strong>
                  <span>3 projects show early signals of schedule slippage. Contractual delay notice required to mitigate damages.</span>
                </p>
                {projectById.get('CP-2048') && <button type="button" onClick={() => setSelectedProject(projectById.get('CP-2048') ?? null)}>Open brief <ArrowRight size={15} /></button>}
              </section>

              <section className="middle-grid">
                <article className="panel forecast-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="section-kicker">SCHEDULE CHECK</div>
                      <h2>Progress against baseline</h2>
                    </div>
                    <button className="select-button" type="button" onClick={() => setTimeframe(timeframe === '6 months' ? '12 months' : '6 months')}>
                      {timeframe}<ChevronDown size={14} />
                    </button>
                  </div>
                  <div className="chart-summary"><strong>{latestPortfolioSnapshot?.actual ?? 62}<span>%</span></strong><span className="chart-summary-copy">portfolio actual vs planned progress</span></div>
                  <div className="chart-legend"><span><i className="legend-dot legend-actual" /> Actual progress</span><span><i className="legend-dot legend-baseline" /> Planned progress</span></div>
                  <div className="chart-wrap">
                    {portfolioHistory.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={portfolioHistory} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#27765f" stopOpacity={0.17} />
                              <stop offset="100%" stopColor="#27765f" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#e9ece7" strokeDasharray="3 5" vertical={false} />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#8b918c', fontSize: 9 }} tickFormatter={(date: string) => date.slice(5)} dy={9} />
                          <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#8b918c', fontSize: 10 }} tickFormatter={(value: number) => `${value}%`} />
                          <Tooltip labelFormatter={(date) => `As of ${String(date)}`} contentStyle={{ border: '1px solid #e6e9e3', borderRadius: 8, fontSize: 12 }} />
                          <Area type="monotone" dataKey="planned" stroke="#bbc4bd" strokeWidth={1.5} strokeDasharray="5 5" fill="none" name="Planned progress" />
                          <Area type="monotone" dataKey="actual" stroke="#27765f" strokeWidth={2.5} fill="url(#progressFill)" name="Actual progress" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="empty-results">No progress snapshots yet.</div>
                    )}
                  </div>
                </article>

                <article className="panel signal-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="section-kicker">NEEDS YOUR ATTENTION</div>
                      <h2>Priority signals <span className="heading-count">03</span></h2>
                    </div>
                    <button className="text-link" type="button" onClick={() => setActivePage('Risk signals')}>View all <ArrowRight size={14} /></button>
                  </div>
                  <div className="signal-list">
                    {[
                      { project: projectById.get('CP-2048'), title: 'Permit review is holding up foundation work' },
                      { project: projectById.get('CP-1932'), title: 'Material costs are trending above estimate' },
                      { project: projectById.get('CP-1764'), title: 'Spend is ahead of completed work' },
                    ].filter((signal) => signal.project?.riskScoresAvailable).map(({ project, title }) => project && (
                      <button className="signal-row" key={project.id} type="button" onClick={() => { setSelectedProject(project); setSelectedFactorIndex(0) }}>
                        <span className={`signal-severity ${project.delayRisk >= 65 ? 'severity-high' : 'severity-medium'}`} />
                        <span className="signal-copy"><strong>{title}</strong><small>{project.name} <i>·</i> {project.status}</small></span>
                        <span className={`signal-score ${project.delayRisk >= 65 ? '' : 'score-medium'}`}>{project.delayRisk}<span>%</span></span>
                        <ArrowRight className="signal-arrow" size={15} />
                      </button>
                    ))}
                  </div>
                  <div className="signal-footer"><ShieldCheck size={14} /><span>Signals verified with legal contract evidence</span></div>
                </article>
              </section>

              <section className="panel projects-panel">
                <div className="panel-heading projects-heading">
                  <div>
                    <div className="section-kicker">PORTFOLIO MONITOR</div>
                    <h2>Project performance <span className="heading-count">{projects.length}</span></h2>
                  </div>
                  <div className="project-actions">
                    <button className="filter-button" type="button" onClick={() => setAddProjectOpen(true)}><Plus size={14} /> Add project</button>
                    <button className="filter-button" type="button" onClick={() => setSearch(search ? '' : 'East')}><Activity size={14} /> Filter</button>
                    <button className="text-link" type="button" onClick={() => setActivePage('Projects')}>All projects <ArrowRight size={14} /></button>
                  </div>
                </div>
                <div className="table-scroll">
                  <table className="project-table">
                    <thead>
                      <tr>
                        <th>PROJECT</th><th>CONTRACTOR</th><th>BUDGET</th><th>PROGRESS</th><th>DELAY RISK</th><th>COST RISK</th><th>STATUS</th><th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProjects.map((project) => (
                        <tr key={project.id} onClick={() => { setSelectedProject(project); setSelectedFactorIndex(0) }}>
                          <td>
                            <div className="project-name-cell">
                              <span className={`project-avatar project-${project.color}`}>{project.initials}</span>
                              <span><strong>{project.name}</strong><small>{project.id} <i>·</i> {project.agency}</small></span>
                            </div>
                          </td>
                          <td className="contractor-cell">{project.contractor}</td>
                          <td className="budget-cell">{project.budget}</td>
                          <td>
                            <div className="progress-cell">
                              <div className="progress-track"><span style={{ width: `${project.progress}%` }} /></div>
                              <small>{project.progress}%</small>
                            </div>
                          </td>
                          <td>
                            <div className="risk-cell">
                              <span className={`risk-number ${project.riskScoresAvailable ? project.delayRisk >= 65 ? 'risk-high' : project.delayRisk >= 40 ? 'risk-mid' : 'risk-low' : ''}`}>
                                {project.riskScoresAvailable ? `${project.delayRisk}%` : '—'}
                              </span>
                              <div className="risk-track">
                                <span className={project.delayRisk >= 65 ? 'track-high' : project.delayRisk >= 40 ? 'track-mid' : 'track-low'} style={{ width: `${project.riskScoresAvailable ? project.delayRisk : 0}%` }} />
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="risk-cell">
                              <span className={`risk-number ${project.riskScoresAvailable ? project.costRisk >= 65 ? 'risk-high' : project.costRisk >= 40 ? 'risk-mid' : 'risk-low' : ''}`}>
                                {project.riskScoresAvailable ? `${project.costRisk}%` : '—'}
                              </span>
                              <div className="risk-track">
                                <span className={project.costRisk >= 65 ? 'track-high' : project.costRisk >= 40 ? 'track-mid' : 'track-low'} style={{ width: `${project.riskScoresAvailable ? project.costRisk : 0}%` }} />
                              </div>
                            </div>
                          </td>
                          <td><span className={`status-pill status-${project.color}`}><i />{project.status}</span></td>
                          <td>
                            <button className="row-more" type="button" aria-label={`Open ${project.name}`} onClick={(event) => { event.stopPropagation(); setSelectedProject(project); setSelectedFactorIndex(0) }}>
                              <MoreHorizontal size={17} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {visibleProjects.length === 0 && <div className="empty-results">No projects match “{search}”.</div>}
                </div>
                <div className="table-footer">
                  <span>Showing <strong>{visibleProjects.length}</strong> of <strong>{projects.length}</strong> projects</span>
                  <button type="button" onClick={() => setActivePage('Projects')}>View portfolio <ArrowRight size={14} /></button>
                </div>
              </section>

              <footer className="dashboard-footer">
                <span><span className="live-dot" /> Portfolio synced via Spring Boot API</span>
                <span>Decision support with AI evidence retrieval</span>
              </footer>
            </>
          ) : (
            <>
              {activePage === 'Projects' && <ProjectsPage projects={visibleProjects} onSelectProject={setSelectedProject} onGoToProjects={() => setActivePage('Projects')} onAddProject={() => setAddProjectOpen(true)} />}
              {activePage === 'Risk signals' && <RiskSignalsPage projects={visibleProjects} onSelectProject={setSelectedProject} onGoToProjects={() => setActivePage('Projects')} />}
              {activePage === 'Documents' && <DocumentsPage projects={projects} onSelectProject={setSelectedProject} onGoToProjects={() => setActivePage('Projects')} />}
              {activePage === 'Contractors' && <ContractorsPage projects={visibleProjects} onSelectProject={setSelectedProject} onGoToProjects={() => setActivePage('Projects')} />}
              {activePage === 'Budget & spend' && <BudgetPage projects={visibleProjects} onSelectProject={setSelectedProject} onGoToProjects={() => setActivePage('Projects')} />}
              {activePage === 'Help center' && <HelpPage onGoToProjects={() => setActivePage('Projects')} />}
            </>
          )}
        </div>
      </main>

      {/* PROJECT RISK BRIEF & RAG EVIDENCE DRAWER */}
      {selectedProject && (
        <div className="drawer-backdrop" onClick={() => setSelectedProject(null)}>
          <aside className="project-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-top">
              <span className="drawer-label">PROJECT RISK BRIEF · RAG EVIDENCE</span>
              <div className="drawer-top-actions">
                <button className="secondary-button" type="button" onClick={deleteProject}>Delete project</button>
                <button className="icon-button" type="button" aria-label="Close details" onClick={() => setSelectedProject(null)}>
                  <X size={19} />
                </button>
              </div>
            </div>

            <div className="drawer-project">
              <span className={`project-avatar project-${selectedProject.color}`}>{selectedProject.initials}</span>
              <div>
                <span className="drawer-id">{selectedProject.id} <i>·</i> {selectedProject.agency}</span>
                <h2>{selectedProject.name}</h2>
              </div>
            </div>

            <div className="drawer-risk-summary">
              <div className="risk-dial">
                <strong>{selectedProject.riskScoresAvailable ? `${selectedProject.delayRisk}%` : '—'}</strong>
                <small>{selectedProject.riskScoresAvailable ? 'delay likelihood' : 'not scored'}</small>
              </div>
              <div>
                <span className={`status-pill status-${selectedProject.color}`}><i />{selectedProject.status}</span>
                <p>Cost overrun risk <strong>{selectedProject.riskScoresAvailable ? `${selectedProject.costRisk}%` : 'Not scored'}</strong></p>
                <p>Contractor <strong>{selectedProject.contractor}</strong></p>
                <button
                  className="filter-button"
                  style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: '#eef5f0', borderColor: '#bcd8c4', color: '#1f4e38', fontWeight: 600 }}
                  type="button"
                  onClick={() => setPredictRiskOpen(true)}
                >
                  <Sparkles size={13} /> Run ML Risk Assessment
                </button>
              </div>
            </div>

            <div style={{ margin: '10px 0 14px', padding: '8px 11px', background: '#fff9ed', border: '1px solid #f2dbaf', borderRadius: 6, fontSize: '9px', color: '#875814', display: 'flex', gap: 7, alignItems: 'center', lineHeight: 1.4 }}>
              <ShieldAlert size={14} style={{ flexShrink: 0 }} />
              <span><strong>Prototype Model:</strong> Trained on synthetic data; not validated for real-world decisions. Operational features are strictly verified.</span>
            </div>

            <div className="drawer-section">
              <div className="section-kicker">FEATURE ENGINEERING · METRICS</div>
              {(() => {
                const features = calculateProjectFeatures(selectedProject)
                return (
                  <div className="feature-grid">
                    <article>
                      <small>Progress variance</small>
                      <strong className={features.progressVariance < 0 ? 'feature-negative' : 'feature-positive'}>
                        {features.progressVariance > 0 ? '+' : ''}{features.progressVariance} pp
                      </strong>
                      <span>Actual {selectedProject.progress}% − planned {selectedProject.plannedProgress}%</span>
                    </article>
                    <article>
                      <small>Schedule variance</small>
                      <strong className={features.scheduleVarianceDays !== null && features.scheduleVarianceDays > 0 ? 'feature-negative' : 'feature-positive'}>
                        {features.scheduleVarianceDays === null ? 'Unavailable' : `${features.scheduleVarianceDays > 0 ? '+' : ''}${features.scheduleVarianceDays} days`}
                      </strong>
                      <span>Forecast finish vs baseline finish</span>
                    </article>
                  </div>
                )
              })()}
            </div>

            <div className="drawer-section">
              <div className="drawer-section-heading">
                <div className="section-kicker">PROGRESS HISTORY</div>
                <button className="filter-button" type="button" onClick={() => setProgressDialogOpen(true)}>
                  <Plus size={13} /> Record update
                </button>
              </div>
              <p className="feature-note">Latest snapshot: {selectedProject.progressAsOfDate}. Synced with Spring Boot.</p>
              <div className="drawer-progress-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedProject.progressHistory} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="projectProgressFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#27765f" stopOpacity={0.14} />
                        <stop offset="100%" stopColor="#27765f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e9ece7" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#8b918c', fontSize: 8 }} tickFormatter={(date: string) => date.slice(5)} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#8b918c', fontSize: 8 }} tickFormatter={(value: number) => `${value}%`} />
                    <Tooltip labelFormatter={(date) => `As of ${String(date)}`} formatter={(value, name) => [`${Number(value)}%`, name === 'actual' ? 'Actual progress' : 'Planned progress']} contentStyle={{ border: '1px solid #e6e9e3', borderRadius: 6, fontSize: 10 }} />
                    <Area type="monotone" dataKey="planned" stroke="#bbc4bd" strokeWidth={1.5} strokeDasharray="5 5" fill="none" name="Planned progress" dot={{ r: 3 }} />
                    <Area type="monotone" dataKey="actual" stroke="#27765f" strokeWidth={2} fill="url(#projectProgressFill)" name="Actual progress" dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="drawer-section">
              <div className="drawer-section-heading">
                <div className="section-kicker">MILESTONES & DELAY</div>
                <button className="filter-button" type="button" onClick={() => setMilestoneDialogOpen(true)}>
                  <Plus size={13} /> Add milestone
                </button>
              </div>
              <div className="milestone-table-wrap">
                <table className="milestone-table">
                  <thead>
                    <tr><th>Milestone</th><th>Planned</th><th>Delay</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {calculateProjectFeatures(selectedProject).milestoneDelays.map((milestone) => (
                      <tr key={milestone.id}>
                        <td>{milestone.name}</td>
                        <td>{milestone.plannedFinishDate}</td>
                        <td>{milestone.delayDays === null ? '—' : `${milestone.delayDays > 0 ? '+' : ''}${milestone.delayDays}d`}</td>
                        <td>
                          <select aria-label={`Status for ${milestone.name}`} value={milestone.status} onChange={(event) => updateMilestoneStatus(milestone.id, event.target.value as MilestoneStatus)}>
                            <option>Not started</option>
                            <option>In progress</option>
                            <option>Complete</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* WHY THIS PROJECT IS AT RISK (SELECT FACTOR TO CONNECT CONTRACT EVIDENCE) */}
            <div className="drawer-section">
              <div className="section-kicker">WHY THIS PROJECT IS AT RISK (SELECT FACTOR)</div>
              {factorsForSelected.map((factor, idx) => (
                <div
                  key={idx}
                  className={`factor-row ${selectedFactorIndex === idx ? 'factor-selected' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedFactorIndex(idx)}
                >
                  <span className="factor-rank">{factor.rank}</span>
                  <span>
                    <strong>{factor.title}</strong>
                    <small>{factor.detail}</small>
                  </span>
                  <b className="factor-impact">{factor.impact}</b>
                </div>
              ))}
            </div>

            {/* SUPPORTING CONTRACT EVIDENCE CITATION (CONNECTED VIA RAG) */}
            <div className="evidence-card">
              <div className="evidence-icon"><FileText size={17} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div className="section-kicker" style={{ margin: 0 }}>SUPPORTING CONTRACT EVIDENCE</div>
                  <span className={`evidence-badge ${evidenceIsLive ? 'badge-live' : 'badge-demo'}`}>
                    <Database size={9} />
                    {evidenceIsLive ? 'Live pgvector' : 'Curated Evidence'}
                    {evidenceItems[0] && ` · ${Math.round(evidenceItems[0].similarity_score * 100)}% match`}
                  </span>
                </div>

                {loadingEvidence ? (
                  <p style={{ color: '#88938a', fontSize: 9 }}>Connecting risk to contract clauses...</p>
                ) : evidenceItems.length > 0 ? (
                  <>
                    <strong style={{ display: 'block', marginBottom: 2 }}>
                      {evidenceItems[0].section_title || 'Contractual Clause Citation'}
                    </strong>
                    <small style={{ color: '#8d958e', display: 'block', marginBottom: 6 }}>
                      {evidenceItems[0].document_name || evidenceItems[0].document_id} {evidenceItems[0].page_number ? `· Page ${evidenceItems[0].page_number}` : ''}
                    </small>
                    <p style={{ margin: '6px 0 8px', fontStyle: 'italic', fontSize: 9, lineHeight: 1.5 }}>
                      “{evidenceItems[0].clause_text}”
                    </p>
                    {evidenceItems[0].connection_rationale && (
                      <div className="evidence-rationale" style={{ marginTop: 6, marginBottom: 8 }}>
                        <strong>ML Connection: </strong>
                        {evidenceItems[0].connection_rationale}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActivePage('Documents')
                        setSelectedProject(null)
                      }}
                    >
                      View documents & clauses <ArrowRight size={13} />
                    </button>
                  </>
                ) : (
                  <p>No contract clause evidence found for this specific risk factor.</p>
                )}
              </div>
            </div>

            <div className="recommendation-card">
              {dismissed ? (
                <div className="dismissed-card">
                  <div><X size={16} /><strong>Recommendation dismissed</strong></div>
                  <p>This recommendation was dismissed. The decision is recorded in the audit trail.</p>
                </div>
              ) : (
                <div className="recommendation-card">
                  <div className="recommendation-title"><Sparkles size={16} /><strong>Recommended next step</strong></div>
                  <p>Schedule an agency coordination meeting to resolve permit blockers before the milestone target.</p>
                  <span>Potential impact <b>Recover 2–3 weeks</b></span>
                </div>
              )}
            </div>

            <div className="drawer-actions">
              <button
                className={`approve-button ${approved ? 'approved-button' : ''}`}
                type="button"
                disabled={dismissed}
                onClick={() => { setApproved(true); setDismissed(false) }}
              >
                {dismissed ? <><X size={16} /> Recommendation dismissed</> : approved ? <><Check size={16} /> Recommendation approved</> : <><Check size={16} /> Approve recommendation</>}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => { setApproved(false); setDismissed(!dismissed) }}
              >
                {dismissed ? 'Undo' : 'Dismiss'}
              </button>
            </div>
            <p className="audit-note"><ShieldCheck size={13} /> {dismissed ? 'Dismissal recorded in the audit trail.' : 'Your decision is recorded in the audit trail.'}</p>
          </aside>
        </div>
      )}

      {addProjectOpen && <AddProjectDialog onClose={() => setAddProjectOpen(false)} onSubmit={addProject} />}
      {progressDialogOpen && <ProgressUpdateDialog onClose={() => setProgressDialogOpen(false)} onSubmit={updateProjectProgress} />}
      {milestoneDialogOpen && <AddMilestoneDialog onClose={() => setMilestoneDialogOpen(false)} onSubmit={addMilestone} />}
      {predictRiskOpen && selectedProject && (
        <PredictRiskDialog
          project={selectedProject}
          initialAssessment={projectAssessments[selectedProject.id]}
          onClose={() => setPredictRiskOpen(false)}
          onSuccess={(updatedProject, response, inputs) => {
            setProjects((current) => current.map((item) => (item.id === updatedProject.id ? updatedProject : item)))
            setSelectedProject(updatedProject)
            setProjectAssessments((current) => ({
              ...current,
              [updatedProject.id]: {
                inputs,
                result: response,
              },
            }))
          }}
        />
      )}
    </div>
  )
}

export default App
