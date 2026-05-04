package com.dlp.platform.dto.workflow;

import com.dlp.platform.entity.Task;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for task actions (approve/reject/delegate)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskActionRequest {

    @NotNull(message = "Action is required")
    private TaskAction action; // APPROVE, REJECT, DELEGATE

    @NotBlank(message = "Comment is required")
    private String comment;

    private String signature; // Digital signature (for approval)

    private Long delegateToUserId; // For delegation

    public enum TaskAction {
        APPROVE,
        REJECT,
        DELEGATE
    }
}
