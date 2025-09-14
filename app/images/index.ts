import express, { Router } from "express";
import { controller } from "./images.controller";
import { router } from "./images.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
	return router(express.Router(), controller(prisma));
};
