import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background text-center">
      <p className="text-6xl font-semibold text-muted-foreground">404</p>
      <p className="text-sm text-muted-foreground">This page doesn't exist.</p>
      <Link to="/company">
        <Button variant="outline">Go to company selection</Button>
      </Link>
    </div>
  );
}
