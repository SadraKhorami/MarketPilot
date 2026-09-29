import { PrismaClient, RoleName } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
	for (const name of Object.values(RoleName)) {
		await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
	}

	const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
	const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
	if (email && password) {
		if (password.length < 12)
			throw new Error(
				"BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.",
			);
		if (Buffer.byteLength(password, "utf8") > 72)
			throw new Error(
				"BOOTSTRAP_ADMIN_PASSWORD must not exceed 72 UTF-8 bytes.",
			);
		const adminRole = await prisma.role.findUniqueOrThrow({
			where: { name: RoleName.ADMIN },
		});
		const userRole = await prisma.role.findUniqueOrThrow({
			where: { name: RoleName.USER },
		});
		const passwordHash = await bcrypt.hash(password, 12);
		const user = await prisma.user.upsert({
			where: { email },
			update: {},
			create: { email, passwordHash },
		});
		await prisma.userRole.createMany({
			data: [
				{ userId: user.id, roleId: adminRole.id },
				{ userId: user.id, roleId: userRole.id },
			],
			skipDuplicates: true,
		});
	}
}

main()
	.catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => prisma.$disconnect());
