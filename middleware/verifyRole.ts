import { NextFunction, Response } from "express";
import { Role } from "../generated/prisma";
import { AuthRequest } from "./verifyToken";
import { config } from "../config/constant";

interface RoleConfig {
	apps: string[];
	modules: string[];
	actions: string[];
}

const roleHierarchy: Record<string, RoleConfig> = {
	superadmin: {
		apps: ["*"],
		modules: ["*"],
		actions: ["*"],
	},
	admin: {
		apps: ["*"],
		modules: ["*"],
		actions: [
			config.ACTION.CREATE,
			config.ACTION.READ,
			config.ACTION.UPDATE,
			config.ACTION.DELETE,
			config.ACTION.CUSTOM,
		],
	},
	hms_frontdesk_user: {
		apps: [config.TYPE.HMS],
		modules: [config.MODULES.FRONT_DESK],
		actions: [
			config.ACTION.CREATE,
			config.ACTION.READ,
			config.ACTION.UPDATE,
			config.ACTION.DELETE,
			config.ACTION.CUSTOM,
		],
	},
	hms_frontdesk_viewer: {
		apps: [config.TYPE.HMS],
		modules: [config.MODULES.FRONT_DESK],
		actions: [config.ACTION.READ],
	},
	hms_frontdesk_admin: {
		apps: [config.TYPE.HMS],
		modules: [config.MODULES.FRONT_DESK],
		actions: [
			config.ACTION.CREATE,
			config.ACTION.READ,
			config.ACTION.UPDATE,
			config.ACTION.DELETE,
			config.ACTION.CUSTOM,
		],
	},
	hms_reservation_user: {
		apps: [config.TYPE.HMS],
		modules: [config.MODULES.RESERVATION],
		actions: [
			config.ACTION.CREATE,
			config.ACTION.READ,
			config.ACTION.UPDATE,
			config.ACTION.DELETE,
			config.ACTION.CUSTOM,
		],
	},
	hms_reservation_viewer: {
		apps: [config.TYPE.HMS],
		modules: [config.MODULES.RESERVATION],
		actions: [config.ACTION.READ],
	},
	hms_reservation_admin: {
		apps: [config.TYPE.HMS],
		modules: [config.MODULES.RESERVATION],
		actions: [
			config.ACTION.CREATE,
			config.ACTION.READ,
			config.ACTION.UPDATE,
			config.ACTION.DELETE,
			config.ACTION.CUSTOM,
		],
	},
	dms_ttlock_user: {
		apps: [config.TYPE.DMS],
		modules: [config.MODULES.TTLOCK],
		actions: [
			config.ACTION.CREATE,
			config.ACTION.READ,
			config.ACTION.UPDATE,
			config.ACTION.DELETE,
			config.ACTION.CUSTOM,
		],
	},
	dms_ttlock_viewer: {
		apps: [config.TYPE.DMS],
		modules: [config.MODULES.TTLOCK],
		actions: [config.ACTION.READ],
	},
	dms_ttlock_admin: {
		apps: [config.TYPE.DMS],
		modules: [config.MODULES.TTLOCK],
		actions: [
			config.ACTION.CREATE,
			config.ACTION.READ,
			config.ACTION.UPDATE,
			config.ACTION.DELETE,
			config.ACTION.CUSTOM,
		],
	},
};

const verifyRole = (app: string, module: string, action: string) => {
	return (req: AuthRequest, res: Response, next: NextFunction) => {
		const userRoles = req.role ? [req.role] : [];

		if (userRoles.length === 0) {
			res.status(401).json({
				success: false,
				message: "Not authorized",
				error: "Invalid roles configuration",
			});
			return;
		}

		const globalAccessRoles = ["superadmin", "admin"];
		if (userRoles.some((role: string): boolean => globalAccessRoles.includes(role))) {
			next();
			return;
		}

		const hasAccess: boolean = userRoles.some((role: string): boolean => {
			const roleConfig: RoleConfig | undefined = roleHierarchy[role];

			if (!roleConfig) return false;

			const isValidApp: boolean =
				roleConfig.apps.includes("*") || roleConfig.apps.includes(app);
			const isValidModule: boolean =
				roleConfig.modules.includes("*") || roleConfig.modules.includes(module);
			const isValidAction: boolean =
				roleConfig.actions.includes("*") || roleConfig.actions.includes(action);

			return isValidApp && isValidModule && isValidAction;
		});

		if (hasAccess) {
			next();
			return;
		}

		res.status(403).json({
			success: false,
			message: "Not authorized",
			error: `Access denied for ${app} - ${module} - ${action}`,
		});
		return;
	};
};

export default verifyRole;
