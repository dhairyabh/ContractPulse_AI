package com.contractpulse.api;

import static com.contractpulse.api.ApiModels.FeatureContribution;
import static com.contractpulse.api.ApiModels.MlPredictionResult;
import static com.contractpulse.api.ApiModels.ModelExplanation;
import static com.contractpulse.api.ApiModels.RiskExplanations;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.BufferedWriter;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MlRiskService {
    private static final Logger log = LoggerFactory.getLogger(MlRiskService.class);

    private final String pythonPath;
    private final String configuredScriptPath;
    private final int timeoutSeconds;
    private final ObjectMapper objectMapper;

    public MlRiskService(
            @Value("${contractpulse.ml.python-path:python}") String pythonPath,
            @Value("${contractpulse.ml.script-path:}") String configuredScriptPath,
            @Value("${contractpulse.ml.timeout-seconds:15}") int timeoutSeconds,
            ObjectMapper objectMapper
    ) {
        this.pythonPath = pythonPath;
        this.configuredScriptPath = configuredScriptPath;
        this.timeoutSeconds = timeoutSeconds;
        this.objectMapper = objectMapper;
    }

    public Path resolveScriptPath() {
        if (configuredScriptPath != null && !configuredScriptPath.isBlank()) {
            Path custom = Path.of(configuredScriptPath).toAbsolutePath().normalize();
            if (Files.isRegularFile(custom)) {
                return custom;
            }
            log.warn("Configured script path '{}' does not exist as a regular file. Checking fallback candidates.", configuredScriptPath);
        }

        List<Path> candidates = new ArrayList<>();
        candidates.add(Path.of("ml-risk", "predict.py"));
        candidates.add(Path.of("..", "ml-risk", "predict.py"));

        String userDir = System.getProperty("user.dir", ".");
        Path userPath = Path.of(userDir);
        candidates.add(userPath.resolve("ml-risk").resolve("predict.py"));
        candidates.add(userPath.resolve("..").resolve("ml-risk").resolve("predict.py"));

        for (Path candidate : candidates) {
            Path normalized = candidate.toAbsolutePath().normalize();
            if (Files.isRegularFile(normalized)) {
                return normalized;
            }
        }

        log.error("ML prediction script predict.py could not be found. Checked candidate locations: {}", candidates);
        throw new ResponseStatusException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "ML prediction script predict.py could not be found"
        );
    }

    public MlPredictionResult predictRisks(Map<String, Object> featureMap) {
        Path scriptFile = resolveScriptPath();
        String jsonPayload;
        try {
            jsonPayload = objectMapper.writeValueAsString(featureMap);
        } catch (Exception exc) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to serialize feature payload: " + exc.getMessage());
        }

        ProcessBuilder processBuilder = new ProcessBuilder(pythonPath, scriptFile.toString());
        processBuilder.directory(scriptFile.getParent().toFile());
        processBuilder.environment().put("PYTHONIOENCODING", "utf-8");

        Process process = null;
        try {
            process = processBuilder.start();

            Process procRef = process;
            CompletableFuture<byte[]> stdoutFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    return procRef.getInputStream().readAllBytes();
                } catch (Exception e) {
                    return new byte[0];
                }
            });

            CompletableFuture<byte[]> stderrFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    return procRef.getErrorStream().readAllBytes();
                } catch (Exception e) {
                    return new byte[0];
                }
            });

            try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8))) {
                writer.write(jsonPayload);
                writer.flush();
            }

            boolean completed = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            if (!completed) {
                process.destroyForcibly();
                stdoutFuture.cancel(true);
                stderrFuture.cancel(true);
                throw new ResponseStatusException(
                        HttpStatus.GATEWAY_TIMEOUT,
                        "ML prediction process timed out after " + timeoutSeconds + " seconds"
                );
            }

            int exitCode = process.exitValue();
            String stdout = new String(stdoutFuture.get(2, TimeUnit.SECONDS), StandardCharsets.UTF_8).trim();
            String stderr = new String(stderrFuture.get(2, TimeUnit.SECONDS), StandardCharsets.UTF_8).trim();

            if (exitCode != 0) {
                String errorDetail = extractErrorMessage(stderr, stdout, exitCode);
                log.error("ML prediction script exited with code {}: {}", exitCode, errorDetail);
                if (errorDetail.toLowerCase().contains("missing required") ||
                    errorDetail.toLowerCase().contains("must be a") ||
                    errorDetail.toLowerCase().contains("greater than 0") ||
                    errorDetail.toLowerCase().contains("between 0.0 and 1.0") ||
                    errorDetail.toLowerCase().contains("non-negative")) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ML validation error: " + errorDetail);
                }
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "ML prediction failed: " + errorDetail);
            }

            if (stdout.isBlank()) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "ML prediction returned empty output");
            }

            JsonNode root = objectMapper.readTree(stdout);
            double delayRisk = root.path("delay_risk").asDouble();
            double costOverrunRisk = root.path("cost_overrun_risk").asDouble();
            String dataOrigin = root.path("data_origin").asText("unknown");
            String warning = root.path("warning").asText("");

            RiskExplanations explanations = null;
            if (root.has("explanations") && root.get("explanations").isObject()) {
                try {
                    JsonNode expNode = root.get("explanations");
                    ModelExplanation delayExp = parseModelExplanation(expNode.path("delay_risk"));
                    ModelExplanation costExp = parseModelExplanation(expNode.path("cost_overrun_risk"));
                    String expWarning = expNode.path("warning").asText("");
                    if (delayExp != null || costExp != null) {
                        explanations = new RiskExplanations(delayExp, costExp, expWarning);
                    }
                } catch (Exception e) {
                    log.warn("Could not parse explanations from ML output: {}", e.getMessage());
                    explanations = null;
                }
            }

            return new MlPredictionResult(delayRisk, costOverrunRisk, dataOrigin, warning, explanations);
        } catch (InterruptedException ie) {
            if (process != null) {
                process.destroyForcibly();
            }
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "ML prediction was interrupted");
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception exc) {
            log.error("Error processing ML prediction result: {}", exc.getMessage(), exc);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to invoke Python runtime: " + exc.getMessage());
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        }
    }

    private String extractErrorMessage(String stderr, String stdout, int exitCode) {
        String candidate = !stderr.isBlank() ? stderr : stdout;
        if (candidate.isBlank()) {
            return "Process exited with code " + exitCode;
        }
        try {
            JsonNode errJson = objectMapper.readTree(candidate);
            if (errJson.has("error")) {
                return errJson.get("error").asText();
            }
        } catch (Exception ignored) {
        }
        return candidate;
    }

    private ModelExplanation parseModelExplanation(JsonNode node) {
        if (node == null || node.isMissingNode() || !node.isObject() || !node.has("target")) {
            return null;
        }
        String target = node.path("target").asText();
        String modelType = node.path("model_type").asText();
        String method = node.path("method").asText();
        double baseValue = node.path("base_value").asDouble();
        String scale = node.path("scale").asText();
        String note = node.path("note").asText();

        List<FeatureContribution> topDrivers = parseDrivers(node.path("top_drivers"), scale);
        List<FeatureContribution> allDrivers = parseDrivers(node.path("all_drivers"), scale);

        return new ModelExplanation(target, modelType, method, baseValue, scale, topDrivers, allDrivers, note);
    }

    private List<FeatureContribution> parseDrivers(JsonNode driversNode, String defaultScale) {
        List<FeatureContribution> list = new ArrayList<>();
        if (driversNode != null && driversNode.isArray()) {
            for (JsonNode d : driversNode) {
                String feature = d.path("feature").asText();
                String featureName = d.path("feature_name").asText(feature);
                double inputValue = d.path("input_value").asDouble();
                double contribution = d.path("contribution").asDouble();
                String scale = d.path("scale").asText(defaultScale);
                String direction = d.path("direction").asText("neutral");
                double displayMagnitude = d.path("display_magnitude").asDouble();
                list.add(new FeatureContribution(feature, featureName, inputValue, contribution, scale, direction, displayMagnitude));
            }
        }
        return list;
    }
}
