'use client';

import { Button } from "./ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavigationBar() {
  const pathname = usePathname();

  return (
    <header className="w-full">
      <div className="container flex h-16 items-center justify-center px-4">
        {/* Centered Navigation */}
        <nav className="flex items-center bg-dark-surface rounded-full px-2 py-1 shadow-sm border border-dark-border">
          <Link href="/">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`rounded-full px-6 py-2  ${
                pathname === '/' 
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                  : 'text-dark-text-primary hover:bg-dark-surfaceHover'
              }`}
            >
              Dashboard
            </Button>
          </Link>
          <Link href="/songs">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`rounded-full px-6 py-2  ${
                pathname === '/songs' 
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                  : 'text-dark-text-primary hover:bg-dark-surfaceHover'
              }`}
            >
              Songs
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="rounded-full text-dark-text-primary hover:bg-dark-surfaceHover px-6 py-2 ">
            Artists
          </Button>
          <Link href="/albums">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`rounded-full px-6 py-2  ${
                pathname === '/albums' 
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                  : 'text-dark-text-primary hover:bg-dark-surfaceHover'
              }`}
            >
              Albums
            </Button>
          </Link>
          <Link href="/recent">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`rounded-full px-6 py-2  ${
                pathname === '/recent' 
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                  : 'text-dark-text-primary hover:bg-dark-surfaceHover'
              }`}
            >
              Recent
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="rounded-full text-dark-text-primary hover:bg-dark-surfaceHover px-6 py-2 ">
            Analytics
          </Button>
        </nav>
      </div>
    </header>
  );
}
