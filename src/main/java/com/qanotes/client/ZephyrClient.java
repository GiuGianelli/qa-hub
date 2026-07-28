package com.qanotes.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;

/**
 * HTTP client for Zephyr Scale Cloud REST API v2.
 * Docs: https://support.smartbear.com/zephyr-scale-cloud/api-docs/
 * Auth: Bearer token generated at:
 *   {jiraBaseUrl}/plugins/servlet/ac/com.kanoah.test-manager/api-access-tokens
 */
public class ZephyrClient {

    private static final String BASE_URL = "https://api.zephyrscale.smartbear.com/v2";

    private final String authHeader;
    private final HttpClient http;
    private final ObjectMapper mapper;

    public ZephyrClient(String zephyrToken) {
        this.authHeader = "Bearer " + zephyrToken;
        this.http = HttpClient.newHttpClient();
        this.mapper = new ObjectMapper();
    }

    /** Creates a single test case and returns the created resource (includes key). */
    public JsonNode createTestCase(Object testCasePayload) throws Exception {
        String body = mapper.writeValueAsString(testCasePayload);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/testcases"))
                .header("Authorization", authHeader)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 201 && response.statusCode() != 200) {
            throw new ZephyrApiException(response.statusCode(), response.body());
        }

        return mapper.readTree(response.body());
    }

    /** Creates the test script for an existing test case by key. */
    public void createTestScript(String testCaseKey, String gherkinText) throws Exception {
        String body = mapper.writeValueAsString(
            mapper.createObjectNode()
                .put("type", "bdd")
                .put("text", gherkinText)
        );
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/testcases/" + testCaseKey + "/testscript"))
                .header("Authorization", authHeader)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 201 && response.statusCode() != 200) {
            throw new ZephyrApiException(response.statusCode(), response.body());
        }
    }
}
