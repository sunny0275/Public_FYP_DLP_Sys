"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAuthStore = void 0;
var zustand_1 = require("zustand");
var middleware_1 = require("zustand/middleware");
exports.useAuthStore = (0, zustand_1.create)()((0, middleware_1.persist)(function (set) { return ({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    refreshToken: null,
    theme: 'light',
    setAuth: function (user, accessToken, refreshToken) {
        // Tokens are now ONLY stored in Zustand persist (not separately in localStorage)
        set({ isAuthenticated: true, user: user, accessToken: accessToken, refreshToken: refreshToken });
    },
    clearAuth: function () {
        var _a;
        // Clean up any legacy tokens in localStorage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        // Clear Electron accountId for security event reporting
        if (typeof window !== 'undefined' && ((_a = window.electronAPI) === null || _a === void 0 ? void 0 : _a.setAccountId)) {
            window.electronAPI.setAccountId('');
        }
        set({ isAuthenticated: false, user: null, accessToken: null, refreshToken: null });
    },
    updateUser: function (updatedUser) {
        set(function (state) { return ({
            user: state.user ? __assign(__assign({}, state.user), updatedUser) : updatedUser
        }); });
    },
    setTheme: function (theme) {
        set({ theme: theme });
        document.documentElement.setAttribute('data-theme', theme);
    }
}); }, {
    name: 'auth-storage',
    partialize: function (state) { return ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        theme: state.theme
    }); }
}));
