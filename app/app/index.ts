import express, { Router } from "express";
import { controller } from "./app.controller";
import { router } from "./app.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
