import express, { Router } from "express";
import { controller } from "./role.controller";
import { router } from "./role.router";
import { PrismaClient } from "../../generated/prisma";

module.exports = (prisma: PrismaClient): Router => {
    return router(express.Router(), controller(prisma));
};
