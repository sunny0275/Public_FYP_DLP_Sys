package com.dlp.platform.dto.document;

import com.dlp.platform.entity.Tag;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.stream.Collectors;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TagResponse {

    private Long id;
    private String name;
    private String color;
    private String description;
    private LocalDateTime createdAt;

    public static TagResponse from(Tag tag) {
        return TagResponse.builder()
            .id(tag.getId())
            .name(tag.getName())
            .color(tag.getColor())
            .description(tag.getDescription())
            .createdAt(tag.getCreatedAt())
            .build();
    }

    public static Set<TagResponse> fromSet(Set<Tag> tags) {
        if (tags == null) {
            return Set.of();
        }
        return tags.stream()
            .map(TagResponse::from)
            .collect(Collectors.toSet());
    }
}
