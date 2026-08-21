const jwt = require("jsonwebtoken");

const prisma = require("../../lib/prisma");
const {
    comparePassword,
    hashPassword
} = require("../../lib/hash");

class AuthController {

    async register(req, res) {

        try {

            const {
                email,
                password
            } = req.body;

            const normalizedEmail =
                String(email || "")
                    .trim()
                    .toLowerCase();

            if (!normalizedEmail || !password) {

                return res.status(400).json({

                    success: false,
                    error: "Podaj e-mail i hasło."

                });

            }

            if (password.length < 8) {

                return res.status(400).json({

                    success: false,
                    error: "Hasło musi mieć co najmniej 8 znaków."

                });

            }

            const existingUser =
                await prisma.user.findUnique({

                    where: {
                        email: normalizedEmail
                    }

                });

            if (existingUser) {

                return res.status(409).json({

                    success: false,
                    error: "Konto z tym adresem e-mail już istnieje."

                });

            }

            const hashedPassword =
                await hashPassword(password);

            const user =
                await prisma.user.create({

                    data: {

                        email: normalizedEmail,
                        password: hashedPassword,
                        role: "user"

                    },

                    select: {

                        id: true,
                        email: true,
                        role: true,
                        createdAt: true

                    }

                });

            return res.status(201).json({

                success: true,
                message: "Konto zostało utworzone.",
                user

            });

        }
        catch (err) {

            return res.status(500).json({

                success: false,
                error:
                    err.message ||
                    "Nie udało się utworzyć konta."

            });

        }

    }

    async login(req, res) {

        try {

            const { email, password } = req.body;

            const normalizedEmail =
                String(email || "")
                    .trim()
                    .toLowerCase();

            const user = await prisma.user.findUnique({

                where: {
                    email: normalizedEmail
                }

            });

            if (!user) {

                return res.status(401).json({

                    success: false,
                    error: "Nieprawidłowy e-mail lub hasło."

                });

            }

            const valid = await comparePassword(
                password,
                user.password
            );

            if (!valid) {

                return res.status(401).json({

                    success: false,
                    error: "Nieprawidłowy e-mail lub hasło."

                });

            }

            const payload = {

                id: user.id,
                email: user.email,
                role: user.role

            };

            const token = jwt.sign(
                payload,
                process.env.JWT_SECRET,
                {
                    expiresIn: "7d"
                }
            );

            return res.json({

                success: true,
                token,
                user: payload

            });

        }
        catch (err) {

            return res.status(500).json({

                success: false,
                error: err.message

            });

        }

    }

    async me(req, res) {

        try {

            const user = await prisma.user.findUnique({

                where: {
                    id: req.user.id
                },

                select: {

                    id: true,
                    email: true,
                    role: true,
                    createdAt: true

                }

            });

            if (!user) {

                return res.status(404).json({

                    success: false,
                    error: "Użytkownik nie istnieje."

                });

            }

            return res.json({

                success: true,
                user

            });

        }
        catch (err) {

            return res.status(500).json({

                success: false,
                error: err.message

            });

        }

    }

    async changePassword(req, res) {

        try {

            const {
                currentPassword,
                newPassword
            } = req.body;

            if (
                !currentPassword ||
                !newPassword
            ) {

                return res.status(400).json({

                    success: false,
                    error: "Podaj obecne i nowe hasło."

                });

            }

            if (newPassword.length < 8) {

                return res.status(400).json({

                    success: false,
                    error: "Nowe hasło musi mieć co najmniej 8 znaków."

                });

            }

            const user = await prisma.user.findUnique({

                where: {
                    id: req.user.id
                }

            });

            if (!user) {

                return res.status(404).json({

                    success: false,
                    error: "Użytkownik nie istnieje."

                });

            }

            const valid = await comparePassword(
                currentPassword,
                user.password
            );

            if (!valid) {

                return res.status(400).json({

                    success: false,
                    error: "Obecne hasło jest nieprawidłowe."

                });

            }

            const sameAsOld = await comparePassword(
                newPassword,
                user.password
            );

            if (sameAsOld) {

                return res.status(400).json({

                    success: false,
                    error: "Nowe hasło musi być inne niż obecne."

                });

            }

            const hashedPassword =
                await hashPassword(
                    newPassword
                );

            await prisma.user.update({

                where: {
                    id: user.id
                },

                data: {
                    password: hashedPassword
                }

            });

            return res.json({

                success: true,
                message: "Hasło zostało zmienione."

            });

        }
        catch (err) {

            return res.status(500).json({

                success: false,
                error:
                    err.message ||
                    "Nie udało się zmienić hasła."

            });

        }

    }

}

module.exports = AuthController;