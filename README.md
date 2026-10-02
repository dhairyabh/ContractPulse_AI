# ContractPulse AI

ContractPulse AI is a frontend-only portfolio dashboard for post-award public infrastructure contract monitoring. It presents schedule and cost risk, model explanations, source evidence, and human-reviewed recommendations. All project data in this evaluation build is local demo data; no backend or authentication is connected.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Vite prints the local URL after startup. Create a production build with `npm run build`; run the configured linter with `npm run lint`.

## Dashboard workflows

- Monitor portfolio totals, project progress, schedule signals, and forecasted progress.
- Search and filter the project table; open a project's risk brief from its row or priority signal.
- Review risk factors and their modeled impact alongside a supporting document excerpt.
- Approve or dismiss the recommended next step; approval is reflected in the client-side audit message.
- Open notifications, switch the forecast timeframe, and navigate the workspace sections.
- Use the responsive navigation and expandable search on mobile.

## Backend integration

The interface currently uses in-memory sample data in `src/App.tsx`. Replace these arrays and client-side state handlers with a typed API service when the Spring Boot backend is ready. Suggested resource groups are projects and milestones, risk assessments and contributing factors, documents and evidence passages, recommendations and approvals, notifications, and audit events. The approval UI is a demonstration only and does not persist decisions.