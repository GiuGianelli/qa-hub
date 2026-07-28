package com.qanotes;

import com.qanotes.client.ZephyrClient;
import com.qanotes.importer.TestCaseImporter;

import java.util.logging.Logger;

public class Main {

    private static final Logger LOG = Logger.getLogger(Main.class.getName());

    public static void main(String[] args) throws Exception {
        String token     = env("ZEPHYR_TOKEN",    null);
        String project   = env("JIRA_PROJECT",    "MYPROJECT");
        String inputFile = env("TEST_CASES_FILE", "test-cases.json");

        if (token == null) {
            LOG.severe("ZEPHYR_TOKEN env var is required.");
            System.exit(1);
        }

        ZephyrClient client = new ZephyrClient(token);
        TestCaseImporter importer = new TestCaseImporter(client, project);
        importer.importFromFile(inputFile);
    }

    private static String env(String key, String defaultValue) {
        String val = System.getenv(key);
        return (val != null && !val.isBlank()) ? val : defaultValue;
    }
}
