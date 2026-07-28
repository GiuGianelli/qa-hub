package com.qanotes.importer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.qanotes.client.ZephyrClient;
import com.qanotes.model.TestCase;

import java.io.File;

public class TestCaseImporter {

    private final ZephyrClient client;
    private final String projectKey;
    private final ObjectMapper mapper;

    public TestCaseImporter(ZephyrClient client, String projectKey) {
        this.client = client;
        this.projectKey = projectKey;
        this.mapper = new ObjectMapper();
    }

    public void importFromFile(String jsonFilePath) throws Exception {
        File file = new File(jsonFilePath);
        if (!file.exists()) {
            throw new IllegalArgumentException("File not found: " + jsonFilePath);
        }

        TestCase[] cases = mapper.readValue(file, TestCase[].class);
        System.out.printf("%nImporting %d test case(s) from \"%s\" into project %s...%n%n",
                cases.length, file.getName(), projectKey);

        int success = 0;
        int failed = 0;

        for (int i = 0; i < cases.length; i++) {
            TestCase tc = cases[i];
            try {
                ObjectNode payload = buildPayload(tc);
                JsonNode result = client.createTestCase(payload);
                String key = result.path("key").asText("?");
                if (tc.getScenario() != null && !tc.getScenario().isBlank()) {
                    client.createTestScript(key, tc.getScenario());
                }
                System.out.printf("  [%d/%d] OK   %-10s  %s%n", i + 1, cases.length, key, tc.getName());
                success++;
            } catch (Exception e) {
                System.err.printf("  [%d/%d] FAIL             %s  -> %s%n",
                        i + 1, cases.length, tc.getName(), e.getMessage());
                failed++;
            }
        }

        System.out.printf("%nDone. %d imported, %d failed.%n", success, failed);
    }

    private ObjectNode buildPayload(TestCase tc) {
        ObjectNode root = mapper.createObjectNode();
        root.put("projectKey", projectKey);
        root.put("name", tc.getName());

        if (tc.getObjective()    != null) root.put("objective",    tc.getObjective());
        if (tc.getPrecondition() != null) root.put("precondition", tc.getPrecondition());
        if (tc.getStatus()       != null) root.put("status",       tc.getStatus());
        if (tc.getPriority()     != null) root.put("priority",     tc.getPriority());
        if (tc.getLabels() != null && !tc.getLabels().isBlank()) root.put("labels", tc.getLabels());
        if (tc.getComponent()    != null) root.put("component",    tc.getComponent());
        if (tc.getFolderId()     != null) root.put("folderId",     tc.getFolderId());
        if (tc.getAssignee()     != null && !tc.getAssignee().isBlank()) root.put("ownerId", tc.getAssignee());

        ObjectNode customFields = mapper.createObjectNode();
        customFields.put("Test Automation", tc.getTestAutomation() != null ? tc.getTestAutomation() : "No");
        customFields.set("Test Type", mapper.createArrayNode().add(tc.getTestType() != null ? tc.getTestType() : "BDD"));
        customFields.put("Product Component", tc.getProductComponent() != null ? tc.getProductComponent() : "");
        customFields.put("Squad - Team", tc.getSquadTeam() != null ? tc.getSquadTeam() : "");
        customFields.put("Should be part of Regression Tests?", tc.getRegressionTests() != null ? tc.getRegressionTests() : "");
        root.set("customFields", customFields);

        return root;
    }
}
