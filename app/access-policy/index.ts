import express, { Router } from "express";
import { controller } from "./ap.controller";
import { router } from "./ap.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
