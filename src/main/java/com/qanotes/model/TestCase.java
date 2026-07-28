package com.qanotes.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class TestCase {

    private String name;
    private String objective;
    private String precondition;
    private List<String> preconditionImages;
    private String status;      // Draft, Approved, Deprecated
    private String priority;    // Low, Normal, High
    private String labels;
    private String component;
    private String scenario;
    private Long folderId;    // Gherkin: Feature/Scenario/Given/When/Then
    private String productComponent;
    private String squadTeam;
    private String regressionTests;
    private String testAutomation;
    private String testType;
    private String assignee;

    public TestCase() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getObjective() { return objective; }
    public void setObjective(String objective) { this.objective = objective; }

    public String getPrecondition() { return precondition; }
    public void setPrecondition(String precondition) { this.precondition = precondition; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getLabels() { return labels; }
    public void setLabels(String labels) { this.labels = labels; }

    public String getComponent() { return component; }
    public void setComponent(String component) { this.component = component; }

    public String getScenario() { return scenario; }
    public void setScenario(String scenario) { this.scenario = scenario; }

    public String getProductComponent() { return productComponent; }
    public void setProductComponent(String productComponent) { this.productComponent = productComponent; }

    public String getSquadTeam() { return squadTeam; }
    public void setSquadTeam(String squadTeam) { this.squadTeam = squadTeam; }

    public String getRegressionTests() { return regressionTests; }
    public void setRegressionTests(String regressionTests) { this.regressionTests = regressionTests; }

    public String getTestAutomation() { return testAutomation; }
    public void setTestAutomation(String testAutomation) { this.testAutomation = testAutomation; }

    public String getTestType() { return testType; }
    public void setTestType(String testType) { this.testType = testType; }

    public Long getFolderId() { return folderId; }
    public void setFolderId(Long folderId) { this.folderId = folderId; }

    public String getAssignee() { return assignee; }
    public void setAssignee(String assignee) { this.assignee = assignee; }

    public List<String> getPreconditionImages() { return preconditionImages; }
    public void setPreconditionImages(List<String> preconditionImages) { this.preconditionImages = preconditionImages; }
}
