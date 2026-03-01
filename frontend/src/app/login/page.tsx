"use client";

import { useTheme } from "@/components/theme-provider";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function LoginPage() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
    };

    return (
        <div className="bg-background text-foreground antialiased transition-colors duration-300 min-h-screen flex flex-col relative overflow-hidden">
            {/* Subtle Mesh Gradient Background */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px]"></div>
            </div>

            {/* Theme Toggle (Top Right) */}
            <div className="absolute top-6 right-6 z-20">
                <button
                    onClick={toggleTheme}
                    className="flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-200"
                >
                    <span className="material-symbols-outlined text-[24px]">
                        {theme === "dark" ? "light_mode" : "dark_mode"}
                    </span>
                </button>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 flex items-center justify-center p-4 z-10 relative">
                {/* Login Card */}
                <div className="w-full max-w-[400px] bg-card text-card-foreground rounded-xl shadow-xl border border-border p-8 sm:p-10 transition-all duration-300">
                    {/* Logo & Header */}
                    <div className="flex flex-col items-center gap-4 mb-8">
                        <div className="size-10 bg-primary/10 text-primary flex items-center justify-center rounded-lg">
                            <svg
                                className="w-6 h-6"
                                fill="currentColor"
                                viewBox="0 0 48 48"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    clipRule="evenodd"
                                    d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z"
                                    fill="currentColor"
                                    fillRule="evenodd"
                                ></path>
                            </svg>
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl font-bold tracking-tight text-foreground">
                                ResuMate
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Your Career Command Center
                            </p>
                        </div>
                    </div>
                    {/* Login Form */}
                    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                        {/* Email */}
                        <div className="space-y-1.5">
                            <label
                                className="block text-sm font-medium text-foreground"
                                htmlFor="email"
                            >
                                Email address
                            </label>
                            <input
                                className="w-full h-11 px-3.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all text-sm shadow-sm"
                                id="email"
                                name="email"
                                placeholder="name@company.com"
                                type="email"
                            />
                        </div>
                        {/* Password */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label
                                    className="block text-sm font-medium text-foreground"
                                    htmlFor="password"
                                >
                                    Password
                                </label>
                                <Link
                                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                                    href="#"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <input
                                    className="w-full h-11 px-3.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all text-sm shadow-sm pr-10"
                                    id="password"
                                    name="password"
                                    placeholder="••••••••"
                                    type={showPassword ? "text" : "password"}
                                />
                                {/* Eye Icon for show/hide password */}
                                <button
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        {showPassword ? "visibility_off" : "visibility"}
                                    </span>
                                </button>
                            </div>
                        </div>
                        {/* Submit Button */}
                        <Link href="/dashboard"
                            className="w-full h-11 flex items-center justify-center rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm transition-all shadow-md shadow-primary/20 transform active:scale-[0.98]"
                        >
                            Sign In
                        </Link>
                    </form>
                    {/* Footer / Sign Up */}
                    <div className="mt-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            Don't have an account?{" "}
                            <Link
                                className="font-medium text-primary hover:text-primary/80 transition-colors"
                                href="#"
                            >
                                Sign up
                            </Link>
                        </p>
                    </div>
                </div>
                {/* Footer Text (Optional for context) */}
                <div className="absolute bottom-6 w-full text-center pointer-events-none">
                    <p className="text-xs text-muted-foreground/60 font-medium">
                        © 2024 ResuMate. All rights reserved.
                    </p>
                </div>
            </main>
        </div>
    );
}
