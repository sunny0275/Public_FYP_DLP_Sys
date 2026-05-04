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
exports.default = PDFViewer;
var react_1 = require("react");
var pdfjsLib = require("pdfjs-dist");
// Configure PDF.js worker - use unpkg CDN (more reliable than local file)
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@".concat(pdfjsLib.version, "/build/pdf.worker.min.mjs");
}
var RESIZE_DEBOUNCE_MS = 200;
/**
 * PDF viewer using PDF.js with responsive fit-to-window scaling.
 * Scale is derived from container size (ResizeObserver + debounce); no fixed px width.
 */
function PDFViewer(_a) {
    var _this = this;
    var blob = _a.blob, allowPrint = _a.allowPrint, onRenderComplete = _a.onRenderComplete, _b = _a.footerHeight, footerHeight = _b === void 0 ? 0 : _b;
    var containerRef = (0, react_1.useRef)(null);
    var canvasRefs = (0, react_1.useRef)({});
    var _c = (0, react_1.useState)(true), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)(null), error = _d[0], setError = _d[1];
    var _e = (0, react_1.useState)(0), totalPages = _e[0], setTotalPages = _e[1];
    var _f = (0, react_1.useState)(1), computedScale = _f[0], setComputedScale = _f[1];
    var _g = (0, react_1.useState)(1), userZoomFactor = _g[0], setUserZoomFactor = _g[1];
    var pdfDocRef = (0, react_1.useRef)(null);
    var firstPageRef = (0, react_1.useRef)(null);
    var resizeTimeoutRef = (0, react_1.useRef)(null);
    var renderTasksRef = (0, react_1.useRef)({});
    var renderCycleRef = (0, react_1.useRef)(0);
    var A4_TARGET_WIDTH_PX = 794;
    var FULLSCREEN_TARGET_WIDTH_PX = 1080;
    var baseScale = computedScale;
    var scale = baseScale * userZoomFactor;
    var renderAllPages = (0, react_1.useCallback)(function (currentScale) { return __awaiter(_this, void 0, void 0, function () {
        var currentCycle, pageNum, page, canvas, context, viewport, prevTask, renderTask, err_1, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!pdfDocRef.current || totalPages <= 0)
                        return [2 /*return*/];
                    currentCycle = ++renderCycleRef.current;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 10, , 11]);
                    pageNum = 1;
                    _a.label = 2;
                case 2:
                    if (!(pageNum <= totalPages)) return [3 /*break*/, 9];
                    if (currentCycle !== renderCycleRef.current)
                        return [2 /*return*/];
                    return [4 /*yield*/, pdfDocRef.current.getPage(pageNum)];
                case 3:
                    page = _a.sent();
                    canvas = canvasRefs.current[pageNum];
                    if (!canvas)
                        return [3 /*break*/, 8];
                    context = canvas.getContext('2d');
                    if (!context)
                        return [3 /*break*/, 8];
                    viewport = page.getViewport({ scale: currentScale });
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    canvas.style.width = "".concat(viewport.width, "px");
                    canvas.style.height = "".concat(viewport.height, "px");
                    prevTask = renderTasksRef.current[pageNum];
                    if (prevTask) {
                        try {
                            prevTask.cancel();
                        }
                        catch (_b) {
                            // no-op
                        }
                    }
                    renderTask = page.render({
                        canvasContext: context,
                        viewport: viewport
                    });
                    renderTasksRef.current[pageNum] = renderTask;
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, 7, 8]);
                    return [4 /*yield*/, renderTask.promise];
                case 5:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 6:
                    err_1 = _a.sent();
                    if ((err_1 === null || err_1 === void 0 ? void 0 : err_1.name) === 'RenderingCancelledException') {
                        return [2 /*return*/];
                    }
                    throw err_1;
                case 7:
                    if (renderTasksRef.current[pageNum] === renderTask) {
                        delete renderTasksRef.current[pageNum];
                    }
                    return [7 /*endfinally*/];
                case 8:
                    pageNum++;
                    return [3 /*break*/, 2];
                case 9:
                    if (currentCycle === renderCycleRef.current) {
                        onRenderComplete === null || onRenderComplete === void 0 ? void 0 : onRenderComplete();
                    }
                    return [3 /*break*/, 11];
                case 10:
                    err_2 = _a.sent();
                    if ((err_2 === null || err_2 === void 0 ? void 0 : err_2.name) === 'RenderingCancelledException')
                        return [2 /*return*/];
                    console.error('Error rendering page:', err_2);
                    setError(err_2.message || 'Failed to render page');
                    return [3 /*break*/, 11];
                case 11: return [2 /*return*/];
            }
        });
    }); }, [onRenderComplete, totalPages]);
    var computeScaleFromContainer = (0, react_1.useCallback)(function () {
        var container = containerRef.current;
        var page = firstPageRef.current;
        if (!container || !page)
            return;
        var containerWidth = container.clientWidth;
        if (containerWidth <= 0)
            return;
        var baseViewport = page.getViewport({ scale: 1 });
        var pageWidth = baseViewport.width;
        // Keep A4-like width normally; allow larger adaptive width in fullscreen.
        var usableWidth = Math.max(320, containerWidth - 40);
        var isFullscreenMode = !!document.fullscreenElement;
        var targetCap = isFullscreenMode ? FULLSCREEN_TARGET_WIDTH_PX : A4_TARGET_WIDTH_PX;
        var targetWidth = Math.min(targetCap, usableWidth);
        var newScale = Math.max(0.5, Math.min(targetWidth / pageWidth, 3));
        setComputedScale(newScale);
    }, []);
    (0, react_1.useEffect)(function () {
        var isMounted = true;
        var loadPDF = function () { return __awaiter(_this, void 0, void 0, function () {
            var _i, _a, task, arrayBuffer, pdf, firstPage, err_3;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 4, , 5]);
                        // Invalidate/cancel any in-flight renders from previous document blob.
                        renderCycleRef.current++;
                        for (_i = 0, _a = Object.values(renderTasksRef.current); _i < _a.length; _i++) {
                            task = _a[_i];
                            try {
                                (_b = task === null || task === void 0 ? void 0 : task.cancel) === null || _b === void 0 ? void 0 : _b.call(task);
                            }
                            catch (_d) {
                                // no-op
                            }
                        }
                        renderTasksRef.current = {};
                        setLoading(true);
                        setError(null);
                        return [4 /*yield*/, blob.arrayBuffer()];
                    case 1:
                        arrayBuffer = _c.sent();
                        return [4 /*yield*/, pdfjsLib.getDocument({ data: arrayBuffer }).promise];
                    case 2:
                        pdf = _c.sent();
                        if (!isMounted)
                            return [2 /*return*/];
                        pdfDocRef.current = pdf;
                        setTotalPages(pdf.numPages);
                        return [4 /*yield*/, pdf.getPage(1)];
                    case 3:
                        firstPage = _c.sent();
                        firstPageRef.current = firstPage;
                        if (!isMounted)
                            return [2 /*return*/];
                        setLoading(false);
                        return [3 /*break*/, 5];
                    case 4:
                        err_3 = _c.sent();
                        console.error('Error loading PDF:', err_3);
                        if (isMounted) {
                            setError(err_3.message || 'Failed to load PDF');
                            setLoading(false);
                        }
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        loadPDF();
        return function () {
            var _a;
            isMounted = false;
            renderCycleRef.current++;
            for (var _i = 0, _b = Object.values(renderTasksRef.current); _i < _b.length; _i++) {
                var task = _b[_i];
                try {
                    (_a = task === null || task === void 0 ? void 0 : task.cancel) === null || _a === void 0 ? void 0 : _a.call(task);
                }
                catch (_c) {
                    // no-op
                }
            }
            renderTasksRef.current = {};
        };
    }, [blob]);
    (0, react_1.useEffect)(function () {
        if (loading || totalPages === 0 || !firstPageRef.current)
            return;
        computeScaleFromContainer();
    }, [loading, totalPages, computeScaleFromContainer]);
    (0, react_1.useEffect)(function () {
        var container = containerRef.current;
        if (!container)
            return;
        var scheduleResize = function () {
            if (resizeTimeoutRef.current)
                clearTimeout(resizeTimeoutRef.current);
            resizeTimeoutRef.current = setTimeout(function () {
                resizeTimeoutRef.current = null;
                computeScaleFromContainer();
            }, RESIZE_DEBOUNCE_MS);
        };
        var ro = new ResizeObserver(function () { return scheduleResize(); });
        ro.observe(container);
        return function () {
            ro.disconnect();
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
                resizeTimeoutRef.current = null;
            }
        };
    }, [computeScaleFromContainer]);
    (0, react_1.useEffect)(function () {
        var handleFullscreenChange = function () { return computeScaleFromContainer(); };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return function () { return document.removeEventListener('fullscreenchange', handleFullscreenChange); };
    }, [computeScaleFromContainer]);
    (0, react_1.useEffect)(function () {
        if (pdfDocRef.current && totalPages > 0) {
            renderAllPages(scale);
        }
    }, [scale, totalPages, renderAllPages]);
    var zoomIn = function () {
        setUserZoomFactor(function (prev) { return Math.min(prev + 0.25, 3); });
    };
    var zoomOut = function () {
        setUserZoomFactor(function (prev) { return Math.max(prev - 0.25, 0.5); });
    };
    (0, react_1.useEffect)(function () {
        var handleContextMenu = function (e) {
            e.preventDefault();
            return false;
        };
        var container = containerRef.current;
        if (container) {
            container.addEventListener('contextmenu', handleContextMenu);
            return function () { return container.removeEventListener('contextmenu', handleContextMenu); };
        }
    }, []);
    (0, react_1.useEffect)(function () {
        if (!allowPrint) {
            var handleBeforePrint_1 = function (e) {
                e.preventDefault();
                alert('Printing is disabled');
                return false;
            };
            var handleKeyDown_1 = function (e) {
                if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                    e.preventDefault();
                    alert('Printing is disabled');
                    return false;
                }
            };
            window.addEventListener('beforeprint', handleBeforePrint_1);
            window.addEventListener('keydown', handleKeyDown_1);
            return function () {
                window.removeEventListener('beforeprint', handleBeforePrint_1);
                window.removeEventListener('keydown', handleKeyDown_1);
            };
        }
    }, [allowPrint]);
    if (loading) {
        return (<div style={{ padding: '60px', textAlign: 'center', fontSize: '18px', color: '#666' }}>
        <div style={{ marginBottom: '16px' }}>⏳</div>
        Loading PDF...
      </div>);
    }
    if (error) {
        return (<div style={{ padding: '60px', textAlign: 'center', fontSize: '16px', color: '#f44336' }}>
        <div style={{ marginBottom: '16px' }}>⚠️</div>
        Error: {error}
      </div>);
    }
    return (<div ref={containerRef} className="pdf-viewer-container" style={{
            position: 'relative',
            width: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            background: '#525252',
            padding: '20px',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            WebkitTouchCallout: 'none',
            touchAction: 'none'
        }} onContextMenu={function (e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }} onDragStart={function (e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }}>
      <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '16px',
            padding: '12px',
            background: '#424242',
            borderRadius: '8px',
            color: 'white'
        }}>
        <span style={{ minWidth: '160px', textAlign: 'center' }}>
          Continuous Scroll • {totalPages} page(s)
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={zoomOut} style={{
            padding: '8px 12px',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        }}>
            −
          </button>
          <span style={{ minWidth: '60px', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} style={{
            padding: '8px 12px',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        }}>
            +
          </button>
        </div>
      </div>

      <div className="pdf-preview-wrapper" style={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            width: '100%',
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            background: '#525252',
            paddingBottom: footerHeight ? "".concat(footerHeight, "px") : '0'
        }}>
        <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
        }}>
          {Array.from({ length: totalPages }, function (_, i) { return i + 1; }).map(function (pageNum) { return (<canvas key={pageNum} ref={function (el) {
                canvasRefs.current[pageNum] = el;
            }} className="document-page" style={{
                display: 'block',
                maxWidth: '100%',
                height: 'auto',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                background: 'white',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                pointerEvents: 'auto'
            }} onContextMenu={function (e) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }} onDragStart={function (e) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }}/>); })}
        </div>
      </div>
    </div>);
}
