"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = UploadPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var pdf_lib_1 = require("pdf-lib");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
var DashboardLayout_1 = require("../../components/DashboardLayout");
var compression_1 = require("../../utils/compression");
function UploadPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, authStore_1.useAuthStore)(), user = _a.user, theme = _a.theme;
    var _b = (0, react_1.useState)(null), file = _b[0], setFile = _b[1];
    var _c = (0, react_1.useState)(''), department = _c[0], setDepartment = _c[1];
    var _d = (0, react_1.useState)(''), classificationLevel = _d[0], setClassificationLevel = _d[1];
    var _e = (0, react_1.useState)(''), description = _e[0], setDescription = _e[1];
    var _f = (0, react_1.useState)(false), uploading = _f[0], setUploading = _f[1];
    var _g = (0, react_1.useState)(0), uploadProgress = _g[0], setUploadProgress = _g[1];
    var _h = (0, react_1.useState)(''), error = _h[0], setError = _h[1];
    var _j = (0, react_1.useState)(null), jobId = _j[0], setJobId = _j[1];
    var _k = (0, react_1.useState)(''), jobStatus = _k[0], setJobStatus = _k[1];
    var _l = (0, react_1.useState)(''), currentStep = _l[0], setCurrentStep = _l[1];
    var _m = (0, react_1.useState)(''), uploadMessage = _m[0], setUploadMessage = _m[1];
    var lastPolledStatusRef = (0, react_1.useRef)('');
    (0, react_1.useEffect)(function () {
        loadOptions();
    }, []);
    (0, react_1.useEffect)(function () {
        if (jobId) {
            var interval_1 = setInterval(pollJobStatus, 2000);
            return function () { return clearInterval(interval_1); };
        }
    }, [jobId]);
    var loadOptions = function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            try {
                // Set default department to user's department
                if (user === null || user === void 0 ? void 0 : user.department) {
                    setDepartment(user.department);
                }
            }
            catch (err) {
                console.error('Failed to load options:', err);
            }
            return [2 /*return*/];
        });
    }); };
    var pollJobStatus = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, job_1, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!jobId)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.getUploadJobStatus(jobId)];
                case 2:
                    response = _a.sent();
                    job_1 = response.data;
                    if (lastPolledStatusRef.current !== job_1.status) {
                        console.log('[Upload] Job status transition', {
                            jobId: job_1.id,
                            from: lastPolledStatusRef.current || 'N/A',
                            to: job_1.status,
                            progress: job_1.progress,
                            currentStep: job_1.currentStep,
                            reason: job_1.classificationReason,
                            errorMessage: job_1.errorMessage
                        });
                        lastPolledStatusRef.current = job_1.status;
                    }
                    setJobStatus(job_1.status);
                    setCurrentStep(job_1.currentStep || '');
                    setUploadProgress(function (prev) { return Math.max(prev, job_1.progress || 0); });
                    if (job_1.status === 'COMPLETED' || job_1.status === 'FAILED' || job_1.status === 'REVIEW_REQUIRED') {
                        // Frontend log: upload + backend processing finished (success/failure/review required)
                        console.log('[Upload] Job completed', {
                            jobId: job_1.id,
                            documentId: job_1.documentId,
                            status: job_1.status,
                            errorMessage: job_1.errorMessage
                        });
                        setUploading(false);
                        setTimeout(function () {
                            navigate("/upload/result/".concat(job_1.id));
                        }, 500);
                    }
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    console.error('[Upload] Failed to poll job status', { jobId: jobId, err: err_1 });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleFileChange = function (e) {
        var _a;
        var selectedFile = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };
    var handleSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var maxSize, allowedTypes, uploadFile, result, savedMb, compressedMb, compressionError_1, formData, response, job, savedMb, compressedMb, err_2;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    e.preventDefault();
                    setError('');
                    // Validation
                    if (!file) {
                        setError('Please select a file');
                        return [2 /*return*/];
                    }
                    if (!department) {
                        setError('Your account has no department assigned. Please contact admin.');
                        return [2 /*return*/];
                    }
                    if (!classificationLevel) {
                        setError('Please select a classification level');
                        return [2 /*return*/];
                    }
                    maxSize = 500 * 1024 * 1024;
                    if (file.size > maxSize) {
                        setError('File size exceeds 500MB limit');
                        return [2 /*return*/];
                    }
                    allowedTypes = ['application/pdf'];
                    if (file.type && !allowedTypes.includes(file.type)) {
                        setError('File type not allowed. Only PDF files are accepted.');
                        return [2 /*return*/];
                    }
                    setUploading(true);
                    setUploadProgress(0);
                    setUploadMessage('');
                    setJobStatus('UPLOADING');
                    setCurrentStep('UPLOADING');
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 8, , 9]);
                    uploadFile = file;
                    if (!(0, compression_1.shouldCompress)(file)) return [3 /*break*/, 6];
                    setJobStatus('COMPRESSING');
                    setCurrentStep('COMPRESSING');
                    setUploadMessage("Large file detected (".concat((0, compression_1.formatBytes)(file.size), "). Compressing with gzip before upload..."));
                    _e.label = 2;
                case 2:
                    _e.trys.push([2, 4, , 6]);
                    return [4 /*yield*/, (0, compression_1.compressFileForUpload)(file)];
                case 3:
                    result = _e.sent();
                    uploadFile = result.file;
                    if (result.compressedSize < file.size) {
                        savedMb = ((file.size - result.compressedSize) / 1024 / 1024).toFixed(2);
                        compressedMb = (result.compressedSize / 1024 / 1024).toFixed(2);
                        setUploadMessage("Compressed to ".concat(compressedMb, " MB (saved ").concat(savedMb, " MB). Ready to upload..."));
                    }
                    return [3 /*break*/, 6];
                case 4:
                    compressionError_1 = _e.sent();
                    console.warn('[Upload] Gzip compression failed, trying PDF optimization:', compressionError_1);
                    // Fallback to pdf-lib optimization if pako fails
                    setUploadMessage('Optimizing PDF structure before upload...');
                    return [4 /*yield*/, compressPdfBeforeUpload(file)];
                case 5:
                    uploadFile = _e.sent();
                    return [3 /*break*/, 6];
                case 6:
                    console.log('[Upload] Submitting upload request', {
                        fileName: uploadFile.name,
                        fileType: uploadFile.type,
                        fileSizeBytes: uploadFile.size,
                        selectedClassification: classificationLevel,
                        department: department
                    });
                    formData = new FormData();
                    formData.append('file', uploadFile);
                    // Department is derived from current user on backend
                    if (description)
                        formData.append('description', description);
                    formData.append('classificationLevel', classificationLevel);
                    setJobStatus('UPLOADING');
                    setCurrentStep('UPLOADING');
                    return [4 /*yield*/, api_1.apiClient.uploadDocument(formData, function (percent) {
                            // Reserve higher range for backend async processing progress.
                            setUploadProgress(Math.min(percent, 25));
                        })];
                case 7:
                    response = _e.sent();
                    job = response.data;
                    // Backend accepted the upload and created an upload job; log basic info and temporary file path
                    console.log('[Upload] Request accepted by backend', {
                        jobId: job.id,
                        status: job.status,
                        storedPath: job.filePath
                    });
                    setJobId(job.id);
                    setJobStatus(job.status);
                    setCurrentStep(job.currentStep || 'UPLOADING');
                    lastPolledStatusRef.current = job.status;
                    setUploadProgress(function (prev) { return Math.max(prev, 10); });
                    if (uploadFile.size < file.size) {
                        savedMb = ((file.size - uploadFile.size) / 1024 / 1024).toFixed(2);
                        compressedMb = (uploadFile.size / 1024 / 1024).toFixed(2);
                        setUploadMessage("Compressed to ".concat(compressedMb, " MB (saved ").concat(savedMb, " MB). Backend processing started..."));
                    }
                    else {
                        setUploadMessage('Upload completed. Backend processing started...');
                    }
                    return [3 /*break*/, 9];
                case 8:
                    err_2 = _e.sent();
                    console.error('[Upload] Upload request failed', {
                        backendMessage: (_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message,
                        err: err_2
                    });
                    setError(((_d = (_c = err_2.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || 'Failed to upload document');
                    setUploading(false);
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    }); };
    var compressPdfBeforeUpload = function (inputFile) { return __awaiter(_this, void 0, void 0, function () {
        var raw, pdfDoc, compressed, compressedBuffer, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, inputFile.arrayBuffer()];
                case 1:
                    raw = _a.sent();
                    return [4 /*yield*/, pdf_lib_1.PDFDocument.load(raw, {
                            updateMetadata: false,
                            ignoreEncryption: true
                        })];
                case 2:
                    pdfDoc = _a.sent();
                    return [4 /*yield*/, pdfDoc.save({
                            useObjectStreams: true,
                            addDefaultPage: false
                        })
                        // Keep original file when compression is not beneficial.
                    ];
                case 3:
                    compressed = _a.sent();
                    // Keep original file when compression is not beneficial.
                    if (compressed.byteLength >= inputFile.size * 0.98) {
                        setUploadMessage('Compression finished, but no meaningful size reduction. Uploading original PDF...');
                        return [2 /*return*/, inputFile];
                    }
                    compressedBuffer = new Uint8Array(compressed).buffer;
                    return [2 /*return*/, new File([compressedBuffer], inputFile.name, {
                            type: 'application/pdf',
                            lastModified: Date.now()
                        })];
                case 4:
                    err_3 = _a.sent();
                    console.warn('[Upload] PDF compression failed, fallback to original file', err_3);
                    setUploadMessage('Unable to compress this PDF. Uploading original file...');
                    return [2 /*return*/, inputFile];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleCancel = function () {
        navigate('/documents');
    };
    var humanize = function (value) {
        if (!value)
            return '—';
        return value
            .split('_')
            .filter(Boolean)
            .map(function (s) { return s.charAt(0) + s.slice(1).toLowerCase(); })
            .join(' ');
    };
    return (<DashboardLayout_1.default>
      <div className="dashboard">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1>Upload Document</h1>
          <p style={{ color: '#888', marginBottom: '24px' }}>
            Upload a document to the DLP Platform. AI will re-classify and compare with your selected level.
          </p>

          {!uploading ? (<form onSubmit={handleSubmit} className="dashboard-card">
              {error && (<div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>)}

              {/* File Selection */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  File <span style={{ color: '#ff6b6b' }}>*</span>
                </label>
                <input type="file" accept=".pdf,application/pdf" onChange={handleFileChange} style={{
                padding: '10px',
                width: '100%',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000'
            }}/>
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#999' }}>
                  Acceptable file types: PDF only
                </div>
                {file && (<div style={{ marginTop: '8px', fontSize: '0.9em', color: '#888' }}>
                    Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </div>)}
              </div>

              {/* Department (auto) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Department (auto)
                </label>
                <input type="text" value={department || ''} readOnly style={{
                padding: '10px',
                width: '100%',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
                background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
                color: theme === 'dark' ? '#fff' : '#000'
            }}/>
              </div>

              {/* Classification Level (Required) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Classification Level <span style={{ color: '#ff6b6b' }}>*</span>
                </label>
                <select value={classificationLevel} onChange={function (e) { return setClassificationLevel(e.target.value); }} style={{
                padding: '10px',
                width: '100%',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000'
            }} required>
                  <option value="">Select classification level</option>
                  <option value="PUBLIC">Public</option>
                  <option value="INTERNAL">Internal</option>
                  <option value="CONFIDENTIAL">Confidential</option>
                  <option value="STRICTLY_CONFIDENTIAL">Strictly Confidential</option>
                </select>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                  AI will classify again and compare to your selection. If mismatch, you must re-label.
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Description (Optional)
                </label>
                <textarea value={description} onChange={function (e) { return setDescription(e.target.value); }} placeholder="Enter document description" maxLength={2000} rows={4} style={{
                padding: '10px',
                width: '100%',
                borderRadius: '4px',
                border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
                background: theme === 'dark' ? '#2a2a2a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
                fontFamily: 'inherit',
                resize: 'vertical'
            }}/>
              </div>

              {/* Tags are auto-generated by LLM + rule detection now (no manual tag selection) */}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={handleCancel} style={{ padding: '10px 20px', background: '#6c757d' }}>
                  Cancel
                </button>
                <button type="submit" disabled={uploading} style={{ padding: '10px 20px', background: '#007bff' }}>
                  📤 Upload
                </button>
              </div>
            </form>) : (<div className="dashboard-card">
              <h3>Upload in Progress</h3>
              <div style={{ marginTop: '20px' }}>
                <div style={{
                height: '30px',
                background: theme === 'dark' ? '#333' : '#e0e0e0',
                borderRadius: '15px',
                overflow: 'hidden',
                marginBottom: '12px',
                position: 'relative'
            }}>
                  <div style={{
                height: '100%',
                width: "".concat(uploadProgress, "%"),
                background: 'linear-gradient(90deg, #007bff, #0056b3)',
                transition: 'width 0.3s ease',
            }}/>
                  <div style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '12px',
                fontWeight: 600,
                color: theme === 'dark' ? '#ddd' : '#555'
            }}>
                    {uploadProgress}%
                  </div>
                </div>
                <div style={{ textAlign: 'center', fontSize: '0.9em', color: '#888' }}>
                  Status: {humanize(jobStatus)}
                  {currentStep ? " | Step: ".concat(humanize(currentStep)) : ''}
                </div>
                {uploadMessage && (<div style={{ textAlign: 'center', fontSize: '0.8em', color: '#888', marginTop: '6px' }}>
                    {uploadMessage}
                  </div>)}
                {jobStatus === 'COMPLETED' && (<div style={{ marginTop: '16px', padding: '12px', background: '#4caf5033', borderRadius: '6px', color: '#4caf50', textAlign: 'center' }}>
                    ✓ Upload completed! Redirecting to document...
                  </div>)}
                {jobStatus === 'REVIEW_REQUIRED' && (<div style={{ marginTop: '16px', padding: '12px', background: '#ff980033', borderRadius: '6px', color: '#ff9800', textAlign: 'center' }}>
                    ⚠ Document requires manual review. Redirecting to documents list...
                  </div>)}
              </div>
            </div>)}
        </div>
      </div>
    </DashboardLayout_1.default>);
}
