package com.contractpulse.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ProjectRiskPredictionTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ProjectService projectService;

    @Test
    @DisplayName("Predict risk fails with 400 when required operational data is missing")
    void testPredictProjectRisk_MissingOperationalFeatures_ReturnsBadRequest() throws Exception {
        // CP-2048 has budget and progress snapshots, but missing operational data (planned_duration_days, payment ratio, etc.)
        mockMvc.perform(post("/api/projects/CP-2048/predict-risk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Missing required operational features")))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("planned_duration_days")));

        // Verify existing project risk scores were NOT overwritten
        var project = projectService.getProject("CP-2048");
        assertThat(project.delayRisk()).isEqualTo(78);
        assertThat(project.costRisk()).isEqualTo(64);
    }

    @Test
    @DisplayName("Predict risk fails with 400 when feature bounds are invalid")
    void testPredictProjectRisk_InvalidFeatureBounds_ReturnsBadRequest() throws Exception {
        Map<String, Object> payload = createValidOperationalPayload();
        payload.put("plannedDurationDays", -10); // invalid duration

        mockMvc.perform(post("/api/projects/CP-2048/predict-risk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("planned_duration_days must be greater than 0")));

        payload.put("plannedDurationDays", 540);
        payload.put("inspectionFailureRate", 2.5); // invalid failure rate (> 1.0)
        mockMvc.perform(post("/api/projects/CP-2048/predict-risk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("inspection_failure_rate must be between 0.0 and 1.0")));
    }

    @Test
    @DisplayName("Predict risk fails with 404 when project does not exist")
    void testPredictProjectRisk_ProjectNotFound_ReturnsNotFound() throws Exception {
        Map<String, Object> payload = createValidOperationalPayload();

        mockMvc.perform(post("/api/projects/CP-NONEXISTENT/predict-risk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Project not found"));
    }

    @Test
    @DisplayName("Predict risk succeeds with complete operational inputs, executes ML model and persists results")
    void testPredictProjectRisk_AllFeaturesProvided_SuccessAndPersists() throws Exception {
        Map<String, Object> payload = createValidOperationalPayload();

        mockMvc.perform(post("/api/projects/CP-1876/predict-risk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectId").value("CP-1876"))
                .andExpect(jsonPath("$.delayRisk").isNumber())
                .andExpect(jsonPath("$.costOverrunRisk").isNumber())
                .andExpect(jsonPath("$.dataOrigin").value("synthetic-development-model"))
                .andExpect(jsonPath("$.warning").value(org.hamcrest.Matchers.containsString("Prototype prediction trained on synthetic data")))
                .andExpect(jsonPath("$.project.id").value("CP-1876"))
                .andExpect(jsonPath("$.project.riskScoresAvailable").value(true));

        // Verify project is updated in the database and getProject returns the new state
        var updated = projectService.getProject("CP-1876");
        assertThat(updated.delayRisk()).isNotNull();
        assertThat(updated.costRisk()).isNotNull();
        assertThat(updated.riskScoresAvailable()).isTrue();
    }

    @Test
    @DisplayName("Predict risk does not alter database when persistRiskScores is false")
    void testPredictProjectRisk_PersistFalse_DoesNotUpdateDatabase() throws Exception {
        var original = projectService.getProject("CP-2048");
        Integer originalDelay = original.delayRisk();
        Integer originalCost = original.costRisk();

        Map<String, Object> payload = createValidOperationalPayload();
        payload.put("persistRiskScores", false);

        mockMvc.perform(post("/api/projects/CP-2048/predict-risk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectId").value("CP-2048"))
                .andExpect(jsonPath("$.delayRisk").isNumber());

        var unchanged = projectService.getProject("CP-2048");
        assertThat(unchanged.delayRisk()).isEqualTo(originalDelay);
        assertThat(unchanged.costRisk()).isEqualTo(originalCost);
    }

    @Test
    @DisplayName("Standalone ML prediction endpoint succeeds with 10 features")
    void testPredictStandaloneRisk_Success() throws Exception {
        Map<String, Object> payload = Map.of(
                "progressVariance", -8.0,
                "scheduleVariance", 4.26,
                "paymentProgressRatio", 1.05,
                "milestoneDelayDays", 23,
                "changeOrderFrequency", 1.2,
                "inspectionFailureRate", 0.1,
                "contractorDelayHistory", 1,
                "costVariancePct", 4.5,
                "plannedDurationDays", 540,
                "budgetCrores", 18.46
        );

        mockMvc.perform(post("/api/ml/predict-risk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.delayRisk").isNumber())
                .andExpect(jsonPath("$.costOverrunRisk").isNumber())
                .andExpect(jsonPath("$.dataOrigin").value("synthetic-development-model"))
                .andExpect(jsonPath("$.warning").value(org.hamcrest.Matchers.containsString("Prototype prediction trained on synthetic data")));
    }

    @Test
    @DisplayName("Standalone ML prediction endpoint rejects missing features with 400")
    void testPredictStandaloneRisk_MissingFeatures_ReturnsBadRequest() throws Exception {
        Map<String, Object> incomplete = Map.of(
                "progressVariance", -8.0,
                "budgetCrores", 18.46
        );

        mockMvc.perform(post("/api/ml/predict-risk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(incomplete)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Standalone ML prediction endpoint rejects invalid feature bounds with 400")
    void testPredictStandaloneRisk_InvalidFeatureBounds_ReturnsBadRequest() throws Exception {
        Map<String, Object> payload = Map.of(
                "progressVariance", -8.0,
                "scheduleVariance", 4.26,
                "paymentProgressRatio", -0.5,
                "milestoneDelayDays", 23,
                "changeOrderFrequency", 1.2,
                "inspectionFailureRate", 0.1,
                "contractorDelayHistory", 1,
                "costVariancePct", 4.5,
                "plannedDurationDays", 540,
                "budgetCrores", 18.46
        );

        mockMvc.perform(post("/api/ml/predict-risk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("payment_progress_ratio must be non-negative")));
    }

    @Test
    @DisplayName("Project CRUD operations continue to work correctly")
    void testProjectCrudRemainsFunctional() throws Exception {
        mockMvc.perform(get("/api/projects"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(4)));

        mockMvc.perform(get("/api/projects/CP-2048"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("CP-2048"))
                .andExpect(jsonPath("$.name").value("East River Flood Barrier"));
    }

    @Test
    @DisplayName("Predict risk returns structured model explanations for delay and cost risks")
    void testPredictProjectRisk_ReturnsStructuredExplanations() throws Exception {
        Map<String, Object> payload = createValidOperationalPayload();
        payload.put("persistRiskScores", false);

        mockMvc.perform(post("/api/projects/CP-2048/predict-risk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.explanations").isMap())
                .andExpect(jsonPath("$.explanations.delayRisk.modelType").value("LogisticRegression"))
                .andExpect(jsonPath("$.explanations.delayRisk.method").value("linear_model_coefficients"))
                .andExpect(jsonPath("$.explanations.delayRisk.topDrivers").isArray())
                .andExpect(jsonPath("$.explanations.delayRisk.topDrivers[0].feature").isNotEmpty())
                .andExpect(jsonPath("$.explanations.delayRisk.topDrivers[0].direction").isNotEmpty())
                .andExpect(jsonPath("$.explanations.costOverrunRisk.modelType").value("XGBClassifier"))
                .andExpect(jsonPath("$.explanations.costOverrunRisk.method").value("tree_shap"))
                .andExpect(jsonPath("$.explanations.costOverrunRisk.topDrivers").isArray())
                .andExpect(jsonPath("$.explanations.costOverrunRisk.topDrivers[0].feature").isNotEmpty());
    }

    private Map<String, Object> createValidOperationalPayload() {
        Map<String, Object> map = new HashMap<>();
        map.put("plannedDurationDays", 540);
        map.put("paymentProgressRatio", 1.05);
        map.put("changeOrderFrequency", 1.2);
        map.put("inspectionFailureRate", 0.1);
        map.put("contractorDelayHistory", 1);
        map.put("costVariancePct", 4.5);
        map.put("milestoneDelayDays", 23);
        map.put("persistRiskScores", true);
        return map;
    }
}
