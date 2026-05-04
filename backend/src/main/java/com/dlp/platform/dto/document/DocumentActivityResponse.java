package com.dlp.platform.dto.document;

import com.dlp.platform.entity.DocumentActivity;

import java.time.LocalDateTime;

public class DocumentActivityResponse {
    private Long id;
    private Long userId;
    private String userName;
    private String accountId;
    private String user;
    private String action; // VIEW, DOWNLOAD, SHARE, UPDATE, DELETE
    private String result;
    private LocalDateTime timestamp;
    private String ipAddress;
    private String details;

    public DocumentActivityResponse() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public String getAccountId() { return accountId; }
    public void setAccountId(String accountId) { this.accountId = accountId; }

    public String getUser() { return user; }
    public void setUser(String user) { this.user = user; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public static DocumentActivityResponse from(DocumentActivity activity) {
        if (activity == null) {
            return null;
        }
        DocumentActivityResponse resp = new DocumentActivityResponse();
        resp.setId(activity.getId());
        if (activity.getUser() != null) {
            resp.setUserId(activity.getUser().getId());
            resp.setUserName(activity.getUser().getFullName());
            resp.setAccountId(activity.getUser().getAccountId());
            resp.setUser(activity.getUser().getFullName());
        }
        resp.setAction(activity.getActivityType() != null ? activity.getActivityType().name() : null);
        resp.setResult(activity.getResult() != null ? activity.getResult().name() : null);
        resp.setTimestamp(activity.getTimestamp());
        resp.setIpAddress(activity.getIpAddress());
        resp.setDetails(activity.getDetails());
        return resp;
    }
}
