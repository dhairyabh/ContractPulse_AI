import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileSearch,
  FileText,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Sparkles,
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
import './App.css'

const projects = [
  {
    id: 'CP-2048',
    name: 'East River Flood Barrier',
    agency: 'New York City DOT',
    contractor: 'Granite Construction',
    budget: '$184.6M',
    progress: 62,
    delayRisk: 78,
    costRisk: 64,
    status: 'Action needed',
    color: 'coral',
    initials: 'ER',
    milestone: 'Foundation completion',
    due: 'Oct 18, 2026',
  },
  {
    id: 'CP-1932',
    name: 'I-405 Sound Wall Expansion',
    agency: 'Washington State DOT',
    contractor: 'Kiewit Infrastructure',
    budget: '$92.3M',
    progress: 44,
    delayRisk: 56,
    costRisk: 38,
    status: 'Watch closely',
    color: 'gold',
    initials: 'I4',
    milestone: 'North corridor paving',
    due: 'Nov 02, 2026',
  },
  {
    id: 'CP-1876',
    name: 'Civic Center Modernization',
    agency: 'City of San Francisco',
    contractor: 'Turner Construction',
    budget: '$67.8M',
    progress: 81,
    delayRisk: 22,
    costRisk: 19,
    status: 'On track',
    color: 'green',
    initials: 'CC',
    milestone: 'Systems commissioning',
    due: 'Oct 29, 2026',
  },
  {
    id: 'CP-1764',
    name: 'South County Water Main',
    agency: 'King County Public Works',
    contractor: 'Michels Corporation',
    budget: '$38.1M',
    progress: 36,
    delayRisk: 34,
    costRisk: 47,
    status: 'Watch closely',
    color: 'gold',
    initials: 'SW',
    milestone: 'Pressure testing',
    due: 'Dec 11, 2026',
  },
]

const forecast = [
  { month: 'Jan', baseline: 26, projected: 25 },
  { month: 'Feb', baseline: 32, projected: 31 },
  { month: 'Mar', baseline: 39, projected: 36 },
  { month: 'Apr', baseline: 46, projected: 44 },
  { month: 'May', baseline: 54, projected: 61 },
  { month: 'Jun', baseline: 61, projected: 76 },
  { month: 'Jul', baseline: 69, projected: 88 },
]

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Projects', icon: BriefcaseBusiness, count: '12' },
  { label: 'Risk signals', icon: Activity, count: '6' },
  { label: 'Documents', icon: FileSearch },
  { label: 'Contractors', icon: UsersRound },
  { label: 'Budget & spend', icon: Wallet },
]

type Project = (typeof projects)[number]

function App() {
  const [activePage, setActivePage] = useState('Overview')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [approved, setApproved] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [timeframe, setTimeframe] = useState('6 months')

  const visibleProjects = useMemo(
    () => projects.filter((project) =>
      `${project.name} ${project.agency} ${project.contractor}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
    [search],
  )

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
            <label className={`search-box ${searchOpen ? 'search-open' : ''}`} onClick={() => setSearchOpen(true)}><Search size={16} /><input aria-label="Search projects" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false) }} placeholder="Search anything..." /><kbd>⌘ K</kbd></label>
            <div className="notification-wrap">
              <button className="icon-button notification-button" type="button" aria-label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={18} /><span className="notification-dot" /></button>
              {notificationsOpen && <div className="notification-popover"><div className="popover-heading"><strong>Notifications</strong><span>3 new</span></div><div className="notification-item"><span className="notice-icon notice-red"><Activity size={15} /></span><p><strong>Delay risk increased</strong><small>East River Flood Barrier · 18 min ago</small></p></div><div className="notification-item"><span className="notice-icon notice-gold"><FileText size={15} /></span><p><strong>New document analyzed</strong><small>Weekly field report · 1 hr ago</small></p></div><div className="notification-item"><span className="notice-icon notice-green"><Check size={15} /></span><p><strong>Recommendation approved</strong><small>I-405 Sound Wall · Yesterday</small></p></div></div>}
            </div>
            <div className="topbar-avatar">JM</div>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="page-intro">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />FRIDAY, OCTOBER 02, 2026 <span className="eyebrow-divider">·</span> WEEK 40</div>
              <h1>{activePage === 'Overview' ? 'Good morning, Jordan' : activePage}</h1>
              <p className="intro-subtitle">Here’s what’s moving across your infrastructure portfolio.</p>
            </div>
            <button className="date-button" type="button"><Clock3 size={15} /> Last 30 days <ChevronDown size={14} /></button>
          </section>

          <section className="metrics-grid" aria-label="Portfolio summary">
            <article className="metric-card"><div className="metric-top"><span>ACTIVE PROJECTS</span><span className="metric-icon metric-icon-green"><BriefcaseBusiness size={16} /></span></div><div className="metric-value">12 <span className="metric-change positive"><ArrowUpRight size={14} /> 2</span></div><div className="metric-foot"><span>Across 8 agencies</span><span className="metric-trend">vs. last quarter</span></div></article>
            <article className="metric-card"><div className="metric-top"><span>AT-RISK PROJECTS</span><span className="metric-icon metric-icon-red"><Activity size={16} /></span></div><div className="metric-value">03 <span className="metric-change negative"><ArrowUpRight size={14} /> 1</span></div><div className="metric-foot"><span>Require your attention</span><span className="metric-trend">of 12 active</span></div></article>
            <article className="metric-card"><div className="metric-top"><span>PORTFOLIO VALUE</span><span className="metric-icon metric-icon-blue"><Wallet size={16} /></span></div><div className="metric-value">$842.6<span className="metric-unit">M</span> <span className="metric-change positive"><ArrowUpRight size={14} /> 4.2%</span></div><div className="metric-foot"><span>Total committed budget</span><span className="metric-trend">year over year</span></div></article>
            <article className="metric-card"><div className="metric-top"><span>FORECAST ACCURACY</span><span className="metric-icon metric-icon-gold"><Sparkles size={16} /></span></div><div className="metric-value">91.4<span className="metric-unit">%</span> <span className="metric-change positive"><ArrowUpRight size={14} /> 2.8%</span></div><div className="metric-foot"><span>Model confidence</span><span className="metric-trend">last 90 days</span></div></article>
          </section>

          <section className="insight-strip"><div className="insight-icon"><Sparkles size={17} /></div><p><strong>Portfolio insight</strong><span>3 projects show early signals of schedule slippage. Proactive action could protect <b>$12.4M</b> in committed value.</span></p><button type="button" onClick={() => setActivePage('Risk signals')}>Review signals <ArrowRight size={15} /></button></section>

          <section className="middle-grid">
            <article className="panel forecast-panel">
              <div className="panel-heading"><div><div className="section-kicker">PORTFOLIO HEALTH</div><h2>Schedule performance</h2></div><button className="select-button" type="button" onClick={() => setTimeframe(timeframe === '6 months' ? '12 months' : '6 months')}>{timeframe}<ChevronDown size={14} /></button></div>
              <div className="chart-summary"><strong>76<span>%</span></strong><span className="chart-summary-copy"><span className="chart-change"><ArrowDownRight size={14} /> 8.2%</span> projects tracking to plan</span></div>
              <div className="chart-legend"><span><i className="legend-dot legend-actual" /> Forecasted progress</span><span><i className="legend-dot legend-baseline" /> Planned progress</span></div>
              <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={forecast} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><defs><linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#27765f" stopOpacity={0.17} /><stop offset="100%" stopColor="#27765f" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#e9ece7" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8b918c', fontSize: 11 }} dy={9} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b918c', fontSize: 10 }} tickFormatter={(value: number) => `${value}%`} /><Tooltip contentStyle={{ border: '1px solid #e6e9e3', borderRadius: 8, fontSize: 12 }} /><Area type="monotone" dataKey="baseline" stroke="#bbc4bd" strokeWidth={1.5} strokeDasharray="5 5" fill="none" name="Planned progress" /><Area type="monotone" dataKey="projected" stroke="#27765f" strokeWidth={2.5} fill="url(#progressFill)" name="Forecasted progress" /></AreaChart></ResponsiveContainer></div>
            </article>

            <article className="panel signal-panel">
              <div className="panel-heading"><div><div className="section-kicker">NEEDS YOUR ATTENTION</div><h2>Priority signals <span className="heading-count">03</span></h2></div><button className="text-link" type="button" onClick={() => setActivePage('Risk signals')}>View all <ArrowRight size={14} /></button></div>
              <div className="signal-list">
                <button className="signal-row" type="button" onClick={() => setSelectedProject(projects[0])}><span className="signal-severity severity-high" /><span className="signal-copy"><strong>Schedule slippage likely</strong><small>East River Flood Barrier <i>·</i> 2h ago</small></span><span className="signal-score">78<span>%</span></span><ArrowRight className="signal-arrow" size={15} /></button>
                <button className="signal-row" type="button" onClick={() => setSelectedProject(projects[1])}><span className="signal-severity severity-medium" /><span className="signal-copy"><strong>Material cost variance</strong><small>I-405 Sound Wall Expansion <i>·</i> 5h ago</small></span><span className="signal-score score-medium">56<span>%</span></span><ArrowRight className="signal-arrow" size={15} /></button>
                <button className="signal-row" type="button" onClick={() => setSelectedProject(projects[3])}><span className="signal-severity severity-medium" /><span className="signal-copy"><strong>Budget burn ahead of plan</strong><small>South County Water Main <i>·</i> Yesterday</small></span><span className="signal-score score-medium">47<span>%</span></span><ArrowRight className="signal-arrow" size={15} /></button>
              </div>
              <div className="signal-footer"><ShieldCheck size={14} /><span>Signals reviewed by AI · Updated 12 min ago</span></div>
            </article>
          </section>

          <section className="panel projects-panel">
            <div className="panel-heading projects-heading"><div><div className="section-kicker">PORTFOLIO MONITOR</div><h2>Project performance <span className="heading-count">12</span></h2></div><div className="project-actions"><button className="filter-button" type="button" onClick={() => setSearch(search ? '' : 'East')}><Activity size={14} /> Filter</button><button className="text-link" type="button" onClick={() => setActivePage('Projects')}>All projects <ArrowRight size={14} /></button></div></div>
            <div className="table-scroll"><table className="project-table"><thead><tr><th>PROJECT</th><th>CONTRACTOR</th><th>BUDGET</th><th>PROGRESS</th><th>DELAY RISK</th><th>COST RISK</th><th>STATUS</th><th aria-label="Actions" /></tr></thead><tbody>{visibleProjects.map((project) => <tr key={project.id} onClick={() => setSelectedProject(project)}><td><div className="project-name-cell"><span className={`project-avatar project-${project.color}`}>{project.initials}</span><span><strong>{project.name}</strong><small>{project.id} <i>·</i> {project.agency}</small></span></div></td><td className="contractor-cell">{project.contractor}</td><td className="budget-cell">{project.budget}</td><td><div className="progress-cell"><div className="progress-track"><span style={{ width: `${project.progress}%` }} /></div><small>{project.progress}%</small></div></td><td><div className="risk-cell"><span className={`risk-number ${project.delayRisk >= 65 ? 'risk-high' : project.delayRisk >= 40 ? 'risk-mid' : 'risk-low'}`}>{project.delayRisk}%</span><div className="risk-track"><span className={project.delayRisk >= 65 ? 'track-high' : project.delayRisk >= 40 ? 'track-mid' : 'track-low'} style={{ width: `${project.delayRisk}%` }} /></div></div></td><td><div className="risk-cell"><span className={`risk-number ${project.costRisk >= 65 ? 'risk-high' : project.costRisk >= 40 ? 'risk-mid' : 'risk-low'}`}>{project.costRisk}%</span><div className="risk-track"><span className={project.costRisk >= 65 ? 'track-high' : project.costRisk >= 40 ? 'track-mid' : 'track-low'} style={{ width: `${project.costRisk}%` }} /></div></div></td><td><span className={`status-pill status-${project.color}`}><i />{project.status}</span></td><td><button className="row-more" type="button" aria-label={`Open ${project.name}`} onClick={(event) => { event.stopPropagation(); setSelectedProject(project) }}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table>{visibleProjects.length === 0 && <div className="empty-results">No projects match “{search}”.</div>}</div>
            <div className="table-footer"><span>Showing <strong>{visibleProjects.length}</strong> of <strong>12</strong> projects</span><button type="button" onClick={() => setActivePage('Projects')}>View portfolio <ArrowRight size={14} /></button></div>
          </section>

          <footer className="dashboard-footer"><span><span className="live-dot" /> Live portfolio data <i>·</i> Last synced 12 minutes ago</span><span>ContractPulse AI <i>·</i> Decision support, with you in control</span></footer>
        </div>
      </main>

      {selectedProject && <div className="drawer-backdrop" onClick={() => setSelectedProject(null)}><aside className="project-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-top"><span className="drawer-label">PROJECT RISK BRIEF</span><button className="icon-button" type="button" aria-label="Close details" onClick={() => setSelectedProject(null)}><X size={19} /></button></div><div className="drawer-project"><span className={`project-avatar project-${selectedProject.color}`}>{selectedProject.initials}</span><div><span className="drawer-id">{selectedProject.id} <i>·</i> {selectedProject.agency}</span><h2>{selectedProject.name}</h2></div></div><div className="drawer-risk-summary"><div className="risk-dial"><strong>{selectedProject.delayRisk}<span>%</span></strong><small>delay likelihood</small></div><div><span className={`status-pill status-${selectedProject.color}`}><i />{selectedProject.status}</span><p>Cost overrun risk <strong>{selectedProject.costRisk}%</strong></p><p>Model confidence <strong>91%</strong></p><small>Updated 12 minutes ago</small></div></div><div className="drawer-section"><div className="section-kicker">UPCOMING MILESTONE</div><div className="factor-row"><span className="factor-rank"><Clock3 size={13} /></span><span><strong>{selectedProject.milestone}</strong><small>Due {selectedProject.due}</small></span></div></div><div className="drawer-section"><div className="section-kicker">WHY THIS PROJECT IS AT RISK</div><div className="factor-row"><span className="factor-rank">01</span><span><strong>Permit approval lag</strong><small>Environmental review is 23 days behind baseline</small></span><b className="factor-impact">+31%</b></div><div className="factor-row"><span className="factor-rank">02</span><span><strong>Subcontractor capacity</strong><small>Two specialist crews below planned staffing</small></span><b className="factor-impact">+24%</b></div><div className="factor-row"><span className="factor-rank">03</span><span><strong>Weather exposure</strong><small>Seasonal rainfall impacts foundation window</small></span><b className="factor-impact">+16%</b></div></div><div className="evidence-card"><div className="evidence-icon"><FileText size={17} /></div><div><div className="section-kicker">SUPPORTING EVIDENCE</div><strong>Weekly field report · October 1</strong><p>“Permit review remains outstanding. Foundation work cannot proceed until environmental clearance is received.”</p><button type="button">View source document <ArrowRight size={13} /></button></div></div><div className="recommendation-card">
  {dismissed ? (
    <div className="dismissed-card">
      <div><X size={16} /><strong>Recommendation dismissed</strong></div>
      <p>This recommendation was dismissed. The decision is recorded in the audit trail.</p>
    </div>
  ) : (
    <div className="recommendation-card">
      <div className="recommendation-title"><Sparkles size={16} /><strong>Recommended next step</strong></div>
      <p>Schedule an agency coordination meeting to resolve permit blockers before the October 18 milestone.</p>
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
<p className="audit-note"><ShieldCheck size={13} /> {dismissed ? 'Dismissal recorded in the audit trail.' : 'Your decision is recorded in the audit trail.'}</p></aside></div>}
    </div>
  )
}

export default App
