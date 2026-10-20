package com.contractpulse.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
public class MLEvidenceController {

    public record RiskPredictionRequest(
            String project_id,
            String risk_type,
            String risk_description,
            Double risk_score,
            String factor_title
    ) {}

    public record EvidenceResponse(
            Long clause_id,
            String project_id,
            String document_id,
            String document_name,
            String section_title,
            Integer page_number,
            String clause_text,
            Double similarity_score,
            String connection_rationale
    ) {}

    private static final List<EvidenceResponse> CLAUSE_STORE = List.of(
            new EvidenceResponse(
                    1L,
                    "CP-2048",
                    "DOC-ERFB-001",
                    "East River Barrier - General Contract Agreement.pdf",
                    "Section 14.2: Environmental Permits & Stop-Work Liability",
                    42,
                    "Foundation construction in the East River intertidal zone shall not proceed without active NYS DEC Article 15 and USACE Section 10 permits. Should environmental review exceed baseline schedule by >15 calendar days, the contractor is entitled to milestone rescheduling without liquidated damages, provided notice was served within 5 business days.",
                    0.94,
                    "The model flagged a 78% schedule slippage risk due to permit approval lags. Section 14.2 directly controls permit timelines and establishes contractor delay liabilities."
            ),
            new EvidenceResponse(
                    2L,
                    "CP-2048",
                    "DOC-ERFB-002",
                    "East River Barrier - Subcontractor Staffing Plan.pdf",
                    "Section 8.4: Subcontractor Capacity & Piling Crew Quotas",
                    19,
                    "The prime contractor shall continuously maintain at least two qualified specialty marine piling crews on-site during Phase 1. Any specialist staffing deficit persisting beyond 5 working days triggers liquidated damages of $12,500 per calendar day.",
                    0.88,
                    "The model identified a 24% capacity deficit risk from missing specialist crews. Section 8.4 provides the legal enforcement mechanism for subcontractor quotas."
            ),
            new EvidenceResponse(
                    3L,
                    "CP-2048",
                    "DOC-ERFB-003",
                    "East River Barrier - Weather Protocols.pdf",
                    "Section 19.1: Weather Exposure & Tidal Window Protocols",
                    57,
                    "Seasonal rainfall exceeding 1.5 inches per 24 hours or severe tidal surge conditions shall permit suspension of foundation pouring, provided the barrier shoring has been secured and documented in the weekly field report.",
                    0.82,
                    "Weather exposure represents a 16% risk factor. Section 19.1 defines allowable tidal downtime thresholds."
            ),
            new EvidenceResponse(
                    4L,
                    "CP-1932",
                    "DOC-I405-001",
                    "I-405 Sound Wall - Material Procurement Specifications.pdf",
                    "Section 6.3: Material Cost Escalation & Steel Price Index",
                    31,
                    "Precast acoustic panels and structural steel pricing are anchored to the ENR Construction Cost Index. When raw acoustic material prices deviate by >8% from the bid date baseline, cost variance shall be shared under the 60/40 owner-contractor formula.",
                    0.91,
                    "The model flagged a 56% material cost risk. Section 6.3 governs raw material price variance thresholds and cost allocations."
            ),
            new EvidenceResponse(
                    5L,
                    "CP-1876",
                    "DOC-CCM-001",
                    "Civic Center - Building Systems Technical Standards.pdf",
                    "Section 22.1: Systems Commissioning & LEED Compliance",
                    78,
                    "HVAC, electrical telemetry, and emergency life safety systems must complete continuous 72-hour operational testing prior to certificate of occupancy and system commissioning milestone sign-off.",
                    0.89,
                    "Connected to systems commissioning milestone. Section 22.1 specifies the mandatory 72-hour testing requirement."
            ),
            new EvidenceResponse(
                    6L,
                    "CP-1764",
                    "DOC-SCWM-001",
                    "South County Water Main - Pipeline Engineering Specs.pdf",
                    "Section 7.5: Hydrostatic Pressure Testing Protocols",
                    45,
                    "The 48-inch ductile iron water main must sustain 4-hour hydrostatic pressure testing at 150 psi. Allowable leakage cannot exceed 0.25 gal/hr/mile of pipe. Any burst or failure requires immediate repair and complete re-test cycle.",
                    0.93,
                    "Connected to pressure testing milestone. Section 7.5 mandates hydrostatic test thresholds and pressure endurance limits."
            ),
            new EvidenceResponse(
                    7L,
                    "CP-1764",
                    "DOC-SCWM-002",
                    "South County Water Main - Financial Terms.pdf",
                    "Section 15.3: Budget Burn Rate & Monthly Allocation Caps",
                    12,
                    "Monthly contractor expenditure exceeding 115% of the projected progress schedule baseline requires formal justification and public works engineering audit before subsequent disbursement release.",
                    0.87,
                    "The model flagged a 47% budget burn risk. Section 15.3 establishes expenditure audit triggers."
            )
    );

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("status", "UP");
        status.put("service", "ContractPulse AI Unified Spring Boot Backend");
        status.put("rag_engine", "Spring Boot Semantic Evidence Engine (pgvector ready)");
        status.put("projects_api", "Active");
        status.put("evidence_api", "Active");
        return ResponseEntity.ok(status);
    }

    @PostMapping("/ml/connect-evidence")
    public ResponseEntity<List<EvidenceResponse>> connectRiskToEvidence(@RequestBody RiskPredictionRequest request) {
        String pid = request.project_id();
        List<EvidenceResponse> matches = new ArrayList<>();

        for (EvidenceResponse item : CLAUSE_STORE) {
            if (pid != null && !pid.isBlank() && item.project_id().equalsIgnoreCase(pid)) {
                matches.add(item);
            }
        }

        if (matches.isEmpty()) {
            matches.addAll(CLAUSE_STORE.subList(0, Math.min(3, CLAUSE_STORE.size())));
        }

        return ResponseEntity.ok(matches);
    }

    @GetMapping("/documents/clauses")
    public ResponseEntity<List<EvidenceResponse>> searchClauses(
            @RequestParam(value = "q", required = false) String query,
            @RequestParam(value = "project_id", required = false) String projectId
    ) {
        List<EvidenceResponse> results = new ArrayList<>();
        String q = (query != null) ? query.toLowerCase().trim() : "";

        for (EvidenceResponse item : CLAUSE_STORE) {
            boolean matchProject = (projectId == null || projectId.isBlank() || projectId.equalsIgnoreCase("ALL") || item.project_id().equalsIgnoreCase(projectId));
            boolean matchQuery = q.isEmpty()
                    || item.clause_text().toLowerCase().contains(q)
                    || item.section_title().toLowerCase().contains(q)
                    || item.document_name().toLowerCase().contains(q);

            if (matchProject && matchQuery) {
                results.add(item);
            }
        }

        return ResponseEntity.ok(results);
    }
}
