import { controller } from "../app/user/user.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("User Controller", () => {
	let userController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockPerson = {
		id: "507f1f77bcf86cd799439011",
		firstName: "John",
		lastName: "Doe",
		isDeleted: false,
	};

	const mockUser = {
		id: "507f1f77bcf86cd799439012",
		email: "john@example.com",
		userName: "johndoe",
		isDeleted: false,
		person: mockPerson,
	};

	beforeEach(() => {
		prisma = {
			user: {
				findMany: async (_params: Prisma.UserFindManyArgs) => [mockUser],
				count: async (_params: Prisma.UserCountArgs) => 1,
				findFirst: async (params: Prisma.UserFindFirstArgs) =>
					params.where?.id === mockUser.id ? mockUser : null,
				findUnique: async (params: Prisma.UserFindUniqueArgs) =>
					params.where?.id === mockUser.id ? mockUser : null,
				update: async (params: Prisma.UserUpdateArgs) => {
					const updatedUser = {
						...mockUser,
						...params.data,
					};
					updatedUser.person = mockPerson;
					return updatedUser;
				},
			},
			person: {
				findUnique: async (params: Prisma.PersonFindUniqueArgs) =>
					params.where?.id === mockPerson.id ? mockPerson : null,
				update: async (params: Prisma.PersonUpdateArgs) => {
					const updatedPerson = {
						...mockPerson,
						...params.data,
					};
					return updatedPerson;
				},
			},
			$transaction: async (operations: any) => {
				if (typeof operations === "function") {
					return operations(prisma);
				}
				const results = await Promise.all(operations);
				if (results.length === 2) {
					const [updatedUser, updatedPerson] = results;
					return [
						{
							...updatedUser,
							person: updatedPerson,
						},
					];
				}
				return results;
			},
		};

		userController = controller(prisma as PrismaClient);
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
		it("should return paginated users", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10" };
			await userController.getAll(req as Request, res, next);
		});
	});

	describe(".getById()", () => {
		it("should return a user", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockUser.id };
			await userController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.deep.include({ id: mockUser.id });
		});

		it("should handle non-existent user", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439099" };
			await userController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("message");
		});
	});

	describe(".update()", () => {
		it("should update user details", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				email: "jane@example.com",
				userName: "janesmith",
				person: { firstName: "Jane", lastName: "Smith" },
			};
			req.params = { id: mockUser.id };
			req.body = updateData;
			await userController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("email", updateData.email);
			expect(sentData.data).to.have.property("userName", updateData.userName);
			expect(sentData.data.person).to.have.property("firstName", updateData.person.firstName);
			expect(sentData.data.person).to.have.property("lastName", updateData.person.lastName);
		});
	});

	describe(".remove()", () => {
		it("should delete a user", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockUser.id };
			await userController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
		});

		it("should handle non-existent user deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439099" };
			await userController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("message");
		});
	});
});
