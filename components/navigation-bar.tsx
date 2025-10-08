'use client';

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavigationBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-center px-4">
        {/* Centered Navigation */}
        <nav className="flex items-center bg-white rounded-full px-2 py-1 shadow-sm border">
          <Link href="/">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`rounded-full px-6 py-2  ${
                pathname === '/' 
                  ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                  : 'text-gray-700 hover:bg-gray-100'
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
                  ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Songs
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="rounded-full text-gray-700 hover:bg-gray-100 px-6 py-2 ">
            Artists
          </Button>
          <Button variant="ghost" size="sm" className="rounded-full text-gray-700 hover:bg-gray-100 px-6 py-2 ">
            Albums
          </Button>
          <Button variant="ghost" size="sm" className="rounded-full text-gray-700 hover:bg-gray-100 px-6 py-2 ">
            Analytics
          </Button>
        </nav>
      </div>
    </header>
  );
}
