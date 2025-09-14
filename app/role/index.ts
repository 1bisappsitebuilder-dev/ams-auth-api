import express, { Router } from "express";
import { PrismaClient } from "../../generated/prisma";
import { controller } from "./role.controller";
import { router } from "./role.router";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
