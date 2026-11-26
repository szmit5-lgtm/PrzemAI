const jwt = require("jsonwebtoken");

function browserToken(req) {
    const cookies = (req.headers.cookie || "").split(/; */);
    const names = process.env.NODE_ENV === "production"
        ? ["__Host-przemai-session"]
        : ["__Host-przemai-session", "przemai-session"];
    for (const name of names) {
        const matches = cookies.filter(cookie => cookie.startsWith(name + "="));
        if (matches.length === 1) return matches[0].slice(name.length + 1);
    }
    return null;
}

function isSameOriginBrowserRequest(req) {
    const site = req.headers["sec-fetch-site"];
    if (site) return site === "same-origin";
    try {
        const frontend = new URL(process.env.FRONTEND_URL || "http://localhost:3001");
        return req.headers.origin === frontend.origin;
    } catch {
        return false;
    }
}

function verifyToken(req, res, next) {

    res.setHeader?.("Cache-Control", "private, no-store");
    let header = req.headers.authorization;
    const cookie = header ? null : browserToken(req);
    if (cookie) {
        if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !isSameOriginBrowserRequest(req)) {
            return res.status(403).json({ success: false, error: "Niedozwolone źródło żądania." });
        }
        header = "Bearer " + cookie;
    }

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