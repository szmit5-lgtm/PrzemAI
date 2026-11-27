import "./globals.css";
import MobileConnection from "./components/MobileConnection";
import AuthGuard from "./components/AuthGuard";

export const metadata = {

    title: "PrzemAI",

    description: "Executive AI Assistant",
    appleWebApp: { capable: true, statusBarStyle: "default" },
    icons: { apple: "/mobile/icon-192.png" }

};

export const viewport = { themeColor: "#070e22", viewportFit: "cover" };

export default function RootLayout({ children }) {

    return (

        <html lang="pl">

            <body>

                <MobileConnection />
                <AuthGuard>

                    {children}

                </AuthGuard>

            </body>

        </html>

    );

}