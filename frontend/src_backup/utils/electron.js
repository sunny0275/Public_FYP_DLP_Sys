"use strict";
/**
 * Electron API utilities
 * Wrapper helpers for communicating with the Electron main process (when running as desktop app)
 */
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
exports.setupRecordingStopListener = exports.setupRecordingStartListener = exports.setupScreenshotBlockedListener = exports.setupSuspiciousActivityListener = exports.getUserDataPath = exports.getAppVersion = exports.isElectron = void 0;
var isElectron = function () {
    return typeof window !== 'undefined' && window.electronAPI !== undefined;
};
exports.isElectron = isElectron;
var getAppVersion = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!((0, exports.isElectron)() && window.electronAPI)) return [3 /*break*/, 2];
                return [4 /*yield*/, window.electronAPI.getAppVersion()];
            case 1: return [2 /*return*/, _a.sent()];
            case 2: return [2 /*return*/, 'web'];
        }
    });
}); };
exports.getAppVersion = getAppVersion;
var getUserDataPath = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!((0, exports.isElectron)() && window.electronAPI)) return [3 /*break*/, 2];
                return [4 /*yield*/, window.electronAPI.getUserDataPath()];
            case 1: return [2 /*return*/, _a.sent()];
            case 2: return [2 /*return*/, ''];
        }
    });
}); };
exports.getUserDataPath = getUserDataPath;
// Listen for system-level suspicious activity (desktop app only)
var setupSuspiciousActivityListener = function (callback) {
    if ((0, exports.isElectron)() && window.electronAPI) {
        window.electronAPI.onSuspiciousActivity(callback);
        // Return cleanup function
        return function () {
            if (window.electronAPI) {
                window.electronAPI.removeSuspiciousActivityListener();
            }
        };
    }
    return function () { };
};
exports.setupSuspiciousActivityListener = setupSuspiciousActivityListener;
// Listen for screenshot blocked events - HIGH SEVERITY (desktop app only)
var setupScreenshotBlockedListener = function (callback) {
    if ((0, exports.isElectron)() && window.electronAPI) {
        window.electronAPI.onScreenshotBlocked(callback);
        // Return cleanup function
        return function () {
            if (window.electronAPI) {
                window.electronAPI.removeScreenshotBlockedListener();
            }
        };
    }
    return function () { };
};
exports.setupScreenshotBlockedListener = setupScreenshotBlockedListener;
// Listen for recording start events (desktop app only)
var setupRecordingStartListener = function (callback) {
    if ((0, exports.isElectron)() && window.electronAPI) {
        window.electronAPI.onRecordingStart(callback);
        return function () {
            if (window.electronAPI) {
                window.electronAPI.removeRecordingStartListener();
            }
        };
    }
    return function () { };
};
exports.setupRecordingStartListener = setupRecordingStartListener;
// Listen for recording stop events (desktop app only)
var setupRecordingStopListener = function (callback) {
    if ((0, exports.isElectron)() && window.electronAPI) {
        window.electronAPI.onRecordingStop(callback);
        return function () {
            if (window.electronAPI) {
                window.electronAPI.removeRecordingStopListener();
            }
        };
    }
    return function () { };
};
exports.setupRecordingStopListener = setupRecordingStopListener;
