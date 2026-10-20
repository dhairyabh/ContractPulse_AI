package com.contractpulse.api;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public final class ApiModels {
    private ApiModels() {}

    public record ProgressSnapshotDto(
            String id,
            String date,
            int planned,
            int actual
    ) {}

    public record MilestoneDto(
            String id,
            String name,
            String plannedFinishDate,
            String forecastFinishDate,
            String actualFinishDate,
            String status
    ) {}

    public record ProjectDto(
            String id,
            String name,
            String agency,
            String contractor,
            String budget,
            int progress,
            int plannedProgress,
            String progressAsOfDate,
            List<ProgressSnapshotDto> progressHistory,
            String baselineFinishDate,
            String forecastFinishDate,
            Integer delayRisk,
            Integer costRisk,
            boolean riskScoresAvailable,
            String status,
            String color,
            String initials,
            String milestone,
            String due,
            List<MilestoneDto> milestones
    ) {}

    public record ProjectRequest(
            @NotBlank @Size(max = 120) String name,
            @NotBlank @Size(max = 120) String agency,
            @NotBlank @Size(max = 120) String contractor,
            @NotNull @DecimalMin("0.0") BigDecimal budgetCrores,
            @NotNull @Min(0) @Max(100) Integer progress,
            @NotNull @Min(0) @Max(100) Integer plannedProgress,
            @NotNull LocalDate baselineFinishDate,
            @NotNull LocalDate forecastFinishDate,
            @NotBlank @Size(max = 120) String milestoneName,
            @NotNull LocalDate milestoneDueDate
    ) {}

    public record ProgressRequest(
            @NotNull LocalDate date,
            @NotNull @Min(0) @Max(100) Integer planned,
            @NotNull @Min(0) @Max(100) Integer actual
    ) {}

    public record MilestoneRequest(
            @NotBlank @Size(max = 120) String name,
            @NotNull LocalDate plannedFinishDate,
            LocalDate forecastFinishDate,
            LocalDate actualFinishDate,
            @NotBlank String status
    ) {}

    public record FeatureContribution(
            String feature,
            String featureName,
            double inputValue,
            double contribution,
            String scale,
            String direction,
            double displayMagnitude
    ) {}

    public record ModelExplanation(
            String target,
            String modelType,
            String method,
            double baseValue,
            String scale,
            List<FeatureContribution> topDrivers,
            List<FeatureContribution> allDrivers,
            String note
    ) {}

    public record RiskExplanations(
            ModelExplanation delayRisk,
            ModelExplanation costOverrunRisk,
            String warning
    ) {}

    public record MlPredictionResult(
            double delayRisk,
            double costOverrunRisk,
            String dataOrigin,
            String warning,
            RiskExplanations explanations
    ) {
        public MlPredictionResult(double delayRisk, double costOverrunRisk, String dataOrigin, String warning) {
            this(delayRisk, costOverrunRisk, dataOrigin, warning, null);
        }
    }

    public record ProjectRiskPredictionRequest(
            Double progressVariance,
            Double scheduleVariance,
            Double paymentProgressRatio,
            Integer milestoneDelayDays,
            Double changeOrderFrequency,
            Double inspectionFailureRate,
            Integer contractorDelayHistory,
            Double costVariancePct,
            Integer plannedDurationDays,
            Double budgetCrores,
            Boolean persistRiskScores
    ) {}

    public record StandaloneRiskPredictionRequest(
            @NotNull Double progressVariance,
            @NotNull Double scheduleVariance,
            @NotNull Double paymentProgressRatio,
            @NotNull Integer milestoneDelayDays,
            @NotNull Double changeOrderFrequency,
            @NotNull Double inspectionFailureRate,
            @NotNull Integer contractorDelayHistory,
            @NotNull Double costVariancePct,
            @NotNull Integer plannedDurationDays,
            @NotNull Double budgetCrores
    ) {}

    public record RiskPredictionResponse(
            String projectId,
            double delayRisk,
            double costOverrunRisk,
            String dataOrigin,
            String warning,
            Map<String, Object> featuresUsed,
            ProjectDto project,
            RiskExplanations explanations
    ) {
        public RiskPredictionResponse(
                String projectId,
                double delayRisk,
                double costOverrunRisk,
                String dataOrigin,
                String warning,
                Map<String, Object> featuresUsed,
                ProjectDto project
        ) {
            this(projectId, delayRisk, costOverrunRisk, dataOrigin, warning, featuresUsed, project, null);
        }
    }

    public record ApiError(String message) {}
}
