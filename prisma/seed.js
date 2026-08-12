const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {

    const email =
        process.env.ADMIN_EMAIL;

    const password =
        process.env.ADMIN_PASSWORD;

    const hash =
        await bcrypt.hash(password, 10);

    const existing =
        await prisma.user.findUnique({

            where: {

                email

            }

        });

    if (existing) {

        console.log("Administrator już istnieje.");

        return;

    }

    await prisma.user.create({

        data: {

            email,

            password: hash,

            role: "admin"

        }

    });

    console.log("Administrator utworzony.");

}

main()
    .catch(console.error)
    .finally(async () => {

        await prisma.$disconnect();

    });