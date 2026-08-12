const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {

    const header = req.headers.authorization;

    if (!header) {

        return res.status(401).json({

            success: false,

            error: "Brak tokena."

        });

    }

    const parts = header.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {

        return res.status(401).json({

            success: false,

            error: "Nieprawidłowy format tokena."

        });

    }

    const token = parts[1];

    try {

        const decoded = jwt.verify(

            token,

            process.env.JWT_SECRET

        );

        req.user = decoded;

        next();

    }
    catch {

        return res.status(401).json({

            success: false,

            error: "Token jest nieważny."

        });

    }

}

module.exports = verifyToken;