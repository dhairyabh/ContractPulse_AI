package com.contractpulse.api;

import static com.contractpulse.api.ApiModels.MlPredictionResult;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class MlRiskServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("MlRiskService locates existing predict.py script")
    void testResolveScriptPath() {
        MlRiskService service = new MlRiskService("python", "", 15, objectMapper);
        Path scriptPath = service.resolveScriptPath();
        assertThat(scriptPath).isNotNull();
        assertThat(scriptPath.toFile()).exists();
        assertThat(scriptPath.getFileName().toString()).isEqualTo("predict.py");
    }

    @Test
    @DisplayName("MlRiskService throws 500 when python executable is invalid")
    void testProcessFailure_InvalidPythonPath() {
        MlRiskService service = new MlRiskService("non_existent_python_binary_xyz", "", 5, objectMapper);
        Map<String, Object> features = Map.of(
                "progress_variance", -8.0,
                "schedule_variance", 4.26,
                "payment_progress_ratio", 1.05,
                "milestone_delay_days", 23,
                "change_order_frequency", 1.2,
                "inspection_failure_rate", 0.1,
                "contractor_delay_history", 1,
                "cost_variance_pct", 4.5,
                "planned_duration_days", 540,
                "budget_crores", 18.46
        );

        assertThatThrownBy(() -> service.predictRisks(features))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Failed to invoke Python runtime");
    }

    @Test
    @DisplayName("MlRiskService throws 400 when missing required features")
    void testProcessFailure_MissingFeaturePythonExit() {
        MlRiskService service = new MlRiskService("python", "", 15, objectMapper);
        Map<String, Object> incomplete = Map.of(
                "progress_variance", -8.0,
                "budget_crores", 18.46
        );

        assertThatThrownBy(() -> service.predictRisks(incomplete))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Missing required features");
    }

    @Test
    @DisplayName("MlRiskService executes predict.py and parses prediction result successfully")
    void testPredictRisks_Success() {
        MlRiskService service = new MlRiskService("python", "", 15, objectMapper);
        Map<String, Object> features = Map.of(
                "progress_variance", -8.0,
                "schedule_variance", 4.26,
                "payment_progress_ratio", 1.05,
                "milestone_delay_days", 23,
                "change_order_frequency", 1.2,
                "inspection_failure_rate", 0.1,
                "contractor_delay_history", 1,
                "cost_variance_pct", 4.5,
                "planned_duration_days", 540,
                "budget_crores", 18.46
        );

        MlPredictionResult result = service.predictRisks(features);
        assertThat(result).isNotNull();
        assertThat(result.delayRisk()).isBetween(0.0, 100.0);
        assertThat(result.costOverrunRisk()).isBetween(0.0, 100.0);
        assertThat(result.dataOrigin()).isEqualTo("synthetic-development-model");
        assertThat(result.warning()).contains("Prototype prediction trained on synthetic data");
        assertThat(result.explanations()).isNotNull();
        assertThat(result.explanations().delayRisk()).isNotNull();
        assertThat(result.explanations().delayRisk().modelType()).isEqualTo("LogisticRegression");
        assertThat(result.explanations().delayRisk().topDrivers()).hasSizeLessThanOrEqualTo(5);
        assertThat(result.explanations().delayRisk().topDrivers().get(0).feature()).isNotEmpty();
        assertThat(result.explanations().costOverrunRisk()).isNotNull();
        assertThat(result.explanations().costOverrunRisk().modelType()).isEqualTo("XGBClassifier");
        assertThat(result.explanations().costOverrunRisk().topDrivers()).hasSizeLessThanOrEqualTo(5);
    }

    @Test
    @DisplayName("MlPredictionResult supports backward compatibility when explanations are absent")
    void testMlPredictionResult_BackwardCompatibility() {
        MlPredictionResult result = new MlPredictionResult(45.5, 78.2, "synthetic-development-model", "Test warning");
        assertThat(result.delayRisk()).isEqualTo(45.5);
        assertThat(result.costOverrunRisk()).isEqualTo(78.2);
        assertThat(result.explanations()).isNull();
    }
}
