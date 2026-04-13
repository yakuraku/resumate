import { redirect } from "next/navigation";

// ResuMate is a local single-user tool with no authentication.
// Any direct visit to /login is sent back to the root entry point.
export default function LoginPage() {
    redirect("/");
}
