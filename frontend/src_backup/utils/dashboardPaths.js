"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPreferredDashboardPath = getPreferredDashboardPath;
function getPreferredDashboardPath(user) {
    var _a;
    if ((_a = user === null || user === void 0 ? void 0 : user.roles) === null || _a === void 0 ? void 0 : _a.includes('ADMIN')) {
        return '/dashboard/admin';
    }
    return '/dashboard';
}
