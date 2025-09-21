import express, { Router } from "express";
import { controller } from "./access-policy.controller";
import { router } from "./access-policy.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
