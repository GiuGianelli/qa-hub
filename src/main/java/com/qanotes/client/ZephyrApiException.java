package com.qanotes.client;

public class ZephyrApiException extends Exception {

    private final int statusCode;

    public ZephyrApiException(int statusCode, String body) {
        super("Zephyr API error " + statusCode + ": " + body);
        this.statusCode = statusCode;
    }

    public int getStatusCode() { return statusCode; }
}
