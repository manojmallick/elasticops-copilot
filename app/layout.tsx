import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ElasticOps Copilot',
  description: 'Multi-Agent Support Automation + Incident Awareness',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav className="navbar">
          <div className="nav-container">
            <a href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h1 className="nav-title">⚡ ElasticOps Copilot</h1>
            </a>
            <div className="nav-links">
              <a href="/copilot">Copilot</a>
              <a href="/inbox">Inbox</a>
              <a href="/search">Search</a>
              <a href="/dashboard">Dashboard</a>
            </div>
          </div>
        </nav>
        <main className="main-content">{children}</main>
      </body>
    </html>
  );
}
