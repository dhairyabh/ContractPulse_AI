package com.contractpulse.api;

import static com.contractpulse.api.ApiModels.MilestoneDto;
import static com.contractpulse.api.ApiModels.MilestoneRequest;
import static com.contractpulse.api.ApiModels.MlPredictionResult;
import static com.contractpulse.api.ApiModels.ProgressRequest;
import static com.contractpulse.api.ApiModels.ProgressSnapshotDto;
import static com.contractpulse.api.ApiModels.ProjectDto;
import static com.contractpulse.api.ApiModels.ProjectRequest;
import static com.contractpulse.api.ApiModels.ProjectRiskPredictionRequest;
import static com.contractpulse.api.ApiModels.RiskPredictionResponse;
import static com.contractpulse.api.ApiModels.StandaloneRiskPredictionRequest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProjectService {
    private static final DateTimeFormatter DISPLAY_DATE = DateTimeFormatter.ofPattern("MMM dd, yyyy");
    private static final List<String> MILESTONE_STATUSES = List.of("Not started", "In progress", "Complete");

    private final JdbcTemplate jdbc;
    private final MlRiskService mlRiskService;

    public ProjectService(JdbcTemplate jdbc, MlRiskService mlRiskService) {
        this.jdbc = jdbc;
        this.mlRiskService = mlRiskService;
    }

    public List<ProjectDto> getProjects() {
        return jdbc.queryForList("SELECT id FROM projects ORDER BY name")
                .stream()
                .map(row -> getProject((String) row.get("ID")))
                .toList();
    }

    public ProjectDto getProject(String id) {
        Map<String, Object> project = findProjectRow(id);
        List<ProgressSnapshotDto> history = getProgressHistory(id);
        ProgressSnapshotDto latest = history.isEmpty() ? null : history.get(history.size() - 1);
        List<MilestoneDto> milestones = getMilestones(id);
        MilestoneDto nextMilestone = milestones.stream()
                .filter(milestone -> !"Complete".equals(milestone.status()))
                .findFirst()
                .orElse(milestones.isEmpty() ? null : milestones.get(milestones.size() - 1));

        return new ProjectDto(
                id,
                (String) project.get("NAME"),
                (String) project.get("AGENCY"),
                (String) project.get("CONTRACTOR"),
                formatBudget((BigDecimal) project.get("BUDGET_CRORES")),
                latest == null ? 0 : latest.actual(),
                latest == null ? 0 : latest.planned(),
                latest == null ? "" : latest.date(),
                history,
                project.get("BASELINE_FINISH_DATE").toString(),
                project.get("FORECAST_FINISH_DATE").toString(),
                (Integer) project.get("DELAY_RISK"),
                (Integer) project.get("COST_RISK"),
                project.get("DELAY_RISK") != null && project.get("COST_RISK") != null,
                (String) project.get("STATUS"),
                (String) project.get("COLOR"),
                (String) project.get("INITIALS"),
                nextMilestone == null ? "No milestones" : nextMilestone.name(),
                nextMilestone == null ? "—" : LocalDate.parse(nextMilestone.plannedFinishDate()).format(DISPLAY_DATE),
                milestones
        );
    }

    @Transactional
    public ProjectDto createProject(ProjectRequest request) {
        String id = "CP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String initials = initials(request.name());
        jdbc.update("""
                INSERT INTO projects
                    (id, name, agency, contractor, budget_crores, baseline_finish_date,
                     forecast_finish_date, delay_risk, cost_risk, status, color, initials)
                VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'Pending risk review', 'gold', ?)
                """,
                id, request.name().trim(), request.agency().trim(), request.contractor().trim(),
                request.budgetCrores(), request.baselineFinishDate(), request.forecastFinishDate(), initials);
        insertMilestone(id, request.milestoneName(), request.milestoneDueDate(), null, null, "Not started");
        upsertProgress(id, new ProgressRequest(LocalDate.now(), request.plannedProgress(), request.progress()));
        return getProject(id);
    }

    @Transactional
    public ProjectDto updateProject(String id, ProjectRequest request) {
        requireProject(id);
        jdbc.update("""
                UPDATE projects SET name = ?, agency = ?, contractor = ?, budget_crores = ?,
                    baseline_finish_date = ?, forecast_finish_date = ?, status = 'Pending risk review',
                    color = 'gold', delay_risk = NULL, cost_risk = NULL, initials = ?
                WHERE id = ?
                """,
                request.name().trim(), request.agency().trim(), request.contractor().trim(),
                request.budgetCrores(), request.baselineFinishDate(), request.forecastFinishDate(),
                initials(request.name()), id);
        List<MilestoneDto> milestones = getMilestones(id);
        MilestoneDto nextMilestone = milestones.stream()
                .filter(milestone -> !"Complete".equals(milestone.status()))
                .findFirst()
                .orElse(milestones.isEmpty() ? null : milestones.get(0));
        if (nextMilestone == null) {
            insertMilestone(id, request.milestoneName(), request.milestoneDueDate(), null, null, "Not started");
        } else {
            jdbc.update("""
                    UPDATE milestones SET name = ?, planned_finish_date = ?
                    WHERE project_id = ? AND id = ?
                    """, request.milestoneName().trim(), request.milestoneDueDate(), id, nextMilestone.id());
        }
        upsertProgress(id, new ProgressRequest(LocalDate.now(), request.plannedProgress(), request.progress()));
        return getProject(id);
    }

    @Transactional
    public void deleteProject(String id) {
        requireProject(id);
        jdbc.update("DELETE FROM projects WHERE id = ?", id);
    }

    public List<ProgressSnapshotDto> getProgressHistory(String projectId) {
        requireProject(projectId);
        return jdbc.query("""
                SELECT id, snapshot_date, planned_progress, actual_progress
                FROM progress_snapshots WHERE project_id = ? ORDER BY snapshot_date
                """,
                (rs, rowNum) -> new ProgressSnapshotDto(
                        Long.toString(rs.getLong("id")),
                        rs.getDate("snapshot_date").toLocalDate().toString(),
                        rs.getInt("planned_progress"),
                        rs.getInt("actual_progress")),
                projectId);
    }

    @Transactional
    public ProjectDto addProgress(String projectId, ProgressRequest request) {
        requireProject(projectId);
        upsertProgress(projectId, request);
        return getProject(projectId);
    }

    @Transactional
    public ProjectDto updateProgress(String projectId, long snapshotId, ProgressRequest request) {
        requireProject(projectId);
        int changed = jdbc.update("""
                UPDATE progress_snapshots SET snapshot_date = ?, planned_progress = ?, actual_progress = ?
                WHERE project_id = ? AND id = ?
                """, request.date(), request.planned(), request.actual(), projectId, snapshotId);
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Progress snapshot not found");
        return getProject(projectId);
    }

    @Transactional
    public ProjectDto deleteProgress(String projectId, long snapshotId) {
        requireProject(projectId);
        int changed = jdbc.update("DELETE FROM progress_snapshots WHERE project_id = ? AND id = ?", projectId, snapshotId);
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Progress snapshot not found");
        return getProject(projectId);
    }

    public List<MilestoneDto> getMilestones(String projectId) {
        return jdbc.query("""
                SELECT id, name, planned_finish_date, forecast_finish_date, actual_finish_date, status
                FROM milestones WHERE project_id = ? ORDER BY planned_finish_date
                """,
                (rs, rowNum) -> new MilestoneDto(
                        rs.getString("id"),
                        rs.getString("name"),
                        rs.getDate("planned_finish_date").toLocalDate().toString(),
                        dateString(rs.getDate("forecast_finish_date")),
                        dateString(rs.getDate("actual_finish_date")),
                        rs.getString("status")),
                projectId);
    }

    @Transactional
    public ProjectDto addMilestone(String projectId, MilestoneRequest request) {
        requireProject(projectId);
        validateMilestoneStatus(request.status());
        insertMilestone(projectId, request.name().trim(), request.plannedFinishDate(),
                request.forecastFinishDate(), request.actualFinishDate(), request.status());
        return getProject(projectId);
    }

    @Transactional
    public ProjectDto updateMilestone(String projectId, String milestoneId, MilestoneRequest request) {
        requireProject(projectId);
        validateMilestoneStatus(request.status());
        int changed = jdbc.update("""
                UPDATE milestones SET name = ?, planned_finish_date = ?, forecast_finish_date = ?,
                    actual_finish_date = ?, status = ?
                WHERE project_id = ? AND id = ?
                """, request.name().trim(), request.plannedFinishDate(), request.forecastFinishDate(),
                request.actualFinishDate(), request.status(), projectId, milestoneId);
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Milestone not found");
        return getProject(projectId);
    }

    @Transactional
    public ProjectDto deleteMilestone(String projectId, String milestoneId) {
        requireProject(projectId);
        int changed = jdbc.update("DELETE FROM milestones WHERE project_id = ? AND id = ?", projectId, milestoneId);
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Milestone not found");
        return getProject(projectId);
    }

    @Transactional
    public RiskPredictionResponse predictProjectRisk(String projectId, ProjectRiskPredictionRequest request) {
        Map<String, Object> projectRow = findProjectRow(projectId);

        // 1. Map compatible project fields
        // Budget in crores: matches budget_crores in Crores
        Double budgetCrores = null;
        if (request != null && request.budgetCrores() != null) {
            budgetCrores = request.budgetCrores();
        } else if (projectRow.get("BUDGET_CRORES") != null) {
            budgetCrores = ((BigDecimal) projectRow.get("BUDGET_CRORES")).doubleValue();
        }

        // Progress variance: actual % - planned % (percentage points)
        Double progressVariance = null;
        if (request != null && request.progressVariance() != null) {
            progressVariance = request.progressVariance();
        } else {
            List<ProgressSnapshotDto> history = getProgressHistory(projectId);
            if (!history.isEmpty()) {
                ProgressSnapshotDto latest = history.get(history.size() - 1);
                progressVariance = (double) (latest.actual() - latest.planned());
            }
        }

        // Milestone delay days: can be specified or derived from next active milestone
        Integer milestoneDelayDays = null;
        if (request != null && request.milestoneDelayDays() != null) {
            milestoneDelayDays = request.milestoneDelayDays();
        } else {
            List<MilestoneDto> milestones = getMilestones(projectId);
            MilestoneDto activeMilestone = milestones.stream()
                    .filter(m -> !"Complete".equals(m.status()))
                    .findFirst()
                    .orElse(milestones.isEmpty() ? null : milestones.get(milestones.size() - 1));

            if (activeMilestone != null) {
                String targetDateStr = activeMilestone.actualFinishDate() != null
                        ? activeMilestone.actualFinishDate()
                        : activeMilestone.forecastFinishDate();
                if (targetDateStr != null && activeMilestone.plannedFinishDate() != null) {
                    long delay = ChronoUnit.DAYS.between(
                            LocalDate.parse(activeMilestone.plannedFinishDate()),
                            LocalDate.parse(targetDateStr)
                    );
                    milestoneDelayDays = (int) Math.max(0, delay);
                }
            }
        }

        // Planned duration days: NOT available in database (database stores finish dates, not project start date).
        // Must never be silently fabricated or zeroed out.
        Integer plannedDurationDays = request != null ? request.plannedDurationDays() : null;

        // Schedule variance: In ML training, schedule_variance is DEFINED AS:
        // (milestone_delay_days / planned_duration_days) * 100  (a PERCENTAGE, not days!).
        // Schedule variance days (forecast finish - baseline finish) must NOT be mapped as a percentage.
        Double scheduleVariance = null;
        if (request != null && request.scheduleVariance() != null) {
            scheduleVariance = request.scheduleVariance();
        } else if (milestoneDelayDays != null && plannedDurationDays != null && plannedDurationDays > 0) {
            scheduleVariance = (milestoneDelayDays / (double) plannedDurationDays) * 100.0;
        }

        // Operational features: Cannot be inferred from unrelated fields.
        // Must be explicitly supplied; never silently replaced with zero or fabricated values.
        Double paymentProgressRatio = request != null ? request.paymentProgressRatio() : null;
        Double changeOrderFrequency = request != null ? request.changeOrderFrequency() : null;
        Double inspectionFailureRate = request != null ? request.inspectionFailureRate() : null;
        Integer contractorDelayHistory = request != null ? request.contractorDelayHistory() : null;
        Double costVariancePct = request != null ? request.costVariancePct() : null;

        // 2. Validate value bounds of provided operational inputs first
        if (plannedDurationDays != null && plannedDurationDays <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "planned_duration_days must be greater than 0");
        }
        if (budgetCrores != null && budgetCrores <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "budget_crores must be greater than 0");
        }
        if (inspectionFailureRate != null && (inspectionFailureRate < 0.0 || inspectionFailureRate > 1.0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "inspection_failure_rate must be between 0.0 and 1.0");
        }
        if (paymentProgressRatio != null && paymentProgressRatio < 0.0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "payment_progress_ratio must be non-negative");
        }
        if (changeOrderFrequency != null && changeOrderFrequency < 0.0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "change_order_frequency must be non-negative");
        }
        if (contractorDelayHistory != null && contractorDelayHistory < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "contractor_delay_history must be non-negative");
        }
        if (milestoneDelayDays != null && milestoneDelayDays < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "milestone_delay_days must be non-negative");
        }

        // 3. Validate all 10 required features are available
        List<String> missing = new ArrayList<>();
        if (progressVariance == null) missing.add("progress_variance");
        if (scheduleVariance == null) missing.add("schedule_variance");
        if (paymentProgressRatio == null) missing.add("payment_progress_ratio");
        if (milestoneDelayDays == null) missing.add("milestone_delay_days");
        if (changeOrderFrequency == null) missing.add("change_order_frequency");
        if (inspectionFailureRate == null) missing.add("inspection_failure_rate");
        if (contractorDelayHistory == null) missing.add("contractor_delay_history");
        if (costVariancePct == null) missing.add("cost_variance_pct");
        if (plannedDurationDays == null) missing.add("planned_duration_days");
        if (budgetCrores == null) missing.add("budget_crores");

        if (!missing.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Missing required operational features: " + missing +
                    ". These operational features cannot be silently fabricated and must be provided to evaluate risk models."
            );
        }

        Map<String, Object> featureMap = new LinkedHashMap<>();
        featureMap.put("progress_variance", progressVariance);
        featureMap.put("schedule_variance", scheduleVariance);
        featureMap.put("payment_progress_ratio", paymentProgressRatio);
        featureMap.put("milestone_delay_days", milestoneDelayDays);
        featureMap.put("change_order_frequency", changeOrderFrequency);
        featureMap.put("inspection_failure_rate", inspectionFailureRate);
        featureMap.put("contractor_delay_history", contractorDelayHistory);
        featureMap.put("cost_variance_pct", costVariancePct);
        featureMap.put("planned_duration_days", plannedDurationDays);
        featureMap.put("budget_crores", budgetCrores);

        // 3. Execute prediction via ML service
        MlPredictionResult prediction = mlRiskService.predictRisks(featureMap);

        // 4. Persistence: update project risk scores if requested
        boolean persist = request == null || request.persistRiskScores() == null || Boolean.TRUE.equals(request.persistRiskScores());
        if (persist) {
            int roundedDelay = (int) Math.round(prediction.delayRisk());
            int roundedCost = (int) Math.round(prediction.costOverrunRisk());
            String newStatus = roundedDelay >= 65 ? "Action needed" : roundedDelay >= 40 ? "Watch closely" : "On track";
            String newColor = roundedDelay >= 65 ? "coral" : roundedDelay >= 40 ? "gold" : "green";

            jdbc.update("""
                    UPDATE projects
                    SET delay_risk = ?, cost_risk = ?, status = ?, color = ?
                    WHERE id = ?
                    """, roundedDelay, roundedCost, newStatus, newColor, projectId);
        }

        return new RiskPredictionResponse(
                projectId,
                prediction.delayRisk(),
                prediction.costOverrunRisk(),
                prediction.dataOrigin(),
                prediction.warning(),
                featureMap,
                getProject(projectId),
                prediction.explanations()
        );
    }

    public MlPredictionResult predictStandalone(StandaloneRiskPredictionRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Prediction request cannot be empty");
        }
        List<String> missing = new ArrayList<>();
        if (request.progressVariance() == null) missing.add("progress_variance");
        if (request.scheduleVariance() == null) missing.add("schedule_variance");
        if (request.paymentProgressRatio() == null) missing.add("payment_progress_ratio");
        if (request.milestoneDelayDays() == null) missing.add("milestone_delay_days");
        if (request.changeOrderFrequency() == null) missing.add("change_order_frequency");
        if (request.inspectionFailureRate() == null) missing.add("inspection_failure_rate");
        if (request.contractorDelayHistory() == null) missing.add("contractor_delay_history");
        if (request.costVariancePct() == null) missing.add("cost_variance_pct");
        if (request.plannedDurationDays() == null) missing.add("planned_duration_days");
        if (request.budgetCrores() == null) missing.add("budget_crores");

        if (!missing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing required features: " + missing);
        }

        if (request.plannedDurationDays() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "planned_duration_days must be greater than 0");
        }
        if (request.budgetCrores() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "budget_crores must be greater than 0");
        }
        if (request.inspectionFailureRate() < 0.0 || request.inspectionFailureRate() > 1.0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "inspection_failure_rate must be between 0.0 and 1.0");
        }
        if (request.paymentProgressRatio() < 0.0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "payment_progress_ratio must be non-negative");
        }
        if (request.changeOrderFrequency() < 0.0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "change_order_frequency must be non-negative");
        }
        if (request.contractorDelayHistory() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "contractor_delay_history must be non-negative");
        }
        if (request.milestoneDelayDays() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "milestone_delay_days must be non-negative");
        }

        Map<String, Object> featureMap = new LinkedHashMap<>();
        featureMap.put("progress_variance", request.progressVariance());
        featureMap.put("schedule_variance", request.scheduleVariance());
        featureMap.put("payment_progress_ratio", request.paymentProgressRatio());
        featureMap.put("milestone_delay_days", request.milestoneDelayDays());
        featureMap.put("change_order_frequency", request.changeOrderFrequency());
        featureMap.put("inspection_failure_rate", request.inspectionFailureRate());
        featureMap.put("contractor_delay_history", request.contractorDelayHistory());
        featureMap.put("cost_variance_pct", request.costVariancePct());
        featureMap.put("planned_duration_days", request.plannedDurationDays());
        featureMap.put("budget_crores", request.budgetCrores());

        return mlRiskService.predictRisks(featureMap);
    }

    private void upsertProgress(String projectId, ProgressRequest request) {
        List<Long> existing = jdbc.query("""
                SELECT id FROM progress_snapshots WHERE project_id = ? AND snapshot_date = ?
                """, (rs, rowNum) -> rs.getLong("id"), projectId, request.date());
        if (existing.isEmpty()) {
            jdbc.update("""
                    INSERT INTO progress_snapshots (project_id, snapshot_date, planned_progress, actual_progress)
                    VALUES (?, ?, ?, ?)
                    """, projectId, request.date(), request.planned(), request.actual());
        } else {
            jdbc.update("""
                    UPDATE progress_snapshots SET planned_progress = ?, actual_progress = ?
                    WHERE id = ?
                    """, request.planned(), request.actual(), existing.get(0));
        }
    }

    private void insertMilestone(
            String projectId,
            String name,
            LocalDate plannedFinishDate,
            LocalDate forecastFinishDate,
            LocalDate actualFinishDate,
            String status
    ) {
        String id = projectId + "-M-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        jdbc.update("""
                INSERT INTO milestones
                    (id, project_id, name, planned_finish_date, forecast_finish_date, actual_finish_date, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, id, projectId, name, plannedFinishDate, forecastFinishDate, actualFinishDate, status);
    }

    private Map<String, Object> findProjectRow(String id) {
        try {
            return jdbc.queryForMap("SELECT * FROM projects WHERE id = ?", id);
        } catch (org.springframework.dao.EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found");
        }
    }

    private void requireProject(String id) {
        findProjectRow(id);
    }

    private static void validateMilestoneStatus(String status) {
        if (!MILESTONE_STATUSES.contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be Not started, In progress, or Complete");
        }
    }

    private static String formatBudget(BigDecimal amount) {
        return "₹" + amount.stripTrailingZeros().toPlainString() + " Cr";
    }

    private static String dateString(java.sql.Date date) {
        return date == null ? null : date.toLocalDate().toString();
    }

    private static String initials(String name) {
        return java.util.Arrays.stream(name.trim().split("\\s+"))
                .limit(2)
                .map(part -> part.substring(0, 1).toUpperCase())
                .reduce("", String::concat);
    }
}
