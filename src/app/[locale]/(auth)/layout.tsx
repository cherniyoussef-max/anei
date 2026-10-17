import "../(site)/public-theme.css";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <main className="public-auth-experience bg-white min-h-screen" id="main-content" tabIndex={-1}>{children}</main>;
}
