package com.dlp.platform.repository;

import com.dlp.platform.entity.UsbEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UsbEventRepository extends JpaRepository<UsbEvent, Long> {
}

