package com.dlp.platform.dto.document;

import java.util.List;

public class DocumentListResponse {
    private List<DocumentResponse> documents;
    private int totalCount;
    private int currentPage;
    private int totalPages;
    private int pageSize;

    // Constructors
    public DocumentListResponse() {}

    public DocumentListResponse(List<DocumentResponse> documents, int totalCount, int currentPage, int totalPages, int pageSize) {
        this.documents = documents;
        this.totalCount = totalCount;
        this.currentPage = currentPage;
        this.totalPages = totalPages;
        this.pageSize = pageSize;
    }

    // Getters and Setters
    public List<DocumentResponse> getDocuments() { return documents; }
    public void setDocuments(List<DocumentResponse> documents) { this.documents = documents; }

    public int getTotalCount() { return totalCount; }
    public void setTotalCount(int totalCount) { this.totalCount = totalCount; }

    public int getCurrentPage() { return currentPage; }
    public void setCurrentPage(int currentPage) { this.currentPage = currentPage; }

    public int getTotalPages() { return totalPages; }
    public void setTotalPages(int totalPages) { this.totalPages = totalPages; }

    public int getPageSize() { return pageSize; }
    public void setPageSize(int pageSize) { this.pageSize = pageSize; }
}
