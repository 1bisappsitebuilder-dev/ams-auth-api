import { controller } from "../app/role/role.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("Role Controller", () => {
	let roleController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockRole = {
		id: "507f1f77bcf86cd799439021",
		name: "Administrator",
		description: "Full system access with administrative privileges",
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	beforeEach(() => {
		prisma = {
			userRole: {
				findMany: async (_params: Prisma.UserRoleFindManyArgs) => [mockRole],
				count: async (_params: Prisma.UserRoleCountArgs) => 1,
				findFirst: async (params: Prisma.UserRoleFindFirstArgs) =>
					params.where?.id === mockRole.id ? mockRole : null,
				findUnique: async (params: Prisma.UserRoleFindUniqueArgs) =>
					params.where?.id === mockRole.id ? mockRole : null,
				create: async (params: Prisma.UserRoleCreateArgs) => ({
					...mockRole,
					...params.data,
				}),
				update: async (params: Prisma.UserRoleUpdateArgs) => ({
					...mockRole,
					...params.data,
				}),
				delete: async (params: Prisma.UserRoleDeleteArgs) => {
					if (params.where?.id === mockRole.id) {
						return { ...mockRole, isDeleted: true };
					}
					throw new Error("Record not found");
				},
			},
			$transaction: async (operations: any) => {
				if (typeof operations === "function") {
					return operations(prisma);
				}
				return await Promise.all(operations);
			},
		};

		roleController = controller(prisma as PrismaClient);
		sentData = undefined;
		statusCode = 200;
		req = {
			query: {},
			params: {},
			body: {},
		};
		res = {
			send: (data: any) => {
				sentData = data;
				return res;
			},
			status: (code: number) => {
				statusCode = code;
				return res;
			},
			json: (data: any) => {
				sentData = data;
				return res;
			},
			end: () => res,
		} as Response;
		next = () => {};
	});

	describe(".getAll()", () => {
		it("should return paginated roles", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10" };
			await roleController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("data");
		});
	});

	describe(".getById()", () => {
		it("should return a role", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockRole.id };
			await roleController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.deep.include({ id: mockRole.id });
		});

		it("should handle non-existent role", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439099" };
			await roleController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", "NOT_FOUND");
		});
	});

	describe(".create()", () => {
		it("should create a new role", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				name: "Manager",
				description: "Management level access with limited administrative privileges",
			};
			req.body = createData;
			await roleController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			if (sentData.data) {
				expect(sentData).to.have.property("data");
			} else {
				expect(sentData).to.have.property("id");
			}
		});
	});

	describe(".update()", () => {
		it("should update role details", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				name: "Senior Administrator",
				description: "Enhanced administrative privileges with system management access",
			};
			req.params = { id: mockRole.id };
			req.body = updateData;
			await roleController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			if (sentData.data) {
				expect(sentData).to.have.property("data");
			} else {
				expect(sentData).to.have.property("id");
			}
		});
	});

	describe(".remove()", () => {
		it("should delete a role", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockRole.id };
			await roleController.remove(req as Request, res, next);
			expect([200, 200]).to.include(statusCode);
		});

		it("should handle non-existent role deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439099" };
			await roleController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", "NOT_FOUND");
		});
	});
});
