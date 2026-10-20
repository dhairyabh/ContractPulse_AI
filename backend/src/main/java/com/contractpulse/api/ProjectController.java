package com.contractpulse.api;

import static com.contractpulse.api.ApiModels.MilestoneDto;
import static com.contractpulse.api.ApiModels.MilestoneRequest;
import static com.contractpulse.api.ApiModels.ProgressRequest;
import static com.contractpulse.api.ApiModels.ProgressSnapshotDto;
import static com.contractpulse.api.ApiModels.ProjectDto;
import static com.contractpulse.api.ApiModels.ProjectRequest;
import static com.contractpulse.api.ApiModels.ProjectRiskPredictionRequest;
import static com.contractpulse.api.ApiModels.RiskPredictionResponse;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
    private final ProjectService service;

    public ProjectController(ProjectService service) {
        this.service = service;
    }

    @GetMapping
    public List<ProjectDto> getProjects() {
        return service.getProjects();
    }

    @GetMapping("/{projectId}")
    public ProjectDto getProject(@PathVariable String projectId) {
        return service.getProject(projectId);
    }

    @PostMapping
    public ResponseEntity<ProjectDto> createProject(@Valid @RequestBody ProjectRequest request) {
        ProjectDto created = service.createProject(request);
        return ResponseEntity.created(URI.create("/api/projects/" + created.id())).body(created);
    }

    @PutMapping("/{projectId}")
    public ProjectDto updateProject(@PathVariable String projectId, @Valid @RequestBody ProjectRequest request) {
        return service.updateProject(projectId, request);
    }

    @DeleteMapping("/{projectId}")
    public ResponseEntity<Void> deleteProject(@PathVariable String projectId) {
        service.deleteProject(projectId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{projectId}/progress")
    public List<ProgressSnapshotDto> getProgress(@PathVariable String projectId) {
        return service.getProgressHistory(projectId);
    }

    @PostMapping("/{projectId}/progress")
    public ProjectDto addProgress(@PathVariable String projectId, @Valid @RequestBody ProgressRequest request) {
        return service.addProgress(projectId, request);
    }

    @PutMapping("/{projectId}/progress/{snapshotId}")
    public ProjectDto updateProgress(
            @PathVariable String projectId,
            @PathVariable long snapshotId,
            @Valid @RequestBody ProgressRequest request
    ) {
        return service.updateProgress(projectId, snapshotId, request);
    }

    @DeleteMapping("/{projectId}/progress/{snapshotId}")
    public ProjectDto deleteProgress(@PathVariable String projectId, @PathVariable long snapshotId) {
        return service.deleteProgress(projectId, snapshotId);
    }

    @GetMapping("/{projectId}/milestones")
    public List<MilestoneDto> getMilestones(@PathVariable String projectId) {
        return service.getMilestones(projectId);
    }

    @PostMapping("/{projectId}/milestones")
    public ProjectDto addMilestone(
            @PathVariable String projectId,
            @Valid @RequestBody MilestoneRequest request
    ) {
        return service.addMilestone(projectId, request);
    }

    @PutMapping("/{projectId}/milestones/{milestoneId}")
    public ProjectDto updateMilestone(
            @PathVariable String projectId,
            @PathVariable String milestoneId,
            @Valid @RequestBody MilestoneRequest request
    ) {
        return service.updateMilestone(projectId, milestoneId, request);
    }

    @DeleteMapping("/{projectId}/milestones/{milestoneId}")
    public ProjectDto deleteMilestone(@PathVariable String projectId, @PathVariable String milestoneId) {
        return service.deleteMilestone(projectId, milestoneId);
    }

    @PostMapping("/{projectId}/predict-risk")
    public RiskPredictionResponse predictProjectRisk(
            @PathVariable String projectId,
            @RequestBody(required = false) ProjectRiskPredictionRequest request
    ) {
        return service.predictProjectRisk(projectId, request);
    }
}
