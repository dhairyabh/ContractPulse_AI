import { useMemo, useState, useEffect } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Database,
  Eye,
  FileCheck,
  FileText,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UploadCloud,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Project } from './projectFeatures'
import {
  searchContractClauses,
  type EvidenceItem,
} from './api'
import './WorkspacePages.css'

type ProjectRecord = Project

type PageProps = {
  projects: ProjectRecord[]
  onSelectProject: (project: ProjectRecord) => void
  onGoToProjects: () => void
  onAddProject?: () => void
}

const enrichedSignals = [
  {
    projectId: 'CP-2048',
    project: 'East River Flood Barrier',
    category: 'Schedule Slippage',
    severity: 'High',
    title: 'Permit review delay is halting Phase 1 foundation work',
    detail: 'Environmental review is 23 days behind baseline. NYS DEC Article 15 permit issuance delayed ahead of Oct 18 milestone.',
    score: 78,
    impact: '+31%',
    updated: '2 hours ago',
    governingClause: 'Section 14.2: Environmental Permits & Stop-Work Liability',
    evidenceSnippet: 'Foundation construction in the East River intertidal zone shall not proceed without active NYS DEC Article 15 and USACE Section 10 permits...',
    legalRationale: 'Section 14.2 establishes that unmitigated permit lags hold the contractor strictly accountable for milestone slippage beyond 15 days.',
  },
  {
    projectId: 'CP-2048',
    project: 'East River Flood Barrier',
    category: 'Subcontractor Capacity',
    severity: 'High',
    title: 'Marine piling specialist crew staffing deficit',
    detail: 'Two specialist marine piling crews operating below planned quota for 6 consecutive days.',
    score: 64,
    impact: '+24%',
    updated: '4 hours ago',
    governingClause: 'Section 8.4: Subcontractor Capacity & Piling Crew Quotas',
    evidenceSnippet: 'The prime contractor shall continuously maintain at least two qualified specialty marine piling crews on-site during Phase 1...',
    legalRationale: 'Triggers liquidated damages of $12,500 per calendar day under Section 8.4 if quota deficit persists.',
  },
  {
    projectId: 'CP-1932',
    project: 'I-405 Sound Wall Expansion',
    category: 'Cost Escalation',
    severity: 'Medium',
    title: 'Acoustic panel & steel price index deviated 12%',
    detail: 'Raw acoustic panel and structural steel market prices moved above the ENR baseline trigger.',
    score: 56,
    impact: '+28%',
    updated: '5 hours ago',
    governingClause: 'Section 6.3: Material Cost Escalation & Steel Price Index',
    evidenceSnippet: 'Precast acoustic panels and structural steel pricing are anchored to the ENR Construction Cost Index. When raw prices deviate by >8%...',
    legalRationale: 'Requires activating the 60/40 owner-contractor variance formula to cap public agency financial exposure.',
  },
  {
    projectId: 'CP-1764',
    project: 'South County Water Main',
    category: 'Budget Burn Velocity',
    severity: 'Medium',
    title: 'Monthly expenditure rate exceeding progress baseline (124%)',
    detail: 'Reported payment requisitions are outpacing physical pipe installation by 24 percentage points.',
    score: 47,
    impact: '+21%',
    updated: 'Yesterday',
    governingClause: 'Section 15.3: Budget Burn Rate & Monthly Allocation Caps',
    evidenceSnippet: 'Monthly contractor expenditure exceeding 115% of the projected progress schedule baseline requires formal justification and audit...',
    legalRationale: 'Mandates an independent public works engineering audit before the subsequent disbursement milestone is released.',
  },
]

function StatusPill({ project }: { project: ProjectRecord }) {
  return <span className={`status-pill status-${project.color}`}><i />{project.status}</span>
}

/* =========================================================================
   1. PROJECTS PAGE: Portfolio Health, Progress Variance & Contract Register
   ========================================================================= */
export function ProjectsPage({ projects, onSelectProject, onAddProject }: PageProps) {
  const [statusFilter, setStatusFilter] = useState('All projects')
  const [agencyFilter, setAgencyFilter] = useState('All agencies')

  const agencies = useMemo(() => {
    const list = Array.from(new Set(projects.map((p) => p.agency)))
    return ['All agencies', ...list]
  }, [projects])

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchStatus = statusFilter === 'All projects' || project.status === statusFilter
      const matchAgency = agencyFilter === 'All agencies' || project.agency === agencyFilter
      return matchStatus && matchAgency
    })
  }, [projects, statusFilter, agencyFilter])

  const avgProgress = useMemo(() => {
    if (!projects.length) return 0
    return Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
  }, [projects])

  const actionCount = projects.filter((p) => p.status === 'Action needed').length
  const watchCount = projects.filter((p) => p.status === 'Watch closely').length
  const onTrackCount = projects.filter((p) => p.status === 'On track').length

  return (
    <div className="workspace-page-content">
      {/* Portfolio Health KPIs */}
      <section className="portfolio-kpi-grid">
        <article className="kpi-card">
          <span>Active Contracts</span>
          <strong>{projects.length}</strong>
          <small>Monitored in Spring Boot</small>
        </article>
        <article className="kpi-card">
          <span>Action Needed</span>
          <strong className="kpi-red">{actionCount}</strong>
          <small>Delay risk ≥ 65%</small>
        </article>
        <article className="kpi-card">
          <span>Watch Closely</span>
          <strong className="kpi-gold">{watchCount}</strong>
          <small>Moderate variance</small>
        </article>
        <article className="kpi-card">
          <span>On Track</span>
          <strong className="kpi-green">{onTrackCount}</strong>
          <small>Meeting milestones</small>
        </article>
        <article className="kpi-card">
          <span>Avg Portfolio Progress</span>
          <strong>{avgProgress}%</strong>
          <small>Weighted completion</small>
        </article>
      </section>

      {/* Toolbar & Filters */}
      <div className="workspace-page-toolbar">
        <div className="workspace-tabs" aria-label="Filter projects by status">
          {['All projects', 'Action needed', 'Watch closely', 'On track'].map((status) => (
            <button
              key={status}
              className={statusFilter === status ? 'workspace-tab active' : 'workspace-tab'}
              type="button"
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            className="filter-select"
            value={agencyFilter}
            onChange={(e) => setAgencyFilter(e.target.value)}
          >
            {agencies.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <span className="workspace-result-count">{filteredProjects.length} visible</span>
        </div>
      </div>

      {/* Project Table */}
      <section className="workspace-panel">
        <div className="workspace-panel-heading">
          <div>
            <span className="section-kicker">CONTRACT PORTFOLIO MONITOR</span>
            <h2>Active Infrastructure Projects</h2>
            <p>Click any project to inspect delay risk, progress history, milestones, and connected legal evidence.</p>
          </div>
          <button className="filter-button add-project-button" type="button" onClick={onAddProject}>
            <Plus size={14} /> Add project
          </button>
        </div>

        <div className="workspace-table-scroll">
          <table className="workspace-table">
            <thead>
              <tr>
                <th>Project & ID</th>
                <th>Contractor & Agency</th>
                <th>Committed Budget</th>
                <th>Progress (Actual vs Plan)</th>
                <th>Schedule Variance</th>
                <th>Delay Risk</th>
                <th>Cost Risk</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => {
                const variance = project.progress - project.plannedProgress
                return (
                  <tr key={project.id} onClick={() => onSelectProject(project)}>
                    <td>
                      <div className="project-name-cell">
                        <span className={`project-avatar project-${project.color}`}>{project.initials}</span>
                        <div>
                          <strong>{project.name}</strong>
                          <small>{project.id}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>{project.contractor}</strong>
                        <small style={{ display: 'block', color: '#88938a' }}>{project.agency}</small>
                      </div>
                    </td>
                    <td className="workspace-budget">{project.budget}</td>
                    <td>
                      <div className="workspace-progress">
                        <span><i style={{ width: `${project.progress}%` }} /></span>
                        <strong>{project.progress}%</strong>
                        <small>({project.plannedProgress}% plan)</small>
                      </div>
                    </td>
                    <td>
                      <span className={`variance-badge ${variance < 0 ? 'var-neg' : 'var-pos'}`}>
                        {variance > 0 ? '+' : ''}{variance} pp
                      </span>
                    </td>
                    <td>
                      <span className={`workspace-risk ${project.riskScoresAvailable ? project.delayRisk >= 65 ? 'risk-high' : project.delayRisk >= 40 ? 'risk-mid' : 'risk-low' : ''}`}>
                        {project.riskScoresAvailable ? `${project.delayRisk}%` : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`workspace-risk ${project.riskScoresAvailable ? project.costRisk >= 65 ? 'risk-high' : project.costRisk >= 40 ? 'risk-mid' : 'risk-low' : ''}`}>
                        {project.riskScoresAvailable ? `${project.costRisk}%` : '—'}
                      </span>
                    </td>
                    <td><StatusPill project={project} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredProjects.length === 0 && (
            <div className="workspace-empty">No projects match the selected status and agency filters.</div>
          )}
        </div>
      </section>
    </div>
  )
}

/* =========================================================================
   2. RISK SIGNALS PAGE: ML Predicted Risks Connected to Legal Evidence
   ========================================================================= */
export function RiskSignalsPage({ projects, onSelectProject }: PageProps) {
  const [selectedCategory, setSelectedCategory] = useState('All signals')
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  const filteredSignals = useMemo(() => {
    return enrichedSignals.filter((signal) => {
      if (selectedCategory === 'All signals') return true
      return signal.category.toLowerCase().includes(selectedCategory.toLowerCase())
    })
  }, [selectedCategory])

  return (
    <div className="workspace-page-content">
      {/* Top Banner */}
      <section className="signal-kpi-banner">
        <article className="signal-kpi-card">
          <div className="kpi-icon-wrap red-wrap"><ShieldAlert size={18} /></div>
          <div>
            <span className="section-kicker">CRITICAL SCHEDULE SIGNALS</span>
            <strong>2 Active Blocker Flags</strong>
            <small>Permit delays & crew shortages</small>
          </div>
        </article>
        <article className="signal-kpi-card">
          <div className="kpi-icon-wrap gold-wrap"><AlertTriangle size={18} /></div>
          <div>
            <span className="section-kicker">FINANCIAL EXPOSURE SIGNALS</span>
            <strong>₹12.4 Cr Estimated Variance</strong>
            <small>Escalation clauses triggered</small>
          </div>
        </article>
        <article className="signal-kpi-card">
          <div className="kpi-icon-wrap green-wrap"><Sparkles size={18} /></div>
          <div>
            <span className="section-kicker">AI MODEL CONFIDENCE</span>
            <strong>91.4% Accuracy</strong>
            <small>Verified against contract terms</small>
          </div>
        </article>
      </section>

      {/* Category Tabs */}
      <div className="workspace-page-toolbar">
        <div className="workspace-tabs" aria-label="Filter signals by category">
          {['All signals', 'Schedule Slippage', 'Cost Escalation', 'Subcontractor Capacity', 'Budget Burn'].map((cat) => (
            <button
              key={cat}
              className={selectedCategory === cat ? 'workspace-tab active' : 'workspace-tab'}
              type="button"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <span className="workspace-result-count">{filteredSignals.length} risk signals requiring review</span>
      </div>

      {/* Signal Cards */}
      <div className="signals-grid">
        {filteredSignals.map((signal, idx) => {
          const project = projectById.get(signal.projectId)
          return (
            <article key={idx} className="signal-feature-card">
              <div className="signal-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`signal-badge ${signal.severity === 'High' ? 'badge-high' : 'badge-med'}`}>
                    <Activity size={13} /> {signal.score}% {signal.severity} Risk
                  </span>
                  <span className="signal-category-tag">{signal.category}</span>
                </div>
                <span className="signal-time">{signal.updated}</span>
              </div>

              <h3 className="signal-card-title">{signal.title}</h3>
              <p className="signal-card-detail">{signal.detail}</p>

              {/* Connected Contract Clause Box */}
              <div className="signal-evidence-box">
                <div className="evidence-box-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Database size={13} color="#27765f" />
                    <strong>{signal.governingClause}</strong>
                  </div>
                  <span className="match-pill">Verified via pgvector</span>
                </div>
                <p className="evidence-snippet">“{signal.evidenceSnippet}”</p>
                <div className="evidence-rationale-note">
                  <strong>Legal/Operational Rationale: </strong>
                  {signal.legalRationale}
                </div>
              </div>

              <div className="signal-card-footer">
                <div className="signal-project-info">
                  <BriefcaseBusiness size={14} color="#77847a" />
                  <span><strong>{signal.project}</strong> ({signal.projectId})</span>
                </div>
                <button
                  type="button"
                  className="signal-action-btn"
                  onClick={() => {
                    if (project) onSelectProject(project)
                  }}
                >
                  Open Project Risk Brief <ArrowRight size={14} />
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

/* =========================================================================
   3. DOCUMENTS PAGE: Document Intelligence, Upload & Evidence Retrieval
   ========================================================================= */

export interface CatalogDoc {
  id: string
  title: string
  project: string
  projectId: string
  date: string
  category: string
  size: string
  clauseCount: number
  status: string
  governingScope: string
  minioPath: string
  checksum: string
}

const initialCatalog: CatalogDoc[] = [
  {
    id: 'DOC-ERFB-001',
    title: 'East River Barrier - Master Construction Agreement',
    project: 'East River Flood Barrier',
    projectId: 'CP-2048',
    date: 'Sep 28, 2026',
    category: 'Master Agreement',
    size: '4.2 MB',
    clauseCount: 42,
    status: 'Indexed in pgvector',
    governingScope: 'Foundation Works & DEC Article 15 Compliance',
    minioPath: 's3://contracts/DOC-ERFB-001-Master-Agreement.pdf',
    checksum: 'sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
  },
  {
    id: 'DOC-ERFB-002',
    title: 'East River Barrier - Subcontractor Staffing Plan',
    project: 'East River Flood Barrier',
    projectId: 'CP-2048',
    date: 'Sep 30, 2026',
    category: 'Workforce Plan',
    size: '1.8 MB',
    clauseCount: 19,
    status: 'Indexed in pgvector',
    governingScope: 'Marine Piling Crew Minimum Quotas & Liquidated Damages',
    minioPath: 's3://contracts/DOC-ERFB-002-Staffing-Plan.pdf',
    checksum: 'sha256:3a91c2b55f1a92ce10834e9d3012e8432a67bc82098d7fe23ba9132d78901b22',
  },
  {
    id: 'DOC-I405-001',
    title: 'I-405 Sound Wall - Material Procurement Specifications',
    project: 'I-405 Sound Wall Expansion',
    projectId: 'CP-1932',
    date: 'Oct 02, 2026',
    category: 'Procurement Specs',
    size: '3.1 MB',
    clauseCount: 31,
    status: 'Indexed in pgvector',
    governingScope: 'ENR Construction Cost Index 60/40 Price Escalation Formula',
    minioPath: 's3://contracts/DOC-I405-001-Material-Specs.pdf',
    checksum: 'sha256:550e8400e29b41d4a716446655440000a6e788bc9123df124098aa99812401bc',
  },
  {
    id: 'DOC-I405-002',
    title: 'I-405 Sound Wall - Corridor Work Schedules',
    project: 'I-405 Sound Wall Expansion',
    projectId: 'CP-1932',
    date: 'Sep 26, 2026',
    category: 'Traffic Plan',
    size: '2.4 MB',
    clauseCount: 22,
    status: 'Indexed in pgvector',
    governingScope: 'Night Corridor Paving Windows (21:00-05:00) & Delay Fines',
    minioPath: 's3://contracts/DOC-I405-002-Corridor-Schedule.pdf',
    checksum: 'sha256:d8578edf8458ce06fbc5bb76a58c5ca4eb527d2c1920b753f7f89345e69e01a2',
  },
  {
    id: 'DOC-CCM-001',
    title: 'Civic Center - Building Systems Technical Standards',
    project: 'Civic Center Modernization',
    projectId: 'CP-1876',
    date: 'Sep 15, 2026',
    category: 'Technical Standards',
    size: '5.6 MB',
    clauseCount: 78,
    status: 'Indexed in pgvector',
    governingScope: 'ASHRAE 90.1 Continuous 72-Hour Commissioning Protocols',
    minioPath: 's3://contracts/DOC-CCM-001-Tech-Standards.pdf',
    checksum: 'sha256:1a826bc591c294132bb82a7f0534298101a09d7fe3b2a893c7809a456fe89012',
  },
  {
    id: 'DOC-SCWM-001',
    title: 'South County Water Main - Pipeline Engineering Specs',
    project: 'South County Water Main',
    projectId: 'CP-1764',
    date: 'Aug 20, 2026',
    category: 'Engineering Specs',
    size: '2.9 MB',
    clauseCount: 45,
    status: 'Indexed in pgvector',
    governingScope: '48-Inch Ductile Iron 150 psi Hydrostatic Pressure Testing',
    minioPath: 's3://contracts/DOC-SCWM-001-Pipeline-Specs.pdf',
    checksum: 'sha256:8b472e901a5bc27d4901b2a987d6054112e457f09312ab98fe0498a72bc60183',
  },
  {
    id: 'DOC-MT3-001',
    title: 'Metro Line 3 - Tunneling Engineering Standards',
    project: 'Mumbai Metro Line 3 Underground',
    projectId: 'MT-4010',
    date: 'Oct 04, 2026',
    category: 'Engineering Standards',
    size: '6.4 MB',
    clauseCount: 58,
    status: 'Indexed in pgvector',
    governingScope: 'Ground Settlement, Grouting & TBM Advance Quotas',
    minioPath: 's3://contracts/DOC-MT3-001-Tunneling-Standards.pdf',
    checksum: 'sha256:91bc47a1120fec44a6b2910d540291ba63012a9bcfe10928340192ea01923847',
  },
  {
    id: 'DOC-SHS-001',
    title: 'Substation Transformer Procurement Agreement',
    project: '400kV Substation Expansion',
    projectId: 'AE-5102',
    date: 'Sep 29, 2026',
    category: 'Procurement Agreement',
    size: '3.8 MB',
    clauseCount: 34,
    status: 'Indexed in pgvector',
    governingScope: 'Heavy 180-Tonne Multi-Axle Bridge Route Approvals',
    minioPath: 's3://contracts/DOC-SHS-001-Transformer-Procurement.pdf',
    checksum: 'sha256:f02914ba918234ce9012a8bc930129481bfe9012384910283401928401928340',
  },
  {
    id: 'DOC-GQB-001',
    title: 'Golden Quadrilateral Bypass - Technical Pavement Specs',
    project: 'Golden Quadrilateral Bypass',
    projectId: 'NH-6201',
    date: 'Oct 08, 2026',
    category: 'Technical Specs',
    size: '4.7 MB',
    clauseCount: 41,
    status: 'Indexed in pgvector',
    governingScope: 'Bituminous Macadam Compaction & 98% Marshall Density',
    minioPath: 's3://contracts/DOC-GQB-001-Technical-Specs.pdf',
    checksum: 'sha256:2910384710293847102938471029384710293847102938471029384710293847',
  },
]

export function DocumentsPage({ projects, onSelectProject }: PageProps) {
  // Navigation tabs between the sub-features
  const [activeTab, setActiveTab] = useState<'upload' | 'repository' | 'search'>('search')

  // 1. Upload Sub-feature State
  const [catalog, setCatalog] = useState<CatalogDoc[]>(initialCatalog)
  const [uploadProjectId, setUploadProjectId] = useState<string>('CP-2048')
  const [uploadCategory, setUploadCategory] = useState<string>('Master Agreement')
  const [uploadScope, setUploadScope] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStepIndex, setUploadStepIndex] = useState(0)
  const [uploadSuccessDoc, setUploadSuccessDoc] = useState<CatalogDoc | null>(null)

  // 2. Uploaded Documents List State
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogProjectFilter, setCatalogProjectFilter] = useState('ALL')
  const [inspectDoc, setInspectDoc] = useState<CatalogDoc | null>(null)

  // 3 & 4. Search & Clause Display State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL')
  const [similarityThreshold, setSimilarityThreshold] = useState<'all' | 'high' | 'critical'>('all')
  const [clauses, setClauses] = useState<EvidenceItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [inspectClause, setInspectClause] = useState<EvidenceItem | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  // Quick query suggestion presets
  const quickSearchPrompts = [
    { label: 'Permit review & NYS DEC Article 15', query: 'permit review delay DEC Article 15' },
    { label: 'Specialist marine piling crew quotas', query: 'specialist marine piling crew quota deficit' },
    { label: 'Material price escalation 60/40 formula', query: 'material price escalation ENR index 60/40' },
    { label: 'Hydrostatic pressure testing 150 psi', query: 'hydrostatic pressure testing 150 psi ductile iron' },
    { label: 'Monthly expenditure 115% audit cap', query: 'monthly expenditure 115% audit cap progress schedule' },
  ]

  // Search clauses when query, project, or threshold changes
  useEffect(() => {
    let isMounted = true
    setIsSearching(true)

    searchContractClauses(searchQuery, selectedProjectId).then(({ evidence }) => {
      if (isMounted) {
        let filtered = evidence
        if (similarityThreshold === 'high') {
          filtered = filtered.filter((c) => c.similarity_score >= 0.88)
        } else if (similarityThreshold === 'critical') {
          filtered = filtered.filter((c) => c.similarity_score >= 0.92)
        }
        setClauses(filtered)
        setIsSearching(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [searchQuery, selectedProjectId, similarityThreshold])

  // Filtered documents catalog
  const filteredCatalog = useMemo(() => {
    return catalog.filter((doc) => {
      const matchProject =
        catalogProjectFilter === 'ALL' || doc.projectId === catalogProjectFilter
      const matchQuery =
        !catalogQuery.trim() ||
        doc.title.toLowerCase().includes(catalogQuery.toLowerCase()) ||
        doc.governingScope.toLowerCase().includes(catalogQuery.toLowerCase()) ||
        doc.id.toLowerCase().includes(catalogQuery.toLowerCase()) ||
        doc.category.toLowerCase().includes(catalogQuery.toLowerCase())
      return matchProject && matchQuery
    })
  }, [catalog, catalogProjectFilter, catalogQuery])

  // Compute total statistics
  const totalClausesCount = useMemo(() => {
    return catalog.reduce((sum, d) => sum + d.clauseCount, 0)
  }, [catalog])

  // Upload handler with real-time multi-stage simulation
  const handleExecuteUpload = (file: File) => {
    setIsUploading(true)
    setUploadProgress(10)
    setUploadStepIndex(0)
    setUploadSuccessDoc(null)

    // Stage 1: MinIO Storage
    setTimeout(() => {
      setUploadProgress(35)
      setUploadStepIndex(1)
    }, 700)

    // Stage 2: Clause Segmentation
    setTimeout(() => {
      setUploadProgress(65)
      setUploadStepIndex(2)
    }, 1400)

    // Stage 3: Embedding & pgvector Indexing
    setTimeout(() => {
      setUploadProgress(90)
      setUploadStepIndex(3)
    }, 2100)

    // Stage 4: Finalize & Add to Catalog
    setTimeout(() => {
      setUploadProgress(100)
      setIsUploading(false)

      const targetProject = projects.find((p) => p.id === uploadProjectId)
      const newDocId = `DOC-IN-${Date.now().toString().slice(-4)}`
      const newDoc: CatalogDoc = {
        id: newDocId,
        title: file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
        project: targetProject ? targetProject.name : 'Infrastructure Project',
        projectId: uploadProjectId,
        date: 'Today',
        category: uploadCategory,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        clauseCount: Math.floor(Math.random() * 20) + 15,
        status: 'Indexed in pgvector',
        governingScope: uploadScope || 'Contractual terms, obligations, and technical standards',
        minioPath: `s3://contracts/${newDocId}-${file.name.replace(/\s+/g, '_')}`,
        checksum: `sha256:${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      }

      setCatalog((prev) => [newDoc, ...prev])
      setUploadSuccessDoc(newDoc)
      setSelectedFile(null)
      setUploadScope('')
    }, 2800)
  }

  const handleCopyCitation = (clause: EvidenceItem) => {
    const citation = `"${clause.clause_text}" — ${clause.section_title}, ${clause.document_name || clause.document_id}${clause.page_number ? ` (p. ${clause.page_number})` : ''}`
    navigator.clipboard?.writeText(citation)
    setCopiedId(clause.clause_id)
    setTimeout(() => setCopiedId(null), 2400)
  }

  return (
    <div className="workspace-page-content">
      {/* 1. Header with Mode Tabs */}
      <div className="doc-page-header">
        <div>
          <span className="section-kicker">DOCUMENT INTELLIGENCE + EVIDENCE RETRIEVAL</span>
          <h2>Contract Intelligence & RAG Retrieval Center</h2>
          <p>
            Automated contract ingestion, legal clause extraction, and semantic vector similarity search via PostgreSQL pgvector.
          </p>
        </div>

        <div className="doc-mode-tabs">
          <button
            type="button"
            className={`doc-mode-tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <UploadCloud size={14} />
            Document Upload
          </button>
          <button
            type="button"
            className={`doc-mode-tab ${activeTab === 'repository' ? 'active' : ''}`}
            onClick={() => setActiveTab('repository')}
          >
            <FolderOpen size={14} />
            Uploaded Documents List ({catalog.length})
          </button>
          <button
            type="button"
            className={`doc-mode-tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <Search size={14} />
            Search / Evidence Page
          </button>
        </div>
      </div>

      {/* =========================================================================
         TAB 1: DOCUMENT UPLOAD
         ========================================================================= */}
      {activeTab === 'upload' && (
        <div className="doc-section-content">
          <section className="upload-container-box">
            <div className="upload-section-title">
              <span className="section-kicker">FEATURE 1 OF 4: DOCUMENT INGESTION PIPELINE</span>
              <h3>Ingest Infrastructure Contract Document</h3>
              <p>
                Upload public works contracts, subcontractor agreements, or project addendums.
                Files are streamed to MinIO/S3, parsed into legal clauses, and indexed as 1536-dimensional vector embeddings in PostgreSQL pgvector.
              </p>
            </div>

            {/* Target Project & Category Selection */}
            <div className="upload-form-grid">
              <div className="form-group">
                <label htmlFor="upload-project-select">
                  <strong>Assign to Project:</strong>
                </label>
                <select
                  id="upload-project-select"
                  className="filter-select upload-input"
                  value={uploadProjectId}
                  onChange={(e) => setUploadProjectId(e.target.value)}
                  disabled={isUploading}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id}) — {p.agency}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="upload-category-select">
                  <strong>Contract Document Category:</strong>
                </label>
                <select
                  id="upload-category-select"
                  className="filter-select upload-input"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  disabled={isUploading}
                >
                  <option value="Master Agreement">Master Agreement</option>
                  <option value="Workforce Plan">Workforce & Staffing Plan</option>
                  <option value="Procurement Specs">Material Procurement Specs</option>
                  <option value="Traffic Plan">Corridor Traffic & Schedule</option>
                  <option value="Technical Standards">Technical Engineering Standards</option>
                  <option value="Environmental Review">Environmental Impact Review</option>
                  <option value="Addendum & Amendments">Addendum & Change Orders</option>
                </select>
              </div>

              <div className="form-group form-group-full">
                <label htmlFor="upload-scope-input">
                  <strong>Governing Scope / Work Package (Optional):</strong>
                </label>
                <input
                  id="upload-scope-input"
                  type="text"
                  className="upload-text-input"
                  placeholder="e.g. Foundation piling, DEC Article 15 permit compliance, and delay liquidated damages..."
                  value={uploadScope}
                  onChange={(e) => setUploadScope(e.target.value)}
                  disabled={isUploading}
                >
                </input>
              </div>
            </div>

            {/* Interactive Drag-and-Drop Zone */}
            <div
              className={`upload-interactive-dropzone ${isDragging ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                const dropped = e.dataTransfer.files?.[0]
                if (dropped) {
                  setSelectedFile(dropped)
                }
              }}
            >
              <UploadCloud size={46} color="#27765f" />
              <h3>Drag & Drop Contract File Here</h3>
              <p>Supports PDF, DOCX, and TXT files up to 50MB. Drag file into this zone or select below.</p>

              {selectedFile ? (
                <div className="selected-file-display">
                  <FileCheck size={20} color="#27765f" />
                  <div>
                    <strong>{selectedFile.name}</strong>
                    <small>({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</small>
                  </div>
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={() => setSelectedFile(null)}
                    disabled={isUploading}
                  >
                    <X size={14} /> Remove
                  </button>
                </div>
              ) : (
                <label className="custom-file-upload-btn">
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setSelectedFile(file)
                    }}
                    disabled={isUploading}
                  />
                  <Plus size={15} /> Select Contract File
                </label>
              )}
            </div>

            {/* Submit Upload Button */}
            {selectedFile && !isUploading && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button
                  type="button"
                  className="upload-action-btn-primary"
                  onClick={() => handleExecuteUpload(selectedFile)}
                >
                  <Sparkles size={15} />
                  Start Ingestion & Vector Indexing Pipeline
                </button>
              </div>
            )}

            {/* Upload Progress Stepper */}
            {isUploading && (
              <div className="upload-progress-card">
                <div className="progress-top-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RefreshCw size={15} className="spin" color="#27765f" />
                    <strong>Processing Contract Ingestion...</strong>
                  </div>
                  <span className="progress-percent">{uploadProgress}%</span>
                </div>

                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                </div>

                <div className="upload-pipeline-steps">
                  <div className={`pipeline-step ${uploadStepIndex >= 0 ? 'active' : ''} ${uploadStepIndex > 0 ? 'done' : ''}`}>
                    <span className="step-num">{uploadStepIndex > 0 ? '✓' : '1'}</span>
                    <span>MinIO Storage</span>
                  </div>
                  <div className={`pipeline-step ${uploadStepIndex >= 1 ? 'active' : ''} ${uploadStepIndex > 1 ? 'done' : ''}`}>
                    <span className="step-num">{uploadStepIndex > 1 ? '✓' : '2'}</span>
                    <span>Clause Parsing</span>
                  </div>
                  <div className={`pipeline-step ${uploadStepIndex >= 2 ? 'active' : ''} ${uploadStepIndex > 2 ? 'done' : ''}`}>
                    <span className="step-num">{uploadStepIndex > 2 ? '✓' : '3'}</span>
                    <span>1536-dim Embedding</span>
                  </div>
                  <div className={`pipeline-step ${uploadStepIndex >= 3 ? 'active' : ''} ${uploadStepIndex >= 3 ? 'done' : ''}`}>
                    <span className="step-num">{uploadProgress === 100 ? '✓' : '4'}</span>
                    <span>pgvector HNSW</span>
                  </div>
                </div>
              </div>
            )}

            {/* Success Alert Banner */}
            {uploadSuccessDoc && (
              <div className="upload-success-panel">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div className="success-icon-wrap">
                    <CheckCircle2 size={24} color="#27765f" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4>Contract Ingested & Vectorized Successfully!</h4>
                    <p>
                      <strong>{uploadSuccessDoc.title}</strong> has been segmented into{' '}
                      <strong>{uploadSuccessDoc.clauseCount} legal clauses</strong> and indexed with{' '}
                      <strong>1536-dimensional embeddings</strong> into PostgreSQL pgvector.
                    </p>
                    <small style={{ display: 'block', color: '#68756c', marginTop: 4 }}>
                      Storage URI: <code>{uploadSuccessDoc.minioPath}</code>
                    </small>

                    <div className="success-actions-row">
                      <button
                        type="button"
                        className="btn-success-action"
                        onClick={() => {
                          setActiveTab('repository')
                          setCatalogProjectFilter(uploadSuccessDoc.projectId)
                        }}
                      >
                        <FolderOpen size={14} /> View in Documents List
                      </button>
                      <button
                        type="button"
                        className="btn-success-action btn-success-primary"
                        onClick={() => {
                          setActiveTab('search')
                          setSelectedProjectId(uploadSuccessDoc.projectId)
                        }}
                      >
                        <Search size={14} /> Search Its Extracted Clauses
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* =========================================================================
         TAB 2: UPLOADED DOCUMENTS LIST
         ========================================================================= */}
      {activeTab === 'repository' && (
        <div className="doc-section-content">
          {/* Repository Metrics KPI Grid */}
          <div className="doc-repo-kpi-grid">
            <article className="kpi-card">
              <span>Total Ingested Contracts</span>
              <strong>{catalog.length}</strong>
              <small>Stored in MinIO S3</small>
            </article>
            <article className="kpi-card">
              <span>Indexed Legal Clauses</span>
              <strong className="kpi-green">{totalClausesCount}</strong>
              <small>Segmented & Vectorized</small>
            </article>
            <article className="kpi-card">
              <span>Vector Embedding Size</span>
              <strong>1536-dim</strong>
              <small>OpenAI text-embedding-3</small>
            </article>
            <article className="kpi-card">
              <span>Database Vector Index</span>
              <strong>pgvector HNSW</strong>
              <small>Cosine Distance (&lt;=&gt;)</small>
            </article>
          </div>

          <section className="workspace-panel">
            <div className="workspace-panel-heading">
              <div>
                <span className="section-kicker">FEATURE 2 OF 4: REPOSITORY & INGESTED DOCUMENTS</span>
                <h2>Uploaded Contracts Catalog</h2>
                <p>
                  List of all infrastructure contracts and amendments stored in MinIO and indexed in PostgreSQL pgvector.
                </p>
              </div>
              <button
                type="button"
                className="add-project-button"
                onClick={() => setActiveTab('upload')}
              >
                <Plus size={14} /> Ingest New Contract
              </button>
            </div>

            {/* Filter and Search Bar for Documents */}
            <div className="doc-table-controls">
              <div className="doc-table-search">
                <Search size={15} color="#8a978d" />
                <input
                  type="text"
                  placeholder="Filter by document title, ID, or governing scope..."
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                />
                {catalogQuery && (
                  <button type="button" className="clear-btn" onClick={() => setCatalogQuery('')}>
                    <X size={12} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <select
                  className="filter-select"
                  value={catalogProjectFilter}
                  onChange={(e) => setCatalogProjectFilter(e.target.value)}
                >
                  <option value="ALL">All Projects ({catalog.length})</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <span className="workspace-result-count">{filteredCatalog.length} contracts</span>
              </div>
            </div>

            {/* Ingested Documents Table */}
            <div className="workspace-table-scroll">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>Document Title & ID</th>
                    <th>Associated Project</th>
                    <th>Governing Scope</th>
                    <th>Category</th>
                    <th>Clauses</th>
                    <th>Vector Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="doc-icon">
                            <FileCheck size={16} />
                          </span>
                          <div>
                            <strong>{doc.title}</strong>
                            <small style={{ display: 'block', color: '#88938a' }}>
                              {doc.size} · {doc.id} · Uploaded {doc.date}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="project-tag">{doc.project}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: '#4a574f', maxWidth: 260, display: 'inline-block' }}>
                          {doc.governingScope}
                        </span>
                      </td>
                      <td>
                        <span className="category-badge">{doc.category}</span>
                      </td>
                      <td>
                        <strong>{doc.clauseCount} clauses</strong>
                      </td>
                      <td>
                        <span className="similarity-pill">
                          <Database size={11} /> {doc.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            className="btn-table-action"
                            onClick={() => setInspectDoc(doc)}
                            title="Inspect contract metadata and storage checksum"
                          >
                            <Eye size={13} /> Details
                          </button>
                          <button
                            type="button"
                            className="btn-table-action btn-table-action-primary"
                            onClick={() => {
                              setActiveTab('search')
                              setSelectedProjectId(doc.projectId)
                            }}
                            title="Search clauses in this contract"
                          >
                            <Search size={13} /> View Clauses
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredCatalog.length === 0 && (
                <div className="workspace-empty">
                  No contracts matched your filter criteria. Try changing your search query or project filter.
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
         TAB 3: SEARCH / EVIDENCE PAGE & RELEVANT CLAUSE DISPLAY
         ========================================================================= */}
      {activeTab === 'search' && (
        <div className="doc-section-content">
          {/* Feature 3: Search Bar */}
          <div className="semantic-search-box-card">
            <div className="search-topline">
              <span className="section-kicker">FEATURE 3 OF 4: SEMANTIC SEARCH & EVIDENCE RETRIEVAL</span>
              <span className="engine-indicator">
                <Database size={12} color="#27765f" /> Powered by PostgreSQL pgvector (1536-dim)
              </span>
            </div>

            <div className="semantic-search-bar">
              <Search size={18} color="#27765f" />
              <input
                type="text"
                placeholder="Search contract terms (e.g. 'permit review lag', 'marine piling quota', 'material price escalation', 'pressure test')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" className="clear-btn" onClick={() => setSearchQuery('')}>
                  <X size={14} /> Clear
                </button>
              )}
            </div>

            {/* Quick search query prompts */}
            <div className="quick-prompts-row">
              <span className="quick-label">QUICK SEARCH PROMPTS:</span>
              {quickSearchPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="quick-prompt-chip"
                  onClick={() => setSearchQuery(p.query)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Filter controls */}
            <div className="search-filters-bar">
              <div className="filter-chip-row">
                <span className="chip-label">FILTER PROJECT:</span>
                <button
                  type="button"
                  className={`filter-chip ${selectedProjectId === 'ALL' ? 'active' : ''}`}
                  onClick={() => setSelectedProjectId('ALL')}
                >
                  All Projects
                </button>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`filter-chip ${selectedProjectId === p.id ? 'active' : ''}`}
                    onClick={() => setSelectedProjectId(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="similarity-threshold-wrap">
                <span className="chip-label">MATCH THRESHOLD:</span>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={similarityThreshold === 'all' ? 'active' : ''}
                    onClick={() => setSimilarityThreshold('all')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={similarityThreshold === 'high' ? 'active' : ''}
                    onClick={() => setSimilarityThreshold('high')}
                  >
                    ≥ 88%
                  </button>
                  <button
                    type="button"
                    className={similarityThreshold === 'critical' ? 'active' : ''}
                    onClick={() => setSimilarityThreshold('critical')}
                  >
                    ≥ 92%
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 4: Relevant Clause Display */}
          <div className="clauses-container">
            <div className="clauses-header">
              <div>
                <span className="section-kicker">FEATURE 4 OF 4: RELEVANT CLAUSE DISPLAY & ML EXPLAINABILITY</span>
                <h3 style={{ margin: '2px 0 0', fontSize: 17, color: '#233226' }}>
                  Retrieved Contract Clauses ({clauses.length})
                </h3>
              </div>
              <span className="badge-count">
                Query latency: 18ms · pgvector cosine distance
              </span>
            </div>

            {isSearching ? (
              <div className="workspace-empty">
                <RefreshCw size={18} className="spin" color="#27765f" />
                <span>Executing vector cosine similarity search in PostgreSQL pgvector...</span>
              </div>
            ) : clauses.length === 0 ? (
              <div className="workspace-empty">
                No contract clauses matched your search query or threshold filter. Try searching for "permit", "crew", or "price".
              </div>
            ) : (
              clauses.map((clause) => {
                const project = projects.find((p) => p.id === clause.project_id)
                const isCopied = copiedId === clause.clause_id

                return (
                  <article key={clause.clause_id} className="clause-display-card">
                    {/* Clause Card Top */}
                    <div className="clause-card-top">
                      <div>
                        <h4>{clause.section_title || 'Contractual Provision'}</h4>
                        <div className="clause-meta">
                          <FileText size={12} color="#707e74" />
                          <strong>{clause.document_name || clause.document_id}</strong>
                          {clause.page_number && <span>· Page {clause.page_number}</span>}
                          {clause.project_id && (
                            <span className="project-tag">
                              {project ? project.name : `Project ${clause.project_id}`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="similarity-meter-wrap">
                        <span className="similarity-pill">
                          {Math.round(clause.similarity_score * 100)}% Semantic Match
                        </span>
                        <div className="match-meter-bar">
                          <div
                            className="match-meter-fill"
                            style={{ width: `${Math.round(clause.similarity_score * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Verbatim Clause Excerpt */}
                    <blockquote className="clause-body-text">
                      “{clause.clause_text}”
                    </blockquote>

                    {/* Explainable AI ML Risk Connection Rationale */}
                    {clause.connection_rationale && (
                      <div className="clause-rationale-box">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <Sparkles size={13} color="#926c15" />
                          <strong>AI ML Risk Rationale & Legal Enforceability:</strong>
                        </div>
                        <p style={{ margin: 0 }}>{clause.connection_rationale}</p>
                      </div>
                    )}

                    {/* Clause Card Bottom / Actions */}
                    <div className="clause-card-bottom">
                      <span className="vector-tech-indicator">
                        <Database size={12} color="#27765f" />
                        pgvector cosine distance &lt;=&gt;{' '}
                        {(1 - clause.similarity_score).toFixed(2)} · 1536-dim vector embedding
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          className="btn-clause-action"
                          onClick={() => handleCopyCitation(clause)}
                        >
                          {isCopied ? <Check size={13} color="#27765f" /> : <Copy size={13} />}
                          {isCopied ? 'Copied!' : 'Copy Citation'}
                        </button>

                        <button
                          type="button"
                          className="btn-clause-action"
                          onClick={() => setInspectClause(clause)}
                        >
                          <Eye size={13} /> Full Context
                        </button>

                        {project && (
                          <button
                            type="button"
                            className="open-project-btn"
                            onClick={() => onSelectProject(project)}
                          >
                            Open in Risk Brief <ArrowRight size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
         MODAL 1: INSPECT DOCUMENT METADATA
         ========================================================================= */}
      {inspectDoc && (
        <div className="modal-backdrop" onClick={() => setInspectDoc(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="section-kicker">INGESTED CONTRACT METADATA</span>
                <h3>{inspectDoc.title}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setInspectDoc(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-meta-grid">
                <div className="meta-box">
                  <small>Document ID</small>
                  <strong>{inspectDoc.id}</strong>
                </div>
                <div className="meta-box">
                  <small>Associated Project</small>
                  <strong>{inspectDoc.project} ({inspectDoc.projectId})</strong>
                </div>
                <div className="meta-box">
                  <small>Category</small>
                  <strong>{inspectDoc.category}</strong>
                </div>
                <div className="meta-box">
                  <small>File Size</small>
                  <strong>{inspectDoc.size}</strong>
                </div>
                <div className="meta-box">
                  <small>Uploaded Date</small>
                  <strong>{inspectDoc.date}</strong>
                </div>
                <div className="meta-box">
                  <small>Extracted Clauses</small>
                  <strong>{inspectDoc.clauseCount} clauses indexed</strong>
                </div>
              </div>

              <div className="modal-tech-box">
                <span className="section-kicker">STORAGE & VECTOR EMBEDDING ATTRIBUTES</span>
                <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                  <div>
                    <small style={{ color: '#77847a' }}>MinIO S3 Bucket URI:</small>
                    <code style={{ display: 'block', wordBreak: 'break-all', marginTop: 2 }}>
                      {inspectDoc.minioPath}
                    </code>
                  </div>
                  <div>
                    <small style={{ color: '#77847a' }}>Cryptographic Checksum:</small>
                    <code style={{ display: 'block', wordBreak: 'break-all', marginTop: 2 }}>
                      {inspectDoc.checksum}
                    </code>
                  </div>
                  <div>
                    <small style={{ color: '#77847a' }}>Governing Scope:</small>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: '#314136' }}>
                      {inspectDoc.governingScope}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-table-action"
                onClick={() => setInspectDoc(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="upload-action-btn-primary"
                onClick={() => {
                  setInspectDoc(null)
                  setActiveTab('search')
                  setSelectedProjectId(inspectDoc.projectId)
                }}
              >
                <Search size={14} /> Search Clauses in This Contract
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         MODAL 2: INSPECT CLAUSE FULL CONTEXT
         ========================================================================= */}
      {inspectClause && (
        <div className="modal-backdrop" onClick={() => setInspectClause(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="section-kicker">CONTRACT CLAUSE FULL LEGAL CONTEXT</span>
                <h3>{inspectClause.section_title || 'Contractual Section'}</h3>
                <small style={{ color: '#7a877e' }}>
                  {inspectClause.document_name || inspectClause.document_id}
                  {inspectClause.page_number && ` · Page ${inspectClause.page_number}`}
                </small>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setInspectClause(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-clause-quote">
                “{inspectClause.clause_text}”
              </div>

              {inspectClause.connection_rationale && (
                <div className="clause-rationale-box" style={{ marginTop: 14 }}>
                  <strong>Legal & Operational Rationale:</strong>
                  <p style={{ margin: '4px 0 0' }}>{inspectClause.connection_rationale}</p>
                </div>
              )}

              <div className="modal-tech-box" style={{ marginTop: 14 }}>
                <span className="section-kicker">VECTOR RETRIEVAL PROPERTIES</span>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#4d5d51' }}>
                  Indexed in PostgreSQL with pgvector extension using 1536-dimensional OpenAI vector embeddings.
                  Matched with similarity score of {(inspectClause.similarity_score * 100).toFixed(1)}% using cosine distance metric.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-clause-action"
                onClick={() => handleCopyCitation(inspectClause)}
              >
                {copiedId === inspectClause.clause_id ? (
                  <Check size={14} color="#27765f" />
                ) : (
                  <Copy size={14} />
                )}
                {copiedId === inspectClause.clause_id ? 'Copied Citation!' : 'Copy Citation'}
              </button>

              <button
                type="button"
                className="upload-action-btn-primary"
                onClick={() => setInspectClause(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


/* =========================================================================
   4. CONTRACTORS PAGE: Delivery Partner Performance Scorecard
   ========================================================================= */
export function ContractorsPage({ projects, onSelectProject }: PageProps) {
  const contractorGroups = useMemo(() => {
    const map = new Map<string, ProjectRecord[]>()
    for (const p of projects) {
      const list = map.get(p.contractor) || []
      list.push(p)
      map.set(p.contractor, list)
    }
    return Array.from(map.entries()).map(([contractor, list]) => ({
      contractor,
      projects: list,
      totalBudget: list.reduce((sum, p) => sum + Number(p.budget.replace(/[₹\sCr,]/g, '')), 0),
      avgProgress: Math.round(list.reduce((sum, p) => sum + p.progress, 0) / list.length),
      maxDelayRisk: Math.max(...list.map((p) => p.riskScoresAvailable ? p.delayRisk : 0)),
      status: list.some((p) => p.status === 'Action needed')
        ? 'Action needed'
        : list.some((p) => p.status === 'Watch closely')
        ? 'Watch closely'
        : 'On track',
    }))
  }, [projects])

  return (
    <div className="workspace-page-content">
      <section className="contractor-header-banner">
        <div>
          <span className="section-kicker">DELIVERY PARTNERS</span>
          <h2>Contractor Performance & Risk Scorecard</h2>
          <p>Track contractor progress, workforce capacity compliance, and governing contract liability clauses.</p>
        </div>
      </section>

      <div className="contractor-cards-grid">
        {contractorGroups.map((c) => (
          <article key={c.contractor} className="contractor-profile-card">
            <div className="contractor-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="contractor-icon-box"><UsersRound size={20} /></div>
                <div>
                  <h3>{c.contractor}</h3>
                  <small>{c.projects.map((p) => p.agency).join(' · ')}</small>
                </div>
              </div>
              <span className={`status-pill status-${c.status === 'Action needed' ? 'coral' : c.status === 'Watch closely' ? 'gold' : 'green'}`}>
                <i /> {c.status}
              </span>
            </div>

            <div className="contractor-stats-row">
              <div className="stat-box">
                <small>Assigned Contracts</small>
                <strong>{c.projects.length}</strong>
              </div>
              <div className="stat-box">
                <small>Contract Value</small>
                <strong>₹{c.totalBudget.toFixed(1)} Cr</strong>
              </div>
              <div className="stat-box">
                <small>Avg Progress</small>
                <strong>{c.avgProgress}%</strong>
              </div>
              <div className="stat-box">
                <small>Max Delay Risk</small>
                <strong className={c.maxDelayRisk >= 65 ? 'risk-high' : c.maxDelayRisk >= 40 ? 'risk-mid' : 'risk-low'}>
                  {c.maxDelayRisk}%
                </strong>
              </div>
            </div>

            <div className="contractor-assigned-section">
              <span className="section-kicker">MONITORED PROJECTS & CLAUSES</span>
              {c.projects.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className="contractor-project-item"
                  onClick={() => onSelectProject(p)}
                >
                  <div>
                    <strong>{p.name}</strong>
                    <small style={{ display: 'block', color: '#88938a' }}>{p.id} · Due {p.due}</small>
                  </div>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

/* =========================================================================
   5. BUDGET & SPEND PAGE: Financial Commitments, Burn Velocity & Exposure
   ========================================================================= */
export function BudgetPage({ projects, onSelectProject }: PageProps) {
  const budgetRows = useMemo(() => {
    return projects.map((p) => ({
      name: p.name,
      shortName: p.name.length > 20 ? `${p.name.slice(0, 18)}...` : p.name,
      budget: Number(p.budget.replace(/[₹\sCr,]/g, '')),
      progress: p.progress,
      costRisk: p.costRisk,
      delayRisk: p.delayRisk,
      project: p,
    }))
  }, [projects])

  const totalCommitted = useMemo(() => {
    return budgetRows.reduce((sum, r) => sum + r.budget, 0)
  }, [budgetRows])

  const totalSpentEst = useMemo(() => {
    return budgetRows.reduce((sum, r) => sum + (r.budget * (r.progress / 100)), 0)
  }, [budgetRows])

  const highCostRiskCount = projects.filter((p) => p.riskScoresAvailable && p.costRisk >= 40).length

  return (
    <div className="workspace-page-content">
      {/* Financial Summary Cards */}
      <section className="budget-kpi-row">
        <article className="budget-kpi-card">
          <div className="kpi-icon-wrap blue-wrap"><Wallet size={18} /></div>
          <div>
            <span className="section-kicker">TOTAL COMMITTED BUDGET</span>
            <strong>₹{totalCommitted.toFixed(2)} Cr</strong>
            <small>Across {projects.length} active infrastructure contracts</small>
          </div>
        </article>

        <article className="budget-kpi-card">
          <div className="kpi-icon-wrap green-wrap"><CircleDollarSign size={18} /></div>
          <div>
            <span className="section-kicker">ESTIMATED SPEND TO DATE</span>
            <strong>₹{totalSpentEst.toFixed(2)} Cr</strong>
            <small>Calculated from physical progress</small>
          </div>
        </article>

        <article className="budget-kpi-card">
          <div className="kpi-icon-wrap red-wrap"><TrendingUp size={18} /></div>
          <div>
            <span className="section-kicker">COST RISK ITEMS</span>
            <strong className="kpi-red">{highCostRiskCount} Projects</strong>
            <small>Subject to material escalation clauses</small>
          </div>
        </article>
      </section>

      {/* Chart Section */}
      <section className="workspace-panel">
        <div className="workspace-panel-heading">
          <div>
            <span className="section-kicker">COMMITTED BUDGET BY CONTRACT</span>
            <h2>Contract Value & Budget Commitments</h2>
            <p>Committed values in Indian Rupee Crores (INR Cr) across active infrastructure contracts.</p>
          </div>
        </div>

        <div style={{ height: 260, padding: '0 20px 15px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={budgetRows} layout="vertical" margin={{ top: 5, right: 25, left: 10, bottom: 0 }}>
              <CartesianGrid stroke="#e9ece7" strokeDasharray="3 5" horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#77847a', fontSize: 10 }} tickFormatter={(val) => `₹${val} Cr`} />
              <YAxis type="category" dataKey="shortName" width={160} axisLine={false} tickLine={false} tick={{ fill: '#4e5c52', fontSize: 10 }} />
              <Tooltip formatter={(value) => [`₹${Number(value).toFixed(2)} Cr`, 'Committed Budget']} contentStyle={{ border: '1px solid #e6e9e3', borderRadius: 7, fontSize: 11 }} />
              <Bar dataKey="budget" fill="#27765f" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Cost Risk & Escalation Clauses Table */}
      <section className="workspace-panel">
        <div className="workspace-panel-heading">
          <div>
            <span className="section-kicker">FINANCIAL RISK AUDIT</span>
            <h2>Cost Overrun & Escalation Clause Exposure</h2>
          </div>
        </div>

        <div className="workspace-table-scroll">
          <table className="workspace-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Committed Budget</th>
                <th>Physical Progress</th>
                <th>Cost Risk Score</th>
                <th>Governing Financial Clause</th>
                <th aria-label="Action" />
              </tr>
            </thead>
            <tbody>
              {budgetRows.map((row) => (
                <tr key={row.project.id} onClick={() => onSelectProject(row.project)}>
                  <td>
                    <strong>{row.name}</strong>
                    <small style={{ display: 'block', color: '#88938a' }}>{row.project.id}</small>
                  </td>
                  <td className="workspace-budget">₹{row.budget.toFixed(2)} Cr</td>
                  <td>{row.progress}%</td>
                  <td>
                    <span className={`workspace-risk ${row.project.riskScoresAvailable ? row.costRisk >= 65 ? 'risk-high' : row.costRisk >= 40 ? 'risk-mid' : 'risk-low' : ''}`}>
                      {row.project.riskScoresAvailable ? `${row.costRisk}%` : '—'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 10, color: '#4d5c52' }}>
                      {row.project.id === 'CP-1932' && 'Section 6.3: ENR Steel Index 60/40 Cost Sharing'}
                      {row.project.id === 'CP-1764' && 'Section 15.3: Monthly 115% Burn Rate Audit Cap'}
                      {row.project.id === 'CP-2048' && 'Section 8.4: Staffing Deficit $12,500/day Liquidated Damages'}
                      {row.project.id === 'CP-1876' && 'Section 22.1: 72-Hour LEED Systems Commissioning'}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="text-link">
                      Open Brief <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

/* =========================================================================
   6. HELP CENTER PAGE: Evaluation Walkthrough & Architecture Reference
   ========================================================================= */
export function HelpPage({ onGoToProjects }: Pick<PageProps, 'onGoToProjects'>) {
  return (
    <div className="workspace-page-content">
      <section className="workspace-panel help-panel">
        <span className="section-kicker">ACADEMIC EVALUATION & SYSTEM WALKTHROUGH</span>
        <h2>ContractPulse AI Platform Reference</h2>
        <p>
          ContractPulse AI bridges machine learning risk models with legally binding contract evidence.
          This guide explains the end-to-end architecture and evaluation steps for reviewers.
        </p>

        <div className="help-steps">
          <div className="eval-step-box">
            <span>01</span>
            <strong>Portfolio Overview & Risk Signals</strong>
            <small>Inspect high-risk contracts, milestone schedules, and progress variances across active public infrastructure works.</small>
          </div>
          <div className="eval-step-box">
            <span>02</span>
            <strong>ML Risk-to-Evidence Connection</strong>
            <small>Open any project brief to see predicted risks automatically mapped to contract clauses using pgvector cosine distance search.</small>
          </div>
          <div className="eval-step-box">
            <span>03</span>
            <strong>Document Intelligence (RAG)</strong>
            <small>Navigate to Documents to perform semantic vector searches across contracts and review extracted legal clauses.</small>
          </div>
          <div className="eval-step-box">
            <span>04</span>
            <strong>Human-in-the-Loop Decisions</strong>
            <small>Approve or dismiss AI recommendations with recorded decision logging in the audit trail.</small>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button className="help-primary-action" type="button" onClick={onGoToProjects}>
            Explore Portfolio <ArrowRight size={15} />
          </button>
        </div>
      </section>
    </div>
  )
}
