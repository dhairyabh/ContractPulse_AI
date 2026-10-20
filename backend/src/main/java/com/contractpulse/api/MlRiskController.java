package com.contractpulse.api;

import static com.contractpulse.api.ApiModels.MlPredictionResult;
import static com.contractpulse.api.ApiModels.StandaloneRiskPredictionRequest;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ml")
public class MlRiskController {
    private final ProjectService projectService;

    public MlRiskController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @PostMapping("/predict-risk")
    public MlPredictionResult predictStandaloneRisk(@Valid @RequestBody StandaloneRiskPredictionRequest request) {
        return projectService.predictStandalone(request);
    }
}
