# Workspace Setup Checklist

- [x] Verify `.github/copilot-instructions.md` exists.
- [x] Clarify project requirements: React + TypeScript frontend for public infrastructure contract risk monitoring; Spring Boot backend will be added later.
- [x] Scaffold the project in the workspace root with Vite.
- [x] Customize the starter into the ContractPulse AI portfolio dashboard.
- [x] Install required extensions: none were specified by the setup information.
- [x] Compile the project: `npm run build` succeeds.
- [x] Create and run a VS Code task: not needed; the Vite dev server is already running and `npm run dev` is documented.
- [x] Launch the project: Vite is running at `http://localhost:5173/`.
- [x] Ensure documentation is complete: README and these workspace instructions describe current behavior and setup.

## Project Guidance

- Keep this project frontend-only until the Spring Boot API is provided. Do not invent API routes or credentials.
- Current project, forecast, risk, document, and recommendation content is illustrative in-memory demo data in `src/App.tsx`.
- Keep risk factors explainable and show their supporting evidence near recommendations. Approval is a client-side demonstration and must not be described as persisted.
- Preserve the responsive portfolio dashboard, accessible controls, and current green, neutral, and warm risk-status palette.
- Validate UI changes with `npm run build`; use `npm run lint` for lint checks.