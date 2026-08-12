import "./globals.css";
import AuthGuard from "./components/AuthGuard";

export const metadata = {

    title: "PrzemAI",

    description: "Executive AI Assistant"

};

export default function RootLayout({ children }) {

    return (

        <html lang="pl">

            <body>

                <AuthGuard>

                    {children}

                </AuthGuard>

            </body>

        </html>

    );

}