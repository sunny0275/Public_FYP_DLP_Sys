# syntax=docker/dockerfile:1.7
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app

COPY settings.xml /root/.m2/settings.xml
COPY pom.xml .

# Warm Maven dependency cache in a dedicated layer.
# This makes subsequent rebuilds much faster when only source code changes.
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -DskipTests -Dmaven.wagon.http.retryHandler.count=3 dependency:go-offline || true

COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -DskipTests -Dmaven.wagon.http.retryHandler.count=3 clean package

FROM eclipse-temurin:17-jre

WORKDIR /app

# Install OCR + Python runtime (for optional helpers when mounted).
RUN set -eux; \
    for i in 1 2 3; do \
      rm -rf /var/lib/apt/lists/*; \
      apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        python3 \
        python3-pip \
        libgl1 \
        && break; \
      if [ "$i" -eq 3 ]; then exit 1; fi; \
      sleep 5; \
    done; \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENV OCR_TESSERACT_DATAPATH=/usr/share/tesseract-ocr/5/tessdata
ENV OCR_TESSERACT_LANGUAGE=eng

ENTRYPOINT ["java", "-jar", "app.jar"]
