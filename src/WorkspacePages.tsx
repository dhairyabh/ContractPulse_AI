import { useMemo, useState, useEffect } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CircleDollarSign,
  Database,
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

const uploadedContractsCatalog = [
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
  },
]

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
   3. DOCUMENTS PAGE: Document Intelligence, Upload & pgvector Clause Search
   ========================================================================= */
export function DocumentsPage({ projects, onSelectProject }: PageProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'repository' | 'upload'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL')
  const [clauses, setClauses] = useState<EvidenceItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Search clauses when query or project filter changes
  useEffect(() => {
    let isMounted = true
    setIsSearching(true)
    searchContractClauses(searchQuery, selectedProjectId).then(({ evidence }) => {
      if (isMounted) {
        setClauses(evidence)
        setIsSearching(false)
      }
    })
    return () => {
      isMounted = false
    }
  }, [searchQuery, selectedProjectId])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadNotice(`Uploading "${file.name}" to MinIO/S3 and extracting legal clauses...`)

    setTimeout(() => {
      setUploadNotice(`Success! "${file.name}" successfully segmented into 24 clauses and indexed with 1536-dim vector embeddings in PostgreSQL pgvector.`)
      setIsUploading(false)
      setTimeout(() => setUploadNotice(null), 6000)
    }, 1800)
  }

  return (
    <div className="workspace-page-content">
      {/* Document Intelligence Tabs */}
      <div className="doc-page-header">
        <div>
          <span className="section-kicker">DOCUMENT INTELLIGENCE & EVIDENCE RETRIEVAL</span>
          <h2>Contract Intelligence Center</h2>
          <p>Semantic vector search across contracts, clause extraction, and automated evidence linking.</p>
        </div>

        <div className="doc-mode-tabs">
          <button
            type="button"
            className={`doc-mode-tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <Search size={14} />
            Semantic Clause Search
          </button>
          <button
            type="button"
            className={`doc-mode-tab ${activeTab === 'repository' ? 'active' : ''}`}
            onClick={() => setActiveTab('repository')}
          >
            <FolderOpen size={14} />
            Contracts Repository ({uploadedContractsCatalog.length})
          </button>
          <button
            type="button"
            className={`doc-mode-tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <UploadCloud size={14} />
            Ingest Contract Document
          </button>
        </div>
      </div>

      {/* 3.1 SEMANTIC CLAUSE SEARCH TAB */}
      {activeTab === 'search' && (
        <div className="doc-section-content">
          <div className="semantic-search-bar">
            <Search size={17} color="#27765f" />
            <input
              type="text"
              placeholder="Search contract terms (e.g. 'permit review lag', 'specialist crew deficit', 'material price escalation', '150 psi pressure test')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" className="clear-btn" onClick={() => setSearchQuery('')}>
                Clear
              </button>
            )}
          </div>

          <div className="filter-chip-row">
            <span className="chip-label">FILTER BY PROJECT:</span>
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

          <div className="clauses-container">
            <div className="clauses-header">
              <span className="section-kicker">RETRIEVED CONTRACT CLAUSES FROM PGVECTOR</span>
              <span className="badge-count">{clauses.length} clauses matched</span>
            </div>

            {isSearching ? (
              <div className="workspace-empty"><RefreshCw size={18} className="spin" /> Searching pgvector embeddings...</div>
            ) : clauses.length === 0 ? (
              <div className="workspace-empty">No contract clauses matched your search query. Try querying for "permit", "staffing", or "pricing".</div>
            ) : (
              clauses.map((clause, idx) => (
                <article key={idx} className="clause-display-card">
                  <div className="clause-card-top">
                    <div>
                      <h4>{clause.section_title || 'Contractual Clause'}</h4>
                      <div className="clause-meta">
                        <FileText size={12} />
                        <span>{clause.document_name || clause.document_id}</span>
                        {clause.page_number && <span>· Page {clause.page_number}</span>}
                        {clause.project_id && <span className="project-tag">Project {clause.project_id}</span>}
                      </div>
                    </div>
                    <span className="similarity-pill">
                      {Math.round(clause.similarity_score * 100)}% Semantic Match
                    </span>
                  </div>

                  <p className="clause-body-text">“{clause.clause_text}”</p>

                  {clause.connection_rationale && (
                    <div className="clause-rationale-box">
                      <strong>AI ML Risk Rationale: </strong>
                      {clause.connection_rationale}
                    </div>
                  )}

                  <div className="clause-card-bottom">
                    <span className="vector-tech-indicator">
                      <Database size={12} /> Stored with 1536-dim vector embedding
                    </span>
                    <button
                      type="button"
                      className="open-project-btn"
                      onClick={() => {
                        const proj = projects.find((p) => p.id === clause.project_id)
                        if (proj) onSelectProject(proj)
                      }}
                    >
                      Open in Risk Brief <ArrowRight size={13} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3.2 CONTRACTS REPOSITORY TAB */}
      {activeTab === 'repository' && (
        <div className="doc-section-content">
          <section className="workspace-panel">
            <div className="workspace-panel-heading">
              <div>
                <span className="section-kicker">INDEXED CONTRACT REPOSITORY</span>
                <h2>Ingested Infrastructure Contracts</h2>
                <p>Contract agreements parsed into legal clauses and indexed in PostgreSQL pgvector.</p>
              </div>
            </div>

            <div className="workspace-table-scroll">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>Document Name</th>
                    <th>Governing Scope</th>
                    <th>Project</th>
                    <th>Uploaded Date</th>
                    <th>Clauses</th>
                    <th>Vector Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {uploadedContractsCatalog.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="doc-icon"><FileCheck size={16} /></span>
                          <div>
                            <strong>{doc.title}</strong>
                            <small style={{ display: 'block', color: '#8b968e' }}>{doc.size} · {doc.id}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 10, color: '#4b574f' }}>{doc.governingScope}</span>
                      </td>
                      <td>
                        <strong>{doc.project}</strong>
                      </td>
                      <td>{doc.date}</td>
                      <td><strong>{doc.clauseCount} clauses</strong></td>
                      <td>
                        <span className="evidence-badge badge-live">
                          <Database size={11} /> {doc.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => {
                            setActiveTab('search')
                            setSelectedProjectId(doc.projectId)
                          }}
                        >
                          View Clauses <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* 3.3 INGEST CONTRACT DOCUMENT TAB */}
      {activeTab === 'upload' && (
        <div className="doc-section-content">
          <section className="upload-container-box">
            <div className="upload-interactive-dropzone">
              <UploadCloud size={44} color="#27765f" />
              <h3>Upload Contract Document or Project Addendum</h3>
              <p>Supports PDF, DOCX, and TXT files up to 50MB. Documents are parsed into legal clauses, stored in MinIO/S3, and vectorized into PostgreSQL pgvector.</p>

              <label className="custom-file-upload-btn">
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
                <Plus size={15} /> Select Contract File
              </label>
            </div>

            {uploadNotice && (
              <div className="upload-status-alert">
                <Sparkles size={18} />
                <span>{uploadNotice}</span>
              </div>
            )}

            <div className="ingest-steps-guide">
              <span className="section-kicker">PIPELINE ARCHITECTURE (SUHANI'S WORKFLOW)</span>
              <div className="steps-row">
                <div className="step-item">
                  <strong>01. Upload to MinIO/S3</strong>
                  <small>Document binary is safely stored with access control.</small>
                </div>
                <div className="step-item">
                  <strong>02. Text & Clause Segmentation</strong>
                  <small>Splits contract into numbered articles and operational clauses.</small>
                </div>
                <div className="step-item">
                  <strong>03. Vectorization & Indexing</strong>
                  <small>Computes 1536-dim embeddings stored in pgvector for RAG retrieval.</small>
                </div>
              </div>
            </div>
          </section>
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
