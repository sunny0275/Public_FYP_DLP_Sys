import json
import random
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from google.auth import default as google_auth_default
from google.auth.transport.requests import AuthorizedSession
from google.cloud import storage
import vertexai
from vertexai.tuning import sft


app = FastAPI(title="DLP Vertex Tuning Service")
STATE_FILE = Path(__file__).with_name("tuning-jobs-state.json")
STATE_LOCK = threading.Lock()
# GCS bucket for state file (allows updating state without redeployment)
GCS_STATE_BUCKET = "resonant-amulet-491303-n0-tuning"
GCS_STATE_PATH = "tuning/tuning-jobs-state.json"
DEFAULT_BASE_MODEL = "gemini-2.5-flash"
TERMINAL_STATES = {"JOB_STATE_SUCCEEDED", "JOB_STATE_FAILED", "JOB_STATE_CANCELLED", "JOB_STATE_EXPIRED"}
POLL_SECONDS = 180

import httpx


class TuningRequest(BaseModel):
    projectId: str
    location: str = "us-central1"
    trainingDatasetUri: str  # gs://bucket/path/file.jsonl
    baseModel: Optional[str] = None
    continualTraining: bool = True
    seedTuningJobId: Optional[str] = None
    checkpointId: Optional[str] = None
    # Tuned model display name for the Vertex AI tuning job.
    # Java UEBA service sends "displayName"; Java Classification service sends "tunedModelDisplayName".
    # Accept both so either caller works.
    displayName: Optional[str] = None
    tunedModelDisplayName: Optional[str] = None
    serviceAccount: Optional[str] = None
    kmsKeyName: Optional[str] = None
    autoDeploy: bool = True
    endpointDisplayName: str = "dlp-classification-endpoint"
    deployedModelDisplayName: Optional[str] = None
    machineType: str = "n1-standard-4"
    minReplicaCount: int = 1
    maxReplicaCount: int = 1
    # Callback URL to notify when tuning job completes and endpoint is deployed
    # The backend uses this to refresh its endpoint cache without restart
    callbackUrl: Optional[str] = None
    # API key for the callback endpoint authentication
    callbackApiKey: Optional[str] = None

    def resolved_display_name(self) -> str:
        """Return the display name, preferring displayName over tunedModelDisplayName."""
        return self.displayName or self.tunedModelDisplayName or ""


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _send_callback(callback_url: str, payload: Dict[str, Any], api_key: Optional[str] = None) -> bool:
    """Send a callback to the specified URL with deployment info."""
    if not callback_url:
        return False
    
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["X-Internal-Api-Key"] = api_key
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(callback_url, json=payload, headers=headers)
            if response.status_code == 200:
                print(f"[CALLBACK] Successfully notified backend: {callback_url}")
                return True
            else:
                print(f"[CALLBACK] Failed to notify backend: {callback_url}, status={response.status_code}")
                return False
    except Exception as e:
        print(f"[CALLBACK] Error sending callback to {callback_url}: {e}")
        return False


def _get_gcs_client():
    """Get GCS client with proper credentials."""
    try:
        return storage.Client()
    except Exception:
        return None


def _load_state() -> Dict:
    """Load state from local file, fallback to GCS."""
    # Try local file first
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    
    # Fallback to GCS
    client = _get_gcs_client()
    if client:
        try:
            bucket = client.bucket(GCS_STATE_BUCKET)
            blob = bucket.blob(GCS_STATE_PATH)
            if blob.exists():
                content = blob.download_as_text()
                return json.loads(content)
        except Exception as e:
            print(f"[WARN] Failed to load state from GCS: {e}")
    
    return {"jobs": []}


def _save_state(state: Dict) -> None:
    """Save state to local file and GCS."""
    content = json.dumps(state, ensure_ascii=False, indent=2) + "\n"
    
    # Save to local
    STATE_FILE.write_text(content, encoding="utf-8")
    
    # Save to GCS
    client = _get_gcs_client()
    if client:
        try:
            bucket = client.bucket(GCS_STATE_BUCKET)
            blob = bucket.blob(GCS_STATE_PATH)
            blob.upload_from_text(content)
            print(f"[INFO] State synced to GCS: gs://{GCS_STATE_BUCKET}/{GCS_STATE_PATH}")
        except Exception as e:
            print(f"[WARN] Failed to sync state to GCS: {e}")


def _upsert_job_state(resource_name: str, patch: Dict) -> Dict:
    with STATE_LOCK:
        state = _load_state()
        jobs = state.setdefault("jobs", [])
        target = None
        for item in jobs:
            if item.get("tuningJobResourceName") == resource_name:
                target = item
                break
        if target is None:
            target = {"tuningJobResourceName": resource_name, "createdAt": _utc_now()}
            jobs.append(target)
        target.update(patch)
        target["updatedAt"] = _utc_now()
        _save_state(state)
        return dict(target)


def _latest_success_tuned_model() -> Optional[str]:
    with STATE_LOCK:
        state = _load_state()
    candidates = [
        item for item in state.get("jobs", [])
        if item.get("state") == "JOB_STATE_SUCCEEDED" and item.get("tunedModelName")
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
    return candidates[0].get("tunedModelName")


def _normalize_tuning_job_resource_name(project: str, location: str, job_id_or_name: str) -> str:
    if job_id_or_name.startswith("projects/"):
        return job_id_or_name
    return f"projects/{project}/locations/{location}/tuningJobs/{job_id_or_name}"


def _parse_gcs_uri(gcs_uri: str) -> Tuple[str, str]:
    if not gcs_uri.startswith("gs://"):
        raise ValueError("trainingDatasetUri must start with gs://")
    raw = gcs_uri[len("gs://"):]
    parts = raw.split("/", 1)
    if len(parts) != 2:
        raise ValueError("Invalid gs:// URI format")
    return parts[0], parts[1]


def _download_jsonl_lines(storage_client: storage.Client, gcs_uri: str) -> List[str]:
    bucket_name, blob_name = _parse_gcs_uri(gcs_uri)
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    text = blob.download_as_text(encoding="utf-8")
    return [line for line in text.splitlines() if line.strip()]


def _upload_jsonl_lines(
    storage_client: storage.Client,
    source_uri: str,
    suffix: str,
    lines: List[str],
) -> str:
    bucket_name, blob_name = _parse_gcs_uri(source_uri)
    if "." in blob_name:
        base, ext = blob_name.rsplit(".", 1)
        out_name = f"{base}-{suffix}.{ext}"
    else:
        out_name = f"{blob_name}-{suffix}"

    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(out_name)
    blob.upload_from_string("\n".join(lines), content_type="application/jsonl")
    return f"gs://{bucket_name}/{out_name}"


def _resolve_source_model(req: TuningRequest) -> Tuple[str, str]:
    if req.continualTraining:
        seed_vertex_tuned = _resolve_seed_tuned_model_from_vertex(req)
        if seed_vertex_tuned:
            return seed_vertex_tuned, "VERTEX_SEED_TUNED_MODEL"

        latest_vertex_tuned = _resolve_latest_tuned_model_from_vertex(req)
        if latest_vertex_tuned:
            return latest_vertex_tuned, "VERTEX_LATEST_TUNED_MODEL"

        latest_tuned = _latest_success_tuned_model()
        if latest_tuned:
            return latest_tuned, "LOCAL_STATE_TUNED_MODEL"
    if req.baseModel and req.baseModel.strip():
        return req.baseModel.strip(), "REQUEST_BASE_MODEL"
    return DEFAULT_BASE_MODEL, "DEFAULT_BASE_MODEL"


def _is_model_resource_name(name: Optional[str]) -> bool:
    if not name:
        return False
    return name.startswith("projects/") and "/models/" in name


def _extract_tuned_model_name(value: object) -> str:
    # Vertex may return tunedModel as:
    # 1) string: "projects/.../models/xxx@1"
    # 2) object: {"model":"projects/.../models/xxx@1","endpoint":"..."}
    if isinstance(value, dict):
        model = value.get("model")
        return str(model or "")
    return str(value or "")


def _fetch_tuning_job(session: AuthorizedSession, location: str, job_resource_name: str) -> Dict:
    url = f"https://{location}-aiplatform.googleapis.com/v1/{job_resource_name}"
    response = session.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def _resolve_seed_tuned_model_from_vertex(req: TuningRequest) -> Optional[str]:
    if not req.seedTuningJobId:
        return None
    try:
        session = _authorized_session()
        resource_name = _normalize_tuning_job_resource_name(req.projectId, req.location, req.seedTuningJobId)
        job = _fetch_tuning_job(session, req.location, resource_name)
        state = job.get("state")
        
        # Only use SUCCEEDED jobs, reject CANCELLED/FAILED/PENDING
        if state != "JOB_STATE_SUCCEEDED":
            print(f"[WARN] Seed job {req.seedTuningJobId} state={state}, skipping...")
            return None
            
        tuned = _extract_tuned_model_name(job.get("tunedModel"))
        if _is_model_resource_name(tuned):
            return tuned
    except Exception as e:
        print(f"[WARN] Failed to resolve seed job {req.seedTuningJobId}: {e}")
        return None
    return None


def _resolve_latest_tuned_model_from_vertex(req: TuningRequest) -> Optional[str]:
    try:
        session = _authorized_session()
        base = f"https://{req.location}-aiplatform.googleapis.com/v1/projects/{req.projectId}/locations/{req.location}/tuningJobs"
        page_token = ""
        best_tuned_model = None
        best_timestamp = ""

        while True:
            url = f"{base}?pageSize=100"
            if page_token:
                url += f"&pageToken={page_token}"
            response = session.get(url, timeout=30)
            response.raise_for_status()
            payload = response.json()
            jobs = payload.get("tuningJobs", []) or []

            for job in jobs:
                state = job.get("state", "")
                
                # CRITICAL: Only consider SUCCEEDED jobs
                if state != "JOB_STATE_SUCCEEDED":
                    # Log non-succeeded jobs for debugging
                    if state in ("JOB_STATE_CANCELLED", "JOB_STATE_FAILED"):
                        display_name = job.get("displayName", "unknown")
                        print(f"[DEBUG] Skipping {state} job: {display_name}")
                    continue
                    
                # Filter by displayName if provided (for UEBA-specific jobs)
                display_name = job.get("displayName", "")
                if req.resolved_display_name() and display_name:
                    # Strip version suffix for prefix match: LLM_UEBA_v1 → LLM_UEBA
                    name_for_match = req.resolved_display_name().rsplit("_v", 1)[0] if "_v" in req.resolved_display_name() else req.resolved_display_name()
                    if not display_name.startswith(name_for_match):
                        continue
                        
                tuned_model = _extract_tuned_model_name(job.get("tunedModel"))
                if not _is_model_resource_name(tuned_model):
                    continue
                ts = str(job.get("updateTime", "") or job.get("endTime", "") or job.get("createTime", "") or "")
                if ts > best_timestamp:
                    best_timestamp = ts
                    best_tuned_model = tuned_model

            page_token = payload.get("nextPageToken", "")
            if not page_token:
                break

        return best_tuned_model
    except Exception:
        return None


def _create_continual_tuning_job_rest(
    req: TuningRequest,
    pre_tuned_model_name: str,
    train_uri: str,
    val_uri: str,
) -> Dict:
    credentials, _ = google_auth_default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    session = AuthorizedSession(credentials)
    endpoint = f"https://{req.location}-aiplatform.googleapis.com/v1/projects/{req.projectId}/locations/{req.location}/tuningJobs"

    body: Dict = {
        "preTunedModel": {
            "tunedModelName": pre_tuned_model_name
        },
        "supervisedTuningSpec": {
            "trainingDatasetUri": train_uri,
            "validationDatasetUri": val_uri,
        },
    }
    if req.checkpointId:
        body["preTunedModel"]["checkpointId"] = req.checkpointId
    if req.resolved_display_name():
        body["tunedModelDisplayName"] = req.resolved_display_name()
    if req.serviceAccount:
        body["serviceAccount"] = req.serviceAccount
    if req.kmsKeyName:
        body["encryptionSpec"] = {"kmsKeyName": req.kmsKeyName}

    response = session.post(endpoint, json=body, timeout=60)
    response.raise_for_status()
    return response.json()


def _fetch_tuning_job_status(job_resource_name: str, location: str) -> Dict:
    credentials, _ = google_auth_default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    session = AuthorizedSession(credentials)
    url = f"https://{location}-aiplatform.googleapis.com/v1/{job_resource_name}"
    response = session.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def _authorized_session() -> AuthorizedSession:
    credentials, _ = google_auth_default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    return AuthorizedSession(credentials)


def _poll_operation_done(
    session: AuthorizedSession,
    operation_name: str,
    location: str,
    timeout_seconds: int = 7200,
    interval_seconds: int = 20,
) -> Dict:
    # operation_name can be full resource "projects/.../operations/..."
    op_url = f"https://{location}-aiplatform.googleapis.com/v1/{operation_name}"
    start = time.time()
    while True:
        resp = session.get(op_url, timeout=30)
        resp.raise_for_status()
        op = resp.json()
        if op.get("done"):
            return op
        if time.time() - start > timeout_seconds:
            raise TimeoutError(f"Operation timeout: {operation_name}")
        time.sleep(interval_seconds)


def _find_or_create_endpoint_resource_name(
    session: AuthorizedSession,
    project: str,
    location: str,
    endpoint_display_name: str,
) -> str:
    base = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}"
    filter_expr = quote(f'display_name="{endpoint_display_name}"', safe='=')
    list_url = f"{base}/endpoints?filter={filter_expr}"
    list_resp = session.get(list_url, timeout=30)
    list_resp.raise_for_status()
    listed = list_resp.json()
    endpoints = listed.get("endpoints", [])
    if endpoints:
        return endpoints[0]["name"]

    create_url = f"{base}/endpoints"
    create_body = {"displayName": endpoint_display_name}
    create_resp = session.post(create_url, json=create_body, timeout=30)
    create_resp.raise_for_status()
    op = create_resp.json()
    op_name = op.get("name")
    if not op_name:
        raise RuntimeError(f"Create endpoint missing operation name: {op}")
    done = _poll_operation_done(session, op_name, location=location)
    if done.get("error"):
        raise RuntimeError(f"Create endpoint failed: {done['error']}")
    endpoint = done.get("response", {}).get("name")
    if not endpoint:
        raise RuntimeError(f"Create endpoint operation missing response.name: {done}")
    return endpoint


def _deploy_tuned_model_rest(
    project: str,
    location: str,
    tuned_model_name: str,
    endpoint_display_name: str,
    deployed_model_display_name: str,
    machine_type: str,
    min_replica_count: int,
    max_replica_count: int,
) -> Dict:
    session = _authorized_session()
    endpoint_resource = _find_or_create_endpoint_resource_name(
        session=session,
        project=project,
        location=location,
        endpoint_display_name=endpoint_display_name,
    )
    endpoint_id = endpoint_resource.rsplit("/", 1)[-1]
    deploy_url = (
        f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/"
        f"endpoints/{endpoint_id}:deployModel"
    )
    deploy_body = {
        "deployedModel": {
            "model": tuned_model_name,
            "displayName": deployed_model_display_name,
            "dedicatedResources": {
                "machineSpec": {
                    "machineType": machine_type,
                },
                "minReplicaCount": min_replica_count,
                "maxReplicaCount": max_replica_count,
                "requiredReplicaCount": min_replica_count,
            },
        },
        "trafficSplit": {
            "0": 100
        },
    }
    deploy_resp = session.post(deploy_url, json=deploy_body, timeout=30)
    deploy_resp.raise_for_status()
    op = deploy_resp.json()
    op_name = op.get("name")
    if not op_name:
        raise RuntimeError(f"Deploy model missing operation name: {op}")
    done = _poll_operation_done(session, op_name, location=location)
    if done.get("error"):
        raise RuntimeError(f"Deploy model failed: {done['error']}")
    response = done.get("response", {})
    deployed_model_id = response.get("deployedModel", {}).get("id", "")
    return {
        "deployedEndpointResourceName": endpoint_resource,
        "deployedModelResourceName": tuned_model_name,
        "deployedModelId": deployed_model_id,
        "deployOperationName": op_name,
        "deploymentMode": "REST_DEPLOY_MODEL",
    }


@app.get("/health")
def health() -> Dict:
    return {"ok": True}


@app.get("/jobs/{job_id}")
def job_status(job_id: str) -> Dict:
    resource_name = job_id if job_id.startswith("projects/") else f"projects/-/locations/-/tuningJobs/{job_id}"
    with STATE_LOCK:
        state = _load_state()
    for item in state.get("jobs", []):
        if item.get("tuningJobResourceName") == resource_name or item.get("tuningJobResourceName", "").endswith(f"/{job_id}"):
            return item
    raise HTTPException(status_code=404, detail=f"Job not found in local state: {job_id}")


@app.post("/reconcile/{job_id}")
def reconcile(job_id: str) -> Dict:
    resource_name = job_id if job_id.startswith("projects/") else job_id

    with STATE_LOCK:
        state = _load_state()
        jobs = state.get("jobs", [])

    job_entry: Optional[Dict] = None
    for item in jobs:
        name = item.get("tuningJobResourceName", "")
        if name == resource_name or name.endswith(f"/{job_id}"):
            job_entry = item
            resource_name = name
            break

    if job_entry is None:
        raise HTTPException(status_code=404, detail=f"Job not found in local state: {job_id}")

    # CRITICAL: Verify job is in a valid state before proceeding
    project_id = job_entry.get("projectId")
    location = job_entry.get("location") or "us-central1"
    auto_deploy_enabled = bool(job_entry.get("autoDeploy", False))
    endpoint_display_name = job_entry.get("endpointDisplayName") or "dlp-classification-endpoint"
    machine_type = job_entry.get("machineType") or "n1-standard-4"
    min_replica_count = int(job_entry.get("minReplicaCount", 1))
    max_replica_count = int(job_entry.get("maxReplicaCount", 1))
    job_display_name = job_entry.get("displayName") or job_entry.get("tunedModelDisplayName") or ""

    # CRITICAL: Log which job is being reconciled to avoid confusion
    print(f"[RECONCILE] Processing job: displayName={job_display_name}, endpoint={endpoint_display_name}")

    if not project_id:
        raise HTTPException(status_code=400, detail="Job missing projectId in local state; cannot reconcile")

    try:
        status = _fetch_tuning_job_status(resource_name, location)
        state_name = status.get("state", "JOB_STATE_UNSPECIFIED")
        _upsert_job_state(resource_name, {"state": state_name, "rawStatus": status})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tuning job status: {e}") from e

    deployment_result: Dict[str, Any] = {}
    already_deployed = bool(
        job_entry.get("deployOperationName")
        or job_entry.get("deployedModelId")
        or job_entry.get("deployedEndpointResourceName")
    )

    if state_name in TERMINAL_STATES and state_name == "JOB_STATE_SUCCEEDED" and auto_deploy_enabled and not already_deployed:
        tuned_model_name = ""
        try:
            tuned_model_name = _extract_tuned_model_name(status.get("tunedModel"))
        except Exception:
            tuned_model_name = ""

        if not tuned_model_name:
            try:
                job_ref = sft.SupervisedTuningJob(resource_name)
                tuned_model_name = job_ref.tuned_model_name or ""
            except Exception:
                tuned_model_name = ""

        if tuned_model_name:
            try:
                deploy_name = job_entry.get("deployedModelDisplayName") or f"dlp-auto-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
                # CRITICAL: Log the deployment details for audit trail
                print(f"[DEPLOY] Model={tuned_model_name} -> Endpoint={endpoint_display_name} (displayName={job_display_name})")
                deployment_result = _deploy_tuned_model_rest(
                    project=project_id,
                    location=location,
                    tuned_model_name=tuned_model_name,
                    endpoint_display_name=endpoint_display_name,
                    deployed_model_display_name=deploy_name,
                    machine_type=machine_type,
                    min_replica_count=min_replica_count,
                    max_replica_count=max_replica_count,
                )
                _upsert_job_state(resource_name, {"autoDeploy": True, "tunedModelName": tuned_model_name, **deployment_result})
                
                # Send callback to backend to refresh endpoint cache
                callback_url = job_entry.get("callbackUrl")
                callback_api_key = job_entry.get("callbackApiKey")
                if callback_url and deployment_result.get("endpointId"):
                    endpoint_id = deployment_result.get("endpointId")
                    # Determine prefix based on display name
                    if job_display_name.startswith("LLM_UEBA"):
                        prefix = "LLM_UEBA"
                    elif job_display_name.startswith("LLM_Classification"):
                        prefix = "LLM_Classification"
                    else:
                        prefix = job_display_name
                    
                    callback_payload = {
                        "prefix": prefix,
                        "endpointId": endpoint_id,
                        "displayName": job_display_name,
                        "deployedEndpointResourceName": deployment_result.get("endpointResourceName"),
                        "tuningJobResourceName": resource_name,
                        "state": state_name,
                    }
                    _send_callback(callback_url, callback_payload, callback_api_key)
            except Exception as deploy_error:
                _upsert_job_state(resource_name, {
                    "autoDeploy": False,
                    "deploymentError": str(deploy_error),
                    "tunedModelName": tuned_model_name,
                })
        else:
            _upsert_job_state(resource_name, {
                "autoDeploy": False,
                "deploymentMode": "VERTEX_AUTO_ENDPOINT_ONLY",
                "deploymentError": "No tunedModelName resolved during reconcile; skip explicit deployModel",
            })

    with STATE_LOCK:
        latest = _load_state()
        final_entry: Optional[Dict] = None
        for item in latest.get("jobs", []):
            if item.get("tuningJobResourceName") == resource_name:
                final_entry = item
                break

    return {
        "tuningJobResourceName": resource_name,
        "state": state_name,
        "autoDeployEnabled": auto_deploy_enabled,
        "deploymentAttempted": bool(deployment_result),
        "jobStateSnapshot": final_entry or job_entry,
    }


@app.post("/start")
def start_tuning(req: TuningRequest) -> Dict:
    try:
        storage_client = storage.Client()
        lines = _download_jsonl_lines(storage_client, req.trainingDatasetUri)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset: {e}") from e

    if len(lines) < 10:
        raise HTTPException(
            status_code=400,
            detail="Dataset too small. Need at least 10 examples for a 70/30 split.",
        )

    random.shuffle(lines)
    split_index = max(1, int(len(lines) * 0.7))
    train_lines = lines[:split_index]
    val_lines = lines[split_index:]

    try:
        train_uri = _upload_jsonl_lines(storage_client, req.trainingDatasetUri, "train", train_lines)
        val_uri = _upload_jsonl_lines(storage_client, req.trainingDatasetUri, "val", val_lines)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload split datasets: {e}") from e

    source_model, source_model_strategy = _resolve_source_model(req)
    use_rest_continual = (
        req.continualTraining
        and source_model_strategy in {"VERTEX_SEED_TUNED_MODEL", "VERTEX_LATEST_TUNED_MODEL", "LOCAL_STATE_TUNED_MODEL"}
        and _is_model_resource_name(source_model)
    )
    try:
        if use_rest_continual:
            created = _create_continual_tuning_job_rest(
                req=req,
                pre_tuned_model_name=source_model,
                train_uri=train_uri,
                val_uri=val_uri,
            )
            job_resource_name = created.get("name")
            if not job_resource_name:
                raise RuntimeError(f"tuningJobs.create did not return job name: {created}")
            tuned_model_name = str(created.get("tunedModel", "") or "")
            tuned_endpoint_name = ""
            tuning_method = "REST_PRE_TUNED_MODEL"
        else:
            vertexai.init(project=req.projectId, location=req.location)
            job = sft.train(
                source_model=source_model,
                train_dataset=train_uri,
                validation_dataset=val_uri,
                tuned_model_display_name=req.resolved_display_name() or None,
            )
            job_resource_name = job.resource_name
            tuned_model_name = job.tuned_model_name
            tuned_endpoint_name = job.tuned_model_endpoint_name
            tuning_method = "SDK_SFT_TRAIN"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create tuning job: {e}") from e

    resolved_name = req.resolved_display_name()

    # CRITICAL: Validate displayName is set and follows naming convention
    if not resolved_name:
        raise HTTPException(status_code=400, detail="displayName is required for tuning job")
    if not resolved_name.startswith("LLM_"):
        print(f"[WARN] displayName={resolved_name} doesn't follow LLM_* naming convention")

    print(f"[START] Creating tuning job: displayName={resolved_name}, endpoint={req.endpointDisplayName}")

    _upsert_job_state(job_resource_name, {
        "projectId": req.projectId,
        "location": req.location,
        "state": "JOB_STATE_PENDING",
        "sourceModel": source_model,
        "sourceModelStrategy": source_model_strategy,
        "tuningMethod": tuning_method,
        "continualTraining": req.continualTraining,
        "seedTuningJobId": req.seedTuningJobId,
        "checkpointId": req.checkpointId,
        "displayName": resolved_name,
        "tunedModelDisplayName": resolved_name,
        "serviceAccount": req.serviceAccount,
        "kmsKeyName": req.kmsKeyName,
        "autoDeploy": req.autoDeploy,
        "endpointDisplayName": req.endpointDisplayName,
        "machineType": req.machineType,
        "minReplicaCount": req.minReplicaCount,
        "maxReplicaCount": req.maxReplicaCount,
        "originalDatasetUri": req.trainingDatasetUri,
        "trainDatasetUri": train_uri,
        "validationDatasetUri": val_uri,
        "trainCount": len(train_lines),
        "validationCount": len(val_lines),
        "callbackUrl": req.callbackUrl,
        "callbackApiKey": req.callbackApiKey,
    })

    return {
        "message": "Tuning job started",
        "projectId": req.projectId,
        "location": req.location,
        "sourceModelUsed": source_model,
        "sourceModelStrategy": source_model_strategy,
        "tuningMethod": tuning_method,
        "continualTraining": req.continualTraining,
        "seedTuningJobId": req.seedTuningJobId,
        "checkpointId": req.checkpointId,
        "displayName": resolved_name,
        "tunedModelDisplayName": resolved_name,
        "autoDeploy": req.autoDeploy,
        "endpointDisplayName": req.endpointDisplayName,
        "originalDatasetUri": req.trainingDatasetUri,
        "trainDatasetUri": train_uri,
        "validationDatasetUri": val_uri,
        "split": {
            "trainCount": len(train_lines),
            "validationCount": len(val_lines),
            "ratio": "70/30",
        },
        "tuningJobResourceName": job_resource_name,
        "jobId": job_resource_name.rsplit("/", 1)[-1],
        "tunedModelName": tuned_model_name,
        "tunedEndpointName": tuned_endpoint_name,
    }


@app.get("/latest/{display_name_prefix}")
def get_latest_endpoint(display_name_prefix: str) -> Dict:
    """
    Get the latest SUCCEEDED tuning job and its deployed endpoint for a given display name prefix.
    Example: /latest/LLM_Classification returns the latest LLM_Classification_v* endpoint

    This endpoint allows Java backend to dynamically discover the latest deployed endpoint
    without needing to restart or update environment variables.
    """
    print(f"[LATEST] Looking for displayName prefix: {display_name_prefix}")

    with STATE_LOCK:
        state = _load_state()
        jobs = state.get("jobs", [])

    best_job = None
    best_timestamp = ""
    best_endpoint_id = None

    for job in jobs:
        job_state = job.get("state", "")
        display_name = job.get("displayName") or job.get("tunedModelDisplayName") or ""

        # Check if displayName matches the prefix
        if not display_name.startswith(display_name_prefix):
            continue

        # Only consider SUCCEEDED jobs
        if job_state != "JOB_STATE_SUCCEEDED":
            continue

        # Prefer jobs with deployed endpoint
        endpoint_resource = job.get("deployedEndpointResourceName") or job.get("tunedEndpointName") or ""
        if not endpoint_resource:
            continue

        # Extract endpoint ID
        if "/endpoints/" in endpoint_resource:
            endpoint_id = endpoint_resource.rsplit("/endpoints/", 1)[-1]
        else:
            endpoint_id = None

        if endpoint_id:
            ts = str(job.get("updatedAt") or job.get("createdAt") or "")
            if ts > best_timestamp:
                best_timestamp = ts
                best_job = job
                best_endpoint_id = endpoint_id

    if best_job is None:
        raise HTTPException(
            status_code=404,
            detail=f"No deployed endpoint found for displayName prefix: {display_name_prefix}"
        )

    return {
        "displayName": best_job.get("displayName") or best_job.get("tunedModelDisplayName"),
        "displayNamePrefix": display_name_prefix,
        "jobId": best_job.get("tuningJobResourceName", "").rsplit("/", 1)[-1] if best_job.get("tuningJobResourceName") else None,
        "tunedModelName": best_job.get("tunedModelName") or best_job.get("tunedModel") or best_job.get("tunedModelResourceName") or "",
        "endpointId": best_endpoint_id,
        "endpointResourceName": best_job.get("deployedEndpointResourceName") or best_job.get("tunedEndpointName") or "",
        "state": best_job.get("state"),
        "endTime": best_job.get("endTime") or best_job.get("updatedAt") or "",
        "message": f"Latest deployed endpoint for {display_name_prefix}*"
    }


@app.get("/endpoints")
def list_all_deployed_endpoints() -> Dict:
    """
    List all deployed endpoints from all tuning jobs.
    Returns a map of displayName prefix -> latest deployed endpoint info.
    """
    print("[ENDPOINTS] Listing all deployed endpoints")

    with STATE_LOCK:
        state = _load_state()
        jobs = state.get("jobs", [])

    # Group by displayName prefix (e.g., LLM_Classification, LLM_UEBA)
    endpoint_map: Dict[str, Dict] = {}

    for job in jobs:
        job_state = job.get("state", "")
        if job_state != "JOB_STATE_SUCCEEDED":
            continue

        display_name = job.get("displayName") or job.get("tunedModelDisplayName") or ""
        if not display_name.startswith("LLM_"):
            continue

        # Extract prefix: LLM_Classification_v1 -> LLM_Classification
        prefix = display_name.rsplit("_v", 1)[0] if "_v" in display_name else display_name

        endpoint_resource = job.get("deployedEndpointResourceName") or job.get("tunedEndpointName") or ""
        if not endpoint_resource:
            continue

        if "/endpoints/" in endpoint_resource:
            endpoint_id = endpoint_resource.rsplit("/endpoints/", 1)[-1]
        else:
            continue

        ts = str(job.get("updatedAt") or job.get("createdAt") or "")

        # Only update if this job is newer
        existing = endpoint_map.get(prefix)
        if not existing or ts > existing.get("endTime", ""):
            endpoint_map[prefix] = {
                "displayName": display_name,
                "displayNamePrefix": prefix,
                "jobId": job.get("tuningJobResourceName", "").rsplit("/", 1)[-1] if job.get("tuningJobResourceName") else None,
                "tunedModelName": job.get("tunedModelName") or "",
                "endpointId": endpoint_id,
                "endpointResourceName": endpoint_resource,
                "state": job_state,
                "endTime": ts,
            }

    return {
        "totalPrefixes": len(endpoint_map),
        "endpoints": endpoint_map,
        "timestamp": datetime.now().isoformat()
    }


@app.get("/jobs/{display_name_prefix}")
def list_jobs_by_prefix(display_name_prefix: str) -> Dict:
    """
    List all jobs for a given display name prefix.
    Example: /jobs/LLM_Classification returns all LLM_Classification_v* jobs
    """
    print(f"[JOBS] Listing jobs for displayName prefix: {display_name_prefix}")

    with STATE_LOCK:
        state = _load_state()
        jobs = state.get("jobs", [])

    matching_jobs = []
    for job in jobs:
        display_name = job.get("displayName") or job.get("tunedModelDisplayName") or ""
        if display_name.startswith(display_name_prefix):
            matching_jobs.append({
                "displayName": display_name,
                "jobId": job.get("tuningJobResourceName", "").rsplit("/", 1)[-1] if job.get("tuningJobResourceName") else None,
                "state": job.get("state"),
                "tunedModelName": job.get("tunedModelName") or "",
                "endpointId": job.get("deployedEndpointResourceName", "").rsplit("/", 1)[-1] if job.get("deployedEndpointResourceName") else None,
                "endTime": job.get("endTime") or "",
            })

    return {
        "displayNamePrefix": display_name_prefix,
        "totalJobs": len(matching_jobs),
        "jobs": sorted(matching_jobs, key=lambda x: x.get("endTime", ""), reverse=True)
    }


@app.get("/health")
def health_check() -> Dict:
    """Health check endpoint."""
    with STATE_LOCK:
        state = _load_state()
        jobs = state.get("jobs", [])
    return {"status": "healthy", "totalJobsInState": len(jobs), "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)