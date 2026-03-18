import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <h1 className="text-5xl font-bold text-gray-900">404</h1>
      <p className="text-gray-500 mt-2">This page could not be found</p>
      <Button asChild variant="outline" size="sm" className="mt-6">
        <Link href="/">Go to Dashboard</Link>
      </Button>
    </div>
  );
}
