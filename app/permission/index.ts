import express, { Router } from "express";
import { controller } from "./permission.controller";
import { router } from "./permission.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
    return router(express.Router(), controller(prisma));
};
