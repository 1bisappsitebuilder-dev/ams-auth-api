import express, { Router } from "express";
import { controller } from "./person.controller";
import { router } from "./person.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
