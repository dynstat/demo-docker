package com.demo.app;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.net.InetAddress;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")   // allow React frontend during dev
public class ApiController {

    @Value("${app.name:springboot-backend}")
    private String appName;

    @Value("${app.version:1.0.0}")
    private String appVersion;

    @Value("${app.color:#FF6B35}")
    private String appColor;

    // ---- GET /api/hello ----
    @GetMapping("/hello")
    public Map<String, Object> hello() {
        return Map.of(
            "message", "Hello from " + appName + "!",
            "hostname", getHostname(),
            "version", appVersion,
            "color", appColor,
            "timestamp", Instant.now().toString()
        );
    }

    // ---- GET /api/health ----
    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of(
            "status", "healthy",
            "hostname", getHostname()
        );
    }

    // ---- GET /api/info ----
    @GetMapping("/info")
    public Map<String, String> info() {
        return Map.of(
            "app_name", appName,
            "app_version", appVersion,
            "hostname", getHostname(),
            "platform", "Java / Spring Boot",
            "node_name", env("NODE_NAME"),
            "pod_ip", env("POD_IP"),
            "namespace", env("POD_NAMESPACE")
        );
    }

    // ---------- Helpers ----------

    private String getHostname() {
        try { return InetAddress.getLocalHost().getHostName(); }
        catch (Exception e) { return "unknown"; }
    }

    private String env(String key) {
        String val = System.getenv(key);
        return val != null ? val : "unknown";
    }
}
